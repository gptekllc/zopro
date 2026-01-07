import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { Resend } from 'https://esm.sh/resend@2.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Get the secret key for HMAC signing
function getTokenSecret(): string {
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!secret) {
    throw new Error('Token secret not configured');
  }
  return secret;
}

// Generate a random token
function generateRandomToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Create HMAC signature for data
async function createHmacSignature(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(data);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  return Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, '0')).join('');
}

// Generate a signed token (same as customer-portal-auth)
async function generateSignedToken(customerId: string, expiresAt: Date): Promise<string> {
  const secret = getTokenSecret();
  const randomToken = generateRandomToken();
  
  const tokenData = {
    customerId,
    expiresAt: expiresAt.toISOString(),
    nonce: randomToken,
  };
  
  const payload = btoa(JSON.stringify(tokenData));
  const signature = await createHmacSignature(payload, secret);
  
  return `${payload}.${signature}`;
}

// Format date in company timezone
function formatDateTime(dateStr: string, timezone: string = 'America/New_York'): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleString('en-US', {
      timeZone: timezone,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return new Date(dateStr).toLocaleString('en-US');
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
    
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    
    const body = await req.json();
    const { jobId, customerId, skipDuplicateCheck } = body;
    
    console.log('Sending job notification for job:', jobId, 'to customer:', customerId);

    if (!jobId || !customerId) {
      return new Response(
        JSON.stringify({ error: 'Job ID and Customer ID are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch job with customer and company info
    const { data: job, error: jobError } = await adminClient
      .from('jobs')
      .select(`
        *,
        customer:customers(id, name, email, phone, address, city, state, zip),
        company:companies(id, name, email, phone, address, city, state, zip, logo_url, brand_primary_color, timezone)
      `)
      .eq('id', jobId)
      .eq('customer_id', customerId)
      .single();

    if (jobError || !job) {
      console.error('Job not found:', jobError);
      return new Response(
        JSON.stringify({ error: 'Job not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const customer = job.customer;
    const company = job.company;

    if (!customer?.email) {
      console.error('Customer has no email address');
      return new Response(
        JSON.stringify({ error: 'Customer has no email address' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for duplicate notification (same job + same status) in last hour
    if (!skipDuplicateCheck) {
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);
      
      const { data: recentNotifications } = await adminClient
        .from('job_notifications')
        .select('id')
        .eq('job_id', jobId)
        .eq('status_at_send', job.status)
        .gte('sent_at', oneHourAgo.toISOString())
        .limit(1);
      
      if (recentNotifications && recentNotifications.length > 0) {
        console.log('Duplicate notification skipped - already sent within last hour');
        return new Response(
          JSON.stringify({ 
            success: false, 
            message: 'Notification already sent within the last hour for this status',
            skipped: true
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Generate magic link token (24 hour expiry)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);
    const signedToken = await generateSignedToken(customerId, expiresAt);
    
    // Get the app URL from environment or request origin
    const origin = Deno.env.get('APP_BASE_URL') || 'https://zopro.app';
    const magicLink = `${origin}/customer-portal?token=${encodeURIComponent(signedToken)}&customer=${customerId}`;

    console.log('Generated magic link for customer portal');

    // Get status-specific messaging
    let statusMessage = '';
    let statusColor = '#2563eb';
    
    switch (job.status) {
      case 'scheduled':
        statusMessage = 'Your appointment has been scheduled';
        statusColor = '#3b82f6'; // blue
        break;
      case 'in_progress':
        statusMessage = 'Work is now in progress';
        statusColor = '#8b5cf6'; // purple
        break;
      case 'completed':
        statusMessage = 'Your job has been completed';
        statusColor = '#22c55e'; // green
        break;
      default:
        statusMessage = 'Job Update';
    }

    // Format scheduled times
    const timezone = company?.timezone || 'America/New_York';
    const scheduledStart = job.scheduled_start ? formatDateTime(job.scheduled_start, timezone) : null;
    const scheduledEnd = job.scheduled_end ? formatDateTime(job.scheduled_end, timezone) : null;

    // Build customer address
    const customerAddress = [
      customer.address,
      [customer.city, customer.state, customer.zip].filter(Boolean).join(', ')
    ].filter(Boolean).join('<br>');

    // Build email HTML
    const brandColor = company?.brand_primary_color || '#0066CC';
    
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${statusMessage}</title>
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
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">${company?.name || 'Service Notification'}</h1>
            </td>
          </tr>
          
          <!-- Status Banner -->
          <tr>
            <td style="background-color: ${statusColor}; padding: 15px; text-align: center;">
              <p style="color: #ffffff; margin: 0; font-size: 18px; font-weight: 600;">${statusMessage}</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 30px;">
              <p style="color: #374151; font-size: 16px; margin: 0 0 20px 0;">Hello ${customer.name},</p>
              
              <!-- Job Details Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px; margin-bottom: 25px;">
                <tr>
                  <td style="padding: 20px;">
                    <h2 style="color: #111827; margin: 0 0 15px 0; font-size: 18px; font-weight: 600;">Job Details</h2>
                    
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                          <span style="color: #6b7280; font-size: 14px;">Job Number</span><br>
                          <span style="color: #111827; font-size: 16px; font-weight: 500;">${job.job_number}</span>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                          <span style="color: #6b7280; font-size: 14px;">Service</span><br>
                          <span style="color: #111827; font-size: 16px; font-weight: 500;">${job.title}</span>
                        </td>
                      </tr>
                      ${job.description ? `
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                          <span style="color: #6b7280; font-size: 14px;">Description</span><br>
                          <span style="color: #111827; font-size: 15px;">${job.description}</span>
                        </td>
                      </tr>
                      ` : ''}
                      ${scheduledStart ? `
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                          <span style="color: #6b7280; font-size: 14px;">Scheduled Date & Time</span><br>
                          <span style="color: #111827; font-size: 16px; font-weight: 500;">📅 ${scheduledStart}</span>
                        </td>
                      </tr>
                      ` : ''}
                      ${customerAddress ? `
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #6b7280; font-size: 14px;">Service Location</span><br>
                          <span style="color: #111827; font-size: 15px;">📍 ${customerAddress}</span>
                        </td>
                      </tr>
                      ` : ''}
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 10px 0 25px 0;">
                    <a href="${magicLink}" style="display: inline-block; background-color: ${brandColor}; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-size: 16px; font-weight: 600;">
                      View Appointment Details
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="color: #6b7280; font-size: 14px; margin: 0; text-align: center;">
                This link will expire in 24 hours. You can request a new one anytime from the customer portal.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 25px 30px; border-top: 1px solid #e5e7eb;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="color: #374151; margin: 0 0 5px 0; font-size: 14px; font-weight: 600;">${company?.name || 'Our Company'}</p>
                    ${company?.phone ? `<p style="color: #6b7280; margin: 0 0 3px 0; font-size: 13px;">📞 ${company.phone}</p>` : ''}
                    ${company?.email ? `<p style="color: #6b7280; margin: 0; font-size: 13px;">✉️ ${company.email}</p>` : ''}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
        </table>
        
        <!-- Unsubscribe -->
        <p style="color: #9ca3af; font-size: 12px; margin-top: 20px; text-align: center;">
          You received this email because you are a customer of ${company?.name || 'our company'}.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    // Send email if Resend is configured
    if (!resendApiKey) {
      console.log('RESEND_API_KEY not configured. Email would be sent to:', customer.email);
      console.log('Magic link:', magicLink);
      
      // Still record the notification even in dev mode
      await adminClient
        .from('job_notifications')
        .insert({
          job_id: jobId,
          customer_id: customerId,
          company_id: company.id,
          notification_type: 'status_update',
          status_at_send: job.status,
          recipient_email: customer.email,
        });
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Email would be sent (Resend not configured)',
          magicLink 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    try {
      const resend = new Resend(resendApiKey);
      
      await resend.emails.send({
        from: "ZoPro Notifications <noreply@email.zopro.app>",
        to: [customer.email],
        subject: `${statusMessage} - ${job.job_number}`,
        html: emailHtml,
      });
      
      console.log('Email sent successfully to:', customer.email);
      
      // Record the notification
      await adminClient
        .from('job_notifications')
        .insert({
          job_id: jobId,
          customer_id: customerId,
          company_id: company.id,
          notification_type: 'status_update',
          status_at_send: job.status,
          recipient_email: customer.email,
        });
      
      console.log('Notification recorded in job_notifications table');
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Notification sent to ${customer.email}` 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (emailError: any) {
      console.error('Failed to send email:', emailError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to send email', 
          details: emailError.message 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error: any) {
    console.error('Error in send-job-notification:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
