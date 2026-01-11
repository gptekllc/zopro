import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  type: 'company_assigned' | 'roles_changed' | 'join_request_admin' | 'join_request_approved' | 'join_request_rejected' | 'member_on_leave' | 'custom_domain_setup';
  recipientEmail?: string;
  recipientName?: string;
  companyName?: string;
  companyId?: string;
  roles?: string[];
  previousRoles?: string[];
  requesterName?: string;
  requesterEmail?: string;
  assignedRole?: string;
  memberName?: string;
  memberEmail?: string;
  customDomain?: string;
  requestedBy?: string;
}

// Helper to log email to email_logs table
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

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Create admin client for logging
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    // Verify caller authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create a user client with the provided auth header to verify the caller
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();

    if (userError || !user) {
      console.error("Failed to verify user:", userError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user has permission to send notifications (admin/manager only)
    const { data: roles } = await userClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const isAuthorized = roles?.some(r => 
      ["admin", "manager", "super_admin"].includes(r.role)
    );

    if (!isAuthorized) {
      console.error("User not authorized to send notifications:", user.id);
      return new Response(
        JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { 
      type, 
      recipientEmail, 
      recipientName, 
      companyName,
      companyId,
      roles: notificationRoles, 
      previousRoles,
      requesterName,
      requesterEmail,
      assignedRole,
      memberName,
      memberEmail,
      customDomain,
      requestedBy
    } = body as NotificationRequest;

    console.log("Processing notification:", { type, recipientEmail, companyName, callingUserId: user.id });

    let subject = '';
    let htmlContent = '';
    let finalRecipientEmail = recipientEmail || '';
    let finalRecipientName = recipientName || '';

    // For custom_domain_setup, find all admin emails for the company
    if (type === 'custom_domain_setup' && companyId) {
      // Get all admins for this company
      const { data: companyAdmins } = await adminClient
        .from('profiles')
        .select('id, first_name, last_name, full_name, email')
        .eq('company_id', companyId);

      if (companyAdmins && companyAdmins.length > 0) {
        // Find admins by checking their roles
        const adminIds = companyAdmins.map(a => a.id);
        const { data: adminRoles } = await adminClient
          .from('user_roles')
          .select('user_id')
          .in('user_id', adminIds)
          .eq('role', 'admin');

        const adminUserIds = new Set(adminRoles?.map(r => r.user_id) || []);
        const adminProfiles = companyAdmins.filter(p => adminUserIds.has(p.id));

        // Send email to each admin
        const adminEmails = adminProfiles.map(p => p.email).filter(Boolean);
        
        subject = `Custom Domain Setup Request: ${customDomain}`;
        htmlContent = `
          <!DOCTYPE html>
          <html>
            <head>
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; }
                .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
                .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #6366f1; }
                .steps { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
                .steps ol { margin: 0; padding-left: 20px; }
                .steps li { margin-bottom: 10px; }
                .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1 style="margin: 0;">🌐 Custom Domain Setup Request</h1>
                </div>
                <div class="content">
                  <p>A custom domain has been configured and needs DNS setup assistance.</p>
                  
                  <div class="info-box">
                    <p><strong>Request Details:</strong></p>
                    <p>Company: ${companyName || 'Unknown'}</p>
                    <p>Custom Domain: <code>${customDomain}</code></p>
                    <p>Requested by: ${requestedBy || 'Unknown'}</p>
                  </div>
                  
                  <div class="steps">
                    <p><strong>Next Steps:</strong></p>
                    <ol>
                      <li>Verify the domain ownership</li>
                      <li>Configure the A record to point to 185.158.133.1</li>
                      <li>Wait for DNS propagation (up to 72 hours)</li>
                      <li>SSL certificate will be provisioned automatically</li>
                    </ol>
                  </div>
                  
                  <p>Please contact support if you need assistance with the DNS configuration.</p>
                  
                  <div class="footer">
                    <p>This is an automated notification from ZoPro.</p>
                  </div>
                </div>
              </div>
            </body>
          </html>
        `;

        // Send to all admins
        for (const adminEmail of adminEmails) {
          if (!adminEmail) continue;
          try {
            const emailResponse = await resend.emails.send({
              from: "ZoPro Notifications <noreply@email.zopro.app>",
              to: [adminEmail],
              subject,
              html: htmlContent,
            });

            console.log("Custom domain notification sent to admin:", adminEmail, emailResponse);

            await logEmail(
              adminClient,
              adminEmail,
              subject,
              type,
              'sent',
              (emailResponse as any)?.data?.id || null,
              null,
              companyId,
              { notificationType: type, customDomain, requestedBy }
            );
          } catch (emailErr) {
            console.error("Failed to send to admin:", adminEmail, emailErr);
          }
        }

        return new Response(JSON.stringify({ success: true, notifiedAdmins: adminEmails.length }), {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    // Validate required fields for other notification types
    if (!finalRecipientEmail) {
      return new Response(
        JSON.stringify({ error: "recipientEmail is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (type === 'company_assigned') {
      subject = companyName ? `You've been assigned to ${companyName}` : 'Company Assignment Updated';
      htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
              .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">Company Assignment Update</h1>
              </div>
              <div class="content">
                <p>Hi ${recipientName || 'there'},</p>
                ${companyName 
                  ? `<p>You have been assigned to <strong>${companyName}</strong>.</p>
                     <p>You now have access to all company resources and can start using the service management platform.</p>`
                  : `<p>You have been unassigned from your previous company.</p>
                     <p>Please contact your administrator if you believe this was done in error.</p>`
                }
                <div class="footer">
                  <p>This is an automated notification from Service App.</p>
                </div>
              </div>
            </div>
          </body>
        </html>
      `;
    } else if (type === 'roles_changed') {
      subject = 'Your Roles Have Been Updated';
      const rolesList = notificationRoles?.map(r => r.replace('_', ' ')).join(', ') || 'None';
      const previousRolesList = previousRoles?.map(r => r.replace('_', ' ')).join(', ') || 'None';
      
      htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
              .roles-section { margin: 20px 0; padding: 15px; background: white; border-radius: 8px; }
              .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">Role Update Notification</h1>
              </div>
              <div class="content">
                <p>Hi ${recipientName || 'there'},</p>
                <p>Your user roles have been updated by an administrator.</p>
                
                <div class="roles-section">
                  <p><strong>Previous Roles:</strong></p>
                  <p>${previousRolesList === 'None' ? '<em>No roles</em>' : previousRolesList}</p>
                  
                  <p style="margin-top: 15px;"><strong>Current Roles:</strong></p>
                  <p>${rolesList === 'None' ? '<em>No roles</em>' : rolesList}</p>
                </div>
                
                <p>Your access permissions may have changed based on these new roles. If you have any questions, please contact your administrator.</p>
                
                <div class="footer">
                  <p>This is an automated notification from Service App.</p>
                </div>
              </div>
            </div>
          </body>
        </html>
      `;
    } else if (type === 'join_request_admin') {
      subject = `New Join Request: ${requesterName || 'Someone'} wants to join your company`;
      htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
              .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #22c55e; }
              .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">New Join Request</h1>
              </div>
              <div class="content">
                <p>Hi ${recipientName || 'Admin'},</p>
                <p>A new user has requested to join <strong>${companyName || 'your company'}</strong>.</p>
                
                <div class="info-box">
                  <p><strong>Requester Details:</strong></p>
                  <p>Name: ${requesterName || 'Not provided'}</p>
                  <p>Email: ${requesterEmail || 'Not provided'}</p>
                </div>
                
                <p>Please log in to the admin dashboard to review and approve or reject this request.</p>
                
                <div class="footer">
                  <p>This is an automated notification from Service App.</p>
                </div>
              </div>
            </div>
          </body>
        </html>
      `;
    } else if (type === 'join_request_approved') {
      subject = `Welcome to ${companyName || 'the company'}!`;
      htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
              .role-badge { display: inline-block; background: #6366f1; color: white; padding: 8px 16px; border-radius: 20px; font-weight: bold; }
              .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">🎉 Request Approved!</h1>
              </div>
              <div class="content">
                <p>Hi ${recipientName || 'there'},</p>
                <p>Great news! Your request to join <strong>${companyName || 'the company'}</strong> has been approved.</p>
                
                ${assignedRole ? `
                <p>You have been assigned the role of:</p>
                <p><span class="role-badge">${assignedRole.charAt(0).toUpperCase() + assignedRole.slice(1)}</span></p>
                ` : ''}
                
                <p>You can now log in and start using the platform with your new access.</p>
                
                <div class="footer">
                  <p>This is an automated notification from Service App.</p>
                </div>
              </div>
            </div>
          </body>
        </html>
      `;
    } else if (type === 'join_request_rejected') {
      subject = 'Your join request was not approved';
      htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
              .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">Request Not Approved</h1>
              </div>
              <div class="content">
                <p>Hi ${recipientName || 'there'},</p>
                <p>Unfortunately, your request to join <strong>${companyName || 'the company'}</strong> was not approved.</p>
                
                <p>If you believe this was a mistake, please contact the company administrator directly.</p>
                
                <div class="footer">
                  <p>This is an automated notification from Service App.</p>
                </div>
              </div>
            </div>
          </body>
        </html>
      `;
    } else if (type === 'member_on_leave') {
      subject = `Team Member On Leave: ${memberName || 'A team member'} is now on leave`;
      htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: linear-gradient(135deg, #eab308 0%, #ca8a04 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; }
              .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
              .info-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #eab308; }
              .footer { margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #6b7280; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="margin: 0;">⚠️ Team Member On Leave</h1>
              </div>
              <div class="content">
                <p>Hi ${recipientName || 'Manager'},</p>
                <p>A team member has set themselves as on leave.</p>
                
                <div class="info-box">
                  <p><strong>Team Member Details:</strong></p>
                  <p>Name: ${memberName || 'Not provided'}</p>
                  <p>Email: ${memberEmail || 'Not provided'}</p>
                </div>
                
                <p>This team member will not be available for job assignments until they set themselves as active again.</p>
                <p>Please review any scheduled jobs that may be affected.</p>
                
                <div class="footer">
                  <p>This is an automated notification from Service App.</p>
                </div>
              </div>
            </div>
          </body>
        </html>
      `;
    }

    try {
      const emailResponse = await resend.emails.send({
        from: "ZoPro Notifications <noreply@email.zopro.app>",
        to: [finalRecipientEmail],
        subject,
        html: htmlContent,
      });

      console.log("Notification email sent successfully:", emailResponse);

      // Log successful email
      await logEmail(
        adminClient,
        finalRecipientEmail,
        subject,
        type,
        'sent',
        (emailResponse as any)?.data?.id || null,
        null,
        companyId || null,
        { notificationType: type, recipientName: finalRecipientName }
      );

      return new Response(JSON.stringify(emailResponse), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    } catch (emailError: unknown) {
      const errorMessage = emailError instanceof Error ? emailError.message : "Unknown email error";
      console.error("Failed to send notification email:", emailError);

      // Log failed email
      await logEmail(
        adminClient,
        finalRecipientEmail,
        subject,
        type,
        'failed',
        null,
        errorMessage,
        companyId || null,
        { notificationType: type, recipientName: finalRecipientName }
      );

      throw emailError;
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in send-notification function:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
