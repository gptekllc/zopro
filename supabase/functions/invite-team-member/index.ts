import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InviteRequest {
  email: string;
  full_name: string;
  role: 'admin' | 'manager' | 'technician' | 'customer';
  company_id: string;
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

    const body: InviteRequest = await req.json();
    const { email, full_name, role, company_id } = body;

    console.log('Invite request:', { email, full_name, role, company_id });

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

    // Send password reset email so they can set their password
    const { error: resetError } = await adminClient.auth.admin.generateLink({
      type: 'invite',
      email,
    });

    if (resetError) {
      console.log('Note: Could not send invite email:', resetError.message);
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