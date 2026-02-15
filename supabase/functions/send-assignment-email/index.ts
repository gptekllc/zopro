import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { Resend } from 'https://esm.sh/resend@2.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-trigger-secret',
};

async function logEmail(
  adminClient: any,
  recipientEmail: string,
  subject: string,
  emailType: string,
  status: 'sent' | 'failed',
  resendId: string | null,
  errorMessage: string | null,
  companyId: string | null = null,
  metadata: Record<string, any> = {}
) {
  try {
    await adminClient.from('email_logs').insert({
      recipient_email: recipientEmail,
      sender_email: 'noreply@email.zopro.app',
      subject,
      email_type: emailType,
      status,
      resend_id: resendId,
      error_message: errorMessage,
      company_id: companyId,
      metadata,
    });
  } catch (err) {
    console.error('Failed to log email:', err);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    // Verify internal trigger secret
    const triggerSecret = req.headers.get('x-trigger-secret');
    const expectedSecret = Deno.env.get('INTERNAL_TRIGGER_SECRET');
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    const isTrusted = !!(triggerSecret && expectedSecret && triggerSecret === expectedSecret) 
      || token === supabaseServiceKey;

    if (!isTrusted) {
      // Also allow authenticated admin/manager users
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } }
      });
      const { data: { user }, error } = await userClient.auth.getUser();
      if (error || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json();
    const { technicianId, recordType, recordId, recordNumber, companyId } = body;

    console.log('Sending assignment email:', { technicianId, recordType, recordNumber });

    if (!technicianId || !recordType || !recordId) {
      return new Response(
        JSON.stringify({ error: 'technicianId, recordType, and recordId are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get technician profile with email
    const { data: technician, error: techError } = await adminClient
      .from('profiles')
      .select('id, email, first_name, last_name, full_name')
      .eq('id', technicianId)
      .single();

    if (techError || !technician?.email) {
      console.log('Technician not found or has no email:', techError);
      return new Response(
        JSON.stringify({ error: 'Technician not found or has no email' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get company info
    let company: any = null;
    if (companyId) {
      const { data } = await adminClient
        .from('companies')
        .select('id, name, email, phone, logo_url, brand_primary_color')
        .eq('id', companyId)
        .single();
      company = data;
    }

    // Get record details
    let recordTitle = '';
    if (recordType === 'job') {
      const { data: job } = await adminClient
        .from('jobs')
        .select('title, job_number')
        .eq('id', recordId)
        .single();
      recordTitle = job?.title || '';
    }

    const techName = technician.first_name || technician.full_name || 'Team Member';
    const brandColor = company?.brand_primary_color || '#0066CC';
    const typeLabel = recordType.charAt(0).toUpperCase() + recordType.slice(1);
    const subject = `You've been assigned to ${typeLabel} #${recordNumber}`;

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color: ${brandColor}; padding: 30px; text-align: center;">
              ${company?.logo_url ? `<img src="${company.logo_url}" alt="${company?.name}" style="max-height: 60px; max-width: 200px; margin-bottom: 15px;">` : ''}
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">${company?.name || 'Assignment Notification'}</h1>
            </td>
          </tr>
          
          <!-- Assignment Banner -->
          <tr>
            <td style="background-color: #3b82f6; padding: 15px; text-align: center;">
              <p style="color: #ffffff; margin: 0; font-size: 18px; font-weight: 600;">📋 New ${typeLabel} Assignment</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 30px;">
              <p style="color: #374151; font-size: 16px; margin: 0 0 20px 0;">Hi ${techName},</p>
              <p style="color: #374151; font-size: 16px; margin: 0 0 20px 0;">
                You have been assigned to <strong>${typeLabel} #${recordNumber}</strong>${recordTitle ? `: ${recordTitle}` : ''}.
              </p>
              
              <!-- Details Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px; margin-bottom: 25px;">
                <tr>
                  <td style="padding: 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                          <span style="color: #6b7280; font-size: 14px;">Type</span><br>
                          <span style="color: #111827; font-size: 16px; font-weight: 500;">${typeLabel}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #6b7280; font-size: 14px;">Number</span><br>
                          <span style="color: #111827; font-size: 16px; font-weight: 500;">#${recordNumber}</span>
                        </td>
                      </tr>
                      ${recordTitle ? `
                      <tr>
                        <td style="padding: 8px 0; border-top: 1px solid #e5e7eb;">
                          <span style="color: #6b7280; font-size: 14px;">Title</span><br>
                          <span style="color: #111827; font-size: 16px; font-weight: 500;">${recordTitle}</span>
                        </td>
                      </tr>
                      ` : ''}
                    </table>
                  </td>
                </tr>
              </table>
              
              <p style="color: #6b7280; font-size: 14px; margin: 0; text-align: center;">
                Log in to the app to view the full details.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 25px 30px; border-top: 1px solid #e5e7eb;">
              <p style="color: #374151; margin: 0 0 5px 0; font-size: 14px; font-weight: 600;">${company?.name || 'Our Company'}</p>
              ${company?.phone ? `<p style="color: #6b7280; margin: 0 0 3px 0; font-size: 13px;">📞 ${company.phone}</p>` : ''}
              ${company?.email ? `<p style="color: #6b7280; margin: 0; font-size: 13px;">✉️ ${company.email}</p>` : ''}
            </td>
          </tr>
        </table>
        
        <p style="color: #9ca3af; font-size: 12px; margin-top: 20px; text-align: center;">
          You received this email because you were assigned to a ${recordType} in ${company?.name || 'the system'}.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;

    if (!resendApiKey) {
      console.log('RESEND_API_KEY not configured. Email would be sent to:', technician.email);
      return new Response(
        JSON.stringify({ success: true, message: 'Email would be sent (Resend not configured)' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    try {
      const resend = new Resend(resendApiKey);
      const emailResponse = await resend.emails.send({
        from: 'ZoPro Notifications <noreply@email.zopro.app>',
        to: [technician.email],
        subject,
        html: emailHtml,
      });

      console.log('Assignment email sent to:', technician.email);

      await logEmail(
        adminClient,
        technician.email,
        subject,
        'technician_assignment',
        'sent',
        (emailResponse as any)?.data?.id || null,
        null,
        companyId,
        { recordType, recordId, recordNumber }
      );

      return new Response(
        JSON.stringify({ success: true, message: `Email sent to ${technician.email}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (emailError: any) {
      console.error('Failed to send assignment email:', emailError);

      await logEmail(
        adminClient,
        technician.email,
        subject,
        'technician_assignment',
        'failed',
        null,
        emailError.message,
        companyId,
        { recordType, recordId, recordNumber }
      );

      return new Response(
        JSON.stringify({ error: 'Failed to send email', details: emailError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error: any) {
    console.error('Error in send-assignment-email:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
