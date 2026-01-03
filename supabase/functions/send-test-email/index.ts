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

interface SocialLink {
  platform_name: string;
  url: string;
  icon_url: string | null;
  show_on_email: boolean;
}

// Default platform icons - inline SVG data URIs
const PLATFORM_ICONS: Record<string, string> = {
  facebook: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>')}`,
  instagram: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#E4405F"><path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0z"/></svg>')}`,
  linkedin: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#0A66C2"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>')}`,
  twitter: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#1DA1F2"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/></svg>')}`,
  x: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#000000"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>')}`,
  youtube: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#FF0000"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>')}`,
  tiktok: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#000000"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>')}`,
  whatsapp: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>')}`,
  messenger: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#0084FF"><path d="M.001 11.639C.001 4.949 5.241 0 12.001 0S24 4.95 24 11.639c0 6.689-5.24 11.638-12 11.638-1.21 0-2.38-.16-3.47-.46a.96.96 0 00-.64.05l-2.39 1.05a.96.96 0 01-1.35-.85l-.07-2.14a.97.97 0 00-.32-.68A11.39 11.389 0 01.002 11.64z"/></svg>')}`,
  telegram: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#0088CC"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0z"/></svg>')}`,
  viber: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#7360F2"><circle cx="12" cy="12" r="10"/></svg>')}`,
  threads: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#000000"><circle cx="12" cy="12" r="10"/></svg>')}`,
  pinterest: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#BD081C"><circle cx="12" cy="12" r="10"/></svg>')}`,
  google: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>')}`,
  thumbtack: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#009FD9"><circle cx="12" cy="12" r="10"/></svg>')}`,
  yelp: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#D32323"><circle cx="12" cy="12" r="10"/></svg>')}`,
  angi: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#FF6153"><circle cx="12" cy="12" r="10"/></svg>')}`,
  homeadvisor: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#F68315"><path d="M12 2L2 9l1.5 1V20h6v-6h5v6h6V10l1.5-1L12 2z"/></svg>')}`,
  bbb: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#005A8C"><rect x="3.75" y="3" width="16.5" height="18" rx="1"/></svg>')}`,
  nextdoor: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#8ED500"><circle cx="12" cy="12" r="10"/></svg>')}`,
  networx: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#00B2A9"><path d="M12 2L2 7v10l10 5 10-5V7L12 2z"/></svg>')}`,
  houzz: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#4DBC15"><path d="M.5.5v23h12.5V12H5.5V.5H.5zm6.5 12v11h16.5v-23H18v12H7z"/></svg>')}`,
  craftjack: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#FF6B35"><rect x="5" y="3" width="14" height="18" rx="2"/></svg>')}`,
  porch: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#00C16E"><path d="M12 3L2 9v12h20V9L12 3z"/></svg>')}`,
};

function getDefaultPlatformIcon(platformName: string): string | null {
  const normalized = platformName.toLowerCase().trim();
  if (PLATFORM_ICONS[normalized]) return PLATFORM_ICONS[normalized];
  for (const [key, icon] of Object.entries(PLATFORM_ICONS)) {
    if (normalized.includes(key)) return icon;
  }
  return null;
}

function generateSocialIconsHtml(socialLinks: SocialLink[]): string {
  const visibleLinks = socialLinks.filter(link => link.show_on_email);

  if (visibleLinks.length === 0) return '';

  const iconsHtml = visibleLinks.map(link => {
    const iconUrl = link.icon_url || getDefaultPlatformIcon(link.platform_name);
    if (iconUrl) {
      return `<a href="${link.url}" style="display: inline-block; margin-right: 12px; text-decoration: none;" title="${link.platform_name}">
        <img src="${iconUrl}" alt="${link.platform_name}" style="width: 24px; height: 24px; object-fit: contain; vertical-align: middle;" />
      </a>`;
    } else {
      return `<a href="${link.url}" style="color: #2563eb; text-decoration: none; margin-right: 12px;">${link.platform_name}</a>`;
    }
  }).join('');

  return `<div style="margin-top: 10px;">${iconsHtml}</div>`;
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
      .select("name, email, phone, address, city, state, zip, logo_url, website")
      .eq("id", companyId)
      .single();

    if (companyError) {
      console.error("Company fetch error:", companyError);
      throw new Error("Failed to fetch company details");
    }

    // Fetch social links
    const { data: socialLinks, error: socialLinksError } = await supabase
      .from("company_social_links")
      .select("platform_name, url, icon_url, show_on_email")
      .eq("company_id", companyId)
      .order("display_order");

    if (socialLinksError) {
      console.error("Social links fetch error:", socialLinksError);
    }

    console.log("Company details:", company);
    console.log(`Found ${socialLinks?.length || 0} social links`);

    const socialIconsHtml = generateSocialIconsHtml(socialLinks || []);
    const socialLinksListHtml = (socialLinks || []).filter(l => l.show_on_email).map(link => 
      `<span style="margin-right: 15px;">${link.platform_name}: <a href="${link.url}" style="color: #2563eb;">${link.url}</a></span>`
    ).join('');

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
              ${socialLinksListHtml ? `<div class="info-row" style="margin-top: 10px;"><span class="info-label">Social Media:</span><br/>${socialLinksListHtml}</div>` : ''}
            </div>

            <div class="footer">
              <p>This test email was sent from ZoPro.</p>
              ${company.website ? `<p><a href="${company.website}">${company.website}</a></p>` : ''}
              ${socialIconsHtml}
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