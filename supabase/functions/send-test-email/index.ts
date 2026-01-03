import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SendTestEmailRequest {
  companyId: string;
  recipientEmail: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { companyId, recipientEmail }: SendTestEmailRequest = await req.json();

    console.log(`Sending test email for company ${companyId} to ${recipientEmail}`);

    if (!companyId || !recipientEmail) {
      throw new Error("Company ID and recipient email are required");
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch company details
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("name, email, phone, address, city, state, zip, logo_url, website, facebook_url, instagram_url, linkedin_url")
      .eq("id", companyId)
      .single();

    if (companyError) {
      console.error("Company fetch error:", companyError);
      throw new Error("Failed to fetch company details");
    }

    console.log("Company details:", company);

    const emailHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #333; line-height: 1.6; margin: 0; padding: 0; background: #f4f4f4; }
          .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
          .card { background: white; border-radius: 12px; padding: 40px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
          .header { text-align: center; margin-bottom: 30px; }
          .logo { max-height: 60px; max-width: 180px; object-fit: contain; margin-bottom: 20px; }
          h1 { color: #1a1a1a; margin: 0 0 10px 0; font-size: 24px; }
          .success-badge { display: inline-block; padding: 8px 16px; background: #22c55e; color: white; border-radius: 20px; font-size: 14px; font-weight: 500; margin-bottom: 20px; }
          .content { font-size: 16px; color: #555; }
          .info-section { margin: 25px 0; padding: 20px; background: #f8f9fa; border-radius: 8px; }
          .info-section h3 { margin: 0 0 15px 0; font-size: 14px; text-transform: uppercase; color: #888; }
          .info-row { margin: 8px 0; }
          .info-label { font-weight: 600; color: #333; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; font-size: 13px; color: #888; }
          .footer a { color: #2563eb; text-decoration: none; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            <div class="header">
              ${company.logo_url ? `<img src="${company.logo_url}" alt="${company.name}" class="logo" />` : ''}
              <span class="success-badge">✓ Email Configuration Working</span>
              <h1>Test Email from ${company.name || 'Your Company'}</h1>
            </div>
            
            <div class="content">
              <p>This is a test email to verify that your email configuration is working correctly.</p>
              <p>If you received this email, it means your email settings are properly configured and customers will be able to receive invoices, quotes, and notifications from your company.</p>
            </div>

            <div class="info-section">
              <h3>Company Information (as it appears in emails)</h3>
              <div class="info-row"><span class="info-label">Company Name:</span> ${company.name || 'Not set'}</div>
              ${company.email ? `<div class="info-row"><span class="info-label">Email:</span> ${company.email}</div>` : ''}
              ${company.phone ? `<div class="info-row"><span class="info-label">Phone:</span> ${company.phone}</div>` : ''}
              ${company.website ? `<div class="info-row"><span class="info-label">Website:</span> <a href="${company.website}" style="color: #2563eb;">${company.website}</a></div>` : ''}
              ${company.address ? `<div class="info-row"><span class="info-label">Address:</span> ${company.address}${company.city || company.state || company.zip ? `, ${[company.city, company.state, company.zip].filter(Boolean).join(', ')}` : ''}</div>` : ''}
              ${(company.facebook_url || company.instagram_url || company.linkedin_url) ? `
                <div class="info-row" style="margin-top: 10px;">
                  <span class="info-label">Social Media:</span>
                  ${company.facebook_url ? `<a href="${company.facebook_url}" style="color: #2563eb; margin-right: 10px;">Facebook</a>` : ''}
                  ${company.instagram_url ? `<a href="${company.instagram_url}" style="color: #2563eb; margin-right: 10px;">Instagram</a>` : ''}
                  ${company.linkedin_url ? `<a href="${company.linkedin_url}" style="color: #2563eb;">LinkedIn</a>` : ''}
                </div>
              ` : ''}
            </div>

            <div class="footer">
              <p>This test email was sent from ZoPro.</p>
              ${company.website ? `<p><a href="${company.website}">${company.website}</a></p>` : ''}
              ${(company.facebook_url || company.instagram_url || company.linkedin_url) ? `
                <p style="margin-top: 8px;">
                  ${company.facebook_url ? `<a href="${company.facebook_url}" style="color: #2563eb; margin-right: 10px;">Facebook</a>` : ''}
                  ${company.instagram_url ? `<a href="${company.instagram_url}" style="color: #2563eb; margin-right: 10px;">Instagram</a>` : ''}
                  ${company.linkedin_url ? `<a href="${company.linkedin_url}" style="color: #2563eb;">LinkedIn</a>` : ''}
                </p>
              ` : ''}
            </div>
          </div>
        </div>
      </body>
      </html>
    `;

    const { data: emailData, error: emailError } = await resend.emails.send({
      from: "ZoPro Notifications <noreply@email.zopro.app>",
      to: [recipientEmail],
      reply_to: company.email || undefined,
      subject: `Test Email from ${company.name || 'Your Company'} - Configuration Verified`,
      html: emailHtml,
    });

    if (emailError) {
      console.error("Email send error:", emailError);
      throw new Error("Failed to send test email: " + (emailError as any).message);
    }

    console.log("Test email sent successfully:", emailData);

    return new Response(
      JSON.stringify({ success: true, message: "Test email sent successfully" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in send-test-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to send test email" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
