import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  type: 'company_assigned' | 'roles_changed' | 'join_request_admin' | 'join_request_approved' | 'join_request_rejected';
  recipientEmail: string;
  recipientName: string;
  companyName?: string;
  roles?: string[];
  previousRoles?: string[];
  requesterName?: string;
  requesterEmail?: string;
  assignedRole?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { 
      type, 
      recipientEmail, 
      recipientName, 
      companyName, 
      roles, 
      previousRoles,
      requesterName,
      requesterEmail,
      assignedRole
    }: NotificationRequest = await req.json();

    console.log("Processing notification:", { type, recipientEmail, companyName });

    let subject = '';
    let htmlContent = '';

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
      const rolesList = roles?.map(r => r.replace('_', ' ')).join(', ') || 'None';
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
    }

    const emailResponse = await resend.emails.send({
      from: "Service App <onboarding@resend.dev>",
      to: [recipientEmail],
      subject,
      html: htmlContent,
    });

    console.log("Notification email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-notification function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
