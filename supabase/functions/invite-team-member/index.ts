import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { Resend } from 'https://esm.sh/resend@2.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InviteRequest {
  email: string;
  full_name: string;
  role: 'admin' | 'manager' | 'technician' | 'customer';
  company_id: string;
  resend?: boolean;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create client with user's JWT to verify they're authenticated
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify the calling user
    const { data: { user: callingUser }, error: userError } = await userClient.auth.getUser();
    if (userError || !callingUser) {
      console.error('Failed to get calling user:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Calling user:', callingUser.id);

    // Use service role client for admin operations
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Check if calling user is an admin
    const { data: callerProfile } = await adminClient
      .from('profiles')
      .select('company_id, role')
      .eq('id', callingUser.id)
      .single();

    if (!callerProfile || callerProfile.role !== 'admin') {
      console.error('Caller is not an admin:', callerProfile);
      return new Response(
        JSON.stringify({ error: 'Only admins can invite team members' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get company info for email
    const { data: company } = await adminClient
      .from('companies')
      .select('name')
      .eq('id', callerProfile.company_id)
      .single();

    const body: InviteRequest = await req.json();
    const { email, full_name, role, company_id, resend: isResend } = body;

    console.log('Invite request:', { email, full_name, role, company_id, isResend });

    // Validate that the admin is inviting to their own company
    if (callerProfile.company_id !== company_id) {
      return new Response(
        JSON.stringify({ error: 'Cannot invite to a different company' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user already exists
    const { data: existingUsers } = await adminClient.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(u => u.email === email);

    if (existingUser) {
      // User exists - check if they're already in a company
      const { data: existingProfile } = await adminClient
        .from('profiles')
        .select('company_id, full_name')
        .eq('id', existingUser.id)
        .single();

      if (existingProfile?.company_id) {
        return new Response(
          JSON.stringify({ error: 'User already belongs to a company' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update their profile to join this company
      const { error: updateError } = await adminClient
        .from('profiles')
        .update({ 
          company_id, 
          role,
          full_name: full_name || existingProfile?.full_name 
        })
        .eq('id', existingUser.id);

      if (updateError) {
        console.error('Failed to update profile:', updateError);
        throw updateError;
      }

      // Add role to user_roles
      await adminClient
        .from('user_roles')
        .upsert({ user_id: existingUser.id, role }, { onConflict: 'user_id' });

      // Mark invitation as accepted if exists
      await adminClient
        .from('team_invitations')
        .update({ status: 'accepted', accepted_at: new Date().toISOString() })
        .eq('email', email)
        .eq('company_id', company_id);

      // Send welcome email
      if (resendApiKey) {
        try {
          const resendClient = new Resend(resendApiKey);
          await resendClient.emails.send({
            from: 'Team <onboarding@resend.dev>',
            to: [email],
            subject: `You've been added to ${company?.name || 'a team'}`,
            html: `
              <h1>Welcome to ${company?.name || 'the team'}!</h1>
              <p>Hi ${full_name || 'there'},</p>
              <p>You've been added to ${company?.name || 'a team'} as a <strong>${role}</strong>.</p>
              <p>You can now log in with your existing account to access the team dashboard.</p>
              <p>Best regards,<br>The Team</p>
            `,
          });
          console.log('Welcome email sent to existing user');
        } catch (emailError) {
          console.error('Failed to send welcome email:', emailError);
        }
      }

      console.log('Added existing user to company');
      return new Response(
        JSON.stringify({ success: true, message: 'User added to company', userId: existingUser.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create new user with invite
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      email_confirm: false, // They'll need to confirm their email
      user_metadata: { full_name },
    });

    if (createError) {
      console.error('Failed to create user:', createError);
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Created new user:', newUser.user.id);

    // Update their profile with company and role
    const { error: profileError } = await adminClient
      .from('profiles')
      .update({ company_id, role, full_name })
      .eq('id', newUser.user.id);

    if (profileError) {
      console.error('Failed to update new user profile:', profileError);
    }

    // Add role to user_roles
    const { error: roleError } = await adminClient
      .from('user_roles')
      .insert({ user_id: newUser.user.id, role });

    if (roleError) {
      console.error('Failed to add user role:', roleError);
    }

    // Generate password reset link
    const { data: resetLink, error: resetError } = await adminClient.auth.admin.generateLink({
      type: 'invite',
      email,
    });

    let inviteUrl = '';
    if (resetLink?.properties?.action_link) {
      inviteUrl = resetLink.properties.action_link;
    }

    // Send welcome email with login instructions
    if (resendApiKey) {
      try {
        const resendClient = new Resend(resendApiKey);
        await resendClient.emails.send({
          from: 'Team <onboarding@resend.dev>',
          to: [email],
          subject: `You're invited to join ${company?.name || 'a team'}`,
          html: `
            <h1>Welcome to ${company?.name || 'the team'}!</h1>
            <p>Hi ${full_name || 'there'},</p>
            <p>You've been invited to join ${company?.name || 'a team'} as a <strong>${role}</strong>.</p>
            <h2>Getting Started</h2>
            <ol>
              <li>Click the link below to set your password</li>
              <li>Once your password is set, you can log in to access the dashboard</li>
            </ol>
            ${inviteUrl ? `<p><a href="${inviteUrl}" style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Set Your Password</a></p>` : ''}
            <p>If the button doesn't work, copy and paste this link into your browser:</p>
            <p>${inviteUrl || 'Please contact your administrator for login instructions.'}</p>
            <p>Best regards,<br>The Team</p>
          `,
        });
        console.log('Invitation email sent successfully');
      } catch (emailError) {
        console.error('Failed to send invitation email:', emailError);
      }
    }

    // Update invitation status if this was a resend
    if (isResend) {
      await adminClient
        .from('team_invitations')
        .update({ expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() })
        .eq('email', email)
        .eq('company_id', company_id);
    } else {
      // Create invitation record
      await adminClient
        .from('team_invitations')
        .upsert({
          company_id,
          email,
          full_name,
          role,
          invited_by: callingUser.id,
          status: 'pending',
        }, { onConflict: 'company_id,email' });
    }

    console.log('Successfully invited new team member');
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Team member invited successfully. They will receive an email to set their password.',
        userId: newUser.user.id 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in invite-team-member:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});