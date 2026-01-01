import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

interface WeeklyStats {
  totalRevenue: number;
  paidInvoices: number;
  pendingInvoices: number;
  approvedQuotes: number;
  pendingQuotes: number;
  completedJobs: number;
  scheduledJobs: number;
  newCustomers: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Calculate date range (last 7 days)
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const weekAgoISO = weekAgo.toISOString();
    
    console.log("Generating weekly digest from", weekAgoISO, "to", now.toISOString());
    
    // Get all companies
    const { data: companies, error: companiesError } = await supabase
      .from("companies")
      .select("id, name");
    
    if (companiesError) throw companiesError;
    
    for (const company of companies || []) {
      console.log(`Processing company: ${company.name}`);
      
      // Get admin users for this company
      const { data: admins } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .eq("company_id", company.id)
        .in("role", ["admin", "manager"]);
      
      if (!admins || admins.length === 0) {
        console.log("No admins found for company:", company.name);
        continue;
      }
      
      // Fetch weekly stats
      const stats: WeeklyStats = {
        totalRevenue: 0,
        paidInvoices: 0,
        pendingInvoices: 0,
        approvedQuotes: 0,
        pendingQuotes: 0,
        completedJobs: 0,
        scheduledJobs: 0,
        newCustomers: 0,
      };
      
      // Paid invoices this week
      const { data: paidInvoices } = await supabase
        .from("invoices")
        .select("total, status")
        .eq("company_id", company.id)
        .eq("status", "paid")
        .gte("paid_at", weekAgoISO);
      
      if (paidInvoices) {
        stats.paidInvoices = paidInvoices.length;
        stats.totalRevenue = paidInvoices.reduce((sum, inv) => sum + Number(inv.total), 0);
      }
      
      // Pending invoices
      const { data: pendingInvoices } = await supabase
        .from("invoices")
        .select("id")
        .eq("company_id", company.id)
        .in("status", ["draft", "sent"]);
      
      stats.pendingInvoices = pendingInvoices?.length || 0;
      
      // Approved quotes this week
      const { data: approvedQuotes } = await supabase
        .from("quotes")
        .select("id")
        .eq("company_id", company.id)
        .eq("status", "approved")
        .gte("updated_at", weekAgoISO);
      
      stats.approvedQuotes = approvedQuotes?.length || 0;
      
      // Pending quotes
      const { data: pendingQuotes } = await supabase
        .from("quotes")
        .select("id")
        .eq("company_id", company.id)
        .in("status", ["draft", "sent"]);
      
      stats.pendingQuotes = pendingQuotes?.length || 0;
      
      // Completed jobs this week
      const { data: completedJobs } = await supabase
        .from("jobs")
        .select("id")
        .eq("company_id", company.id)
        .eq("status", "completed")
        .gte("updated_at", weekAgoISO);
      
      stats.completedJobs = completedJobs?.length || 0;
      
      // Scheduled jobs (upcoming)
      const { data: scheduledJobs } = await supabase
        .from("jobs")
        .select("id")
        .eq("company_id", company.id)
        .eq("status", "scheduled");
      
      stats.scheduledJobs = scheduledJobs?.length || 0;
      
      // New customers this week
      const { data: newCustomers } = await supabase
        .from("customers")
        .select("id")
        .eq("company_id", company.id)
        .gte("created_at", weekAgoISO);
      
      stats.newCustomers = newCustomers?.length || 0;
      
      // Format dates for email
      const weekStart = weekAgo.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      const weekEnd = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      
      // Send email to each admin
      for (const admin of admins) {
        const htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
              .header { background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { padding: 30px; background: #f9fafb; }
              .stats-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin: 20px 0; }
              .stat-card { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); text-align: center; }
              .stat-value { font-size: 28px; font-weight: bold; color: #3b82f6; }
              .stat-label { font-size: 14px; color: #6b7280; margin-top: 5px; }
              .revenue-card { background: linear-gradient(135deg, #10b981, #059669); color: white; grid-column: span 2; }
              .revenue-card .stat-value { color: white; font-size: 36px; }
              .revenue-card .stat-label { color: rgba(255,255,255,0.9); }
              .footer { text-align: center; padding: 20px; color: #6b7280; font-size: 12px; }
              .section-title { font-size: 18px; font-weight: bold; margin: 20px 0 10px; color: #1f2937; }
            </style>
          </head>
          <body>
            <div class="header">
              <h1 style="margin: 0;">📊 Weekly Digest</h1>
              <p style="margin: 10px 0 0; opacity: 0.9;">${weekStart} - ${weekEnd}</p>
            </div>
            <div class="content">
              <p>Hi ${admin.full_name || "there"},</p>
              <p>Here's your weekly summary for <strong>${company.name}</strong>:</p>
              
              <div class="stats-grid">
                <div class="stat-card revenue-card">
                  <div class="stat-value">$${stats.totalRevenue.toLocaleString("en-US", { minimumFractionDigits: 2 })}</div>
                  <div class="stat-label">Total Revenue This Week</div>
                </div>
                
                <div class="stat-card">
                  <div class="stat-value">${stats.paidInvoices}</div>
                  <div class="stat-label">Invoices Paid</div>
                </div>
                
                <div class="stat-card">
                  <div class="stat-value">${stats.pendingInvoices}</div>
                  <div class="stat-label">Pending Invoices</div>
                </div>
                
                <div class="stat-card">
                  <div class="stat-value">${stats.approvedQuotes}</div>
                  <div class="stat-label">Quotes Approved</div>
                </div>
                
                <div class="stat-card">
                  <div class="stat-value">${stats.pendingQuotes}</div>
                  <div class="stat-label">Pending Quotes</div>
                </div>
                
                <div class="stat-card">
                  <div class="stat-value">${stats.completedJobs}</div>
                  <div class="stat-label">Jobs Completed</div>
                </div>
                
                <div class="stat-card">
                  <div class="stat-value">${stats.scheduledJobs}</div>
                  <div class="stat-label">Jobs Scheduled</div>
                </div>
                
                <div class="stat-card" style="grid-column: span 2;">
                  <div class="stat-value">${stats.newCustomers}</div>
                  <div class="stat-label">New Customers</div>
                </div>
              </div>
              
              <p style="margin-top: 30px;">Keep up the great work! 🚀</p>
            </div>
            <div class="footer">
              <p>This is an automated weekly digest from your business management system.</p>
            </div>
          </body>
          </html>
        `;
        
        try {
          const emailResult = await resend.emails.send({
            from: "Weekly Digest <onboarding@resend.dev>",
            to: [admin.email],
            subject: `📊 Weekly Digest: ${weekStart} - ${weekEnd}`,
            html: htmlContent,
          });
          
          console.log(`Sent weekly digest to ${admin.email}:`, emailResult);
        } catch (emailError) {
          console.error(`Failed to send email to ${admin.email}:`, emailError);
        }
      }
    }
    
    return new Response(
      JSON.stringify({ success: true, message: "Weekly digests sent" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in weekly-digest:", error);
    // Return sanitized error message to client - don't expose internal details
    return new Response(
      JSON.stringify({ error: "Failed to generate weekly digest. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
