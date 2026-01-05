import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TechnicianData {
  name: string;
  role: string;
  jobsCompleted: number;
  hoursWorked: string;
  revenueGenerated: string;
  effectiveRate: string;
}

interface ReportStats {
  teamSize: number;
  totalJobs: number;
  totalHours: string;
  totalRevenue: string;
}

interface ReportData {
  title: string;
  timeRange: string;
  generatedAt: string;
  stats: ReportStats;
  technicians: TechnicianData[];
}

interface SendReportEmailRequest {
  to: string;
  reportType: 'technician-performance' | 'monthly-summary' | 'customer-revenue';
  reportData: ReportData;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, reportType, reportData }: SendReportEmailRequest = await req.json();

    console.log(`Sending ${reportType} report to ${to}`);

    let subject = '';
    let html = '';

    if (reportType === 'technician-performance') {
      subject = `Technician Performance Report - ${reportData.timeRange}`;
      
      const technicianRows = reportData.technicians.map(t => `
        <tr>
          <td style="border: 1px solid #e5e7eb; padding: 12px; text-align: left;">${t.name}</td>
          <td style="border: 1px solid #e5e7eb; padding: 12px; text-align: center;">${t.role}</td>
          <td style="border: 1px solid #e5e7eb; padding: 12px; text-align: right;">${t.jobsCompleted}</td>
          <td style="border: 1px solid #e5e7eb; padding: 12px; text-align: right;">${t.hoursWorked}h</td>
          <td style="border: 1px solid #e5e7eb; padding: 12px; text-align: right; color: #16a34a; font-weight: 600;">$${t.revenueGenerated}</td>
          <td style="border: 1px solid #e5e7eb; padding: 12px; text-align: right;">$${t.effectiveRate}/hr</td>
        </tr>
      `).join('');

      html = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1f2937; background-color: #f9fafb; margin: 0; padding: 20px;">
          <div style="max-width: 800px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); overflow: hidden;">
            <!-- Header -->
            <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); padding: 32px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700;">${reportData.title}</h1>
              <p style="color: rgba(255, 255, 255, 0.9); margin: 8px 0 0 0; font-size: 16px;">${reportData.timeRange}</p>
            </div>

            <!-- Summary Cards -->
            <div style="padding: 32px;">
              <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 32px;">
                <div style="background-color: #f3f4f6; border-radius: 8px; padding: 16px; text-align: center;">
                  <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Team Members</div>
                  <div style="font-size: 28px; font-weight: 700; color: #1f2937;">${reportData.stats.teamSize}</div>
                </div>
                <div style="background-color: #f3f4f6; border-radius: 8px; padding: 16px; text-align: center;">
                  <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Total Jobs</div>
                  <div style="font-size: 28px; font-weight: 700; color: #1f2937;">${reportData.stats.totalJobs}</div>
                </div>
                <div style="background-color: #f3f4f6; border-radius: 8px; padding: 16px; text-align: center;">
                  <div style="font-size: 12px; color: #6b7280; text-transform: uppercase; letter-spacing: 0.5px;">Total Hours</div>
                  <div style="font-size: 28px; font-weight: 700; color: #1f2937;">${reportData.stats.totalHours}</div>
                </div>
                <div style="background-color: #dcfce7; border-radius: 8px; padding: 16px; text-align: center;">
                  <div style="font-size: 12px; color: #16a34a; text-transform: uppercase; letter-spacing: 0.5px;">Total Revenue</div>
                  <div style="font-size: 28px; font-weight: 700; color: #16a34a;">$${reportData.stats.totalRevenue}</div>
                </div>
              </div>

              <!-- Team Table -->
              <h2 style="font-size: 18px; font-weight: 600; color: #1f2937; margin-bottom: 16px;">Team Performance</h2>
              <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <thead>
                  <tr style="background-color: #f3f4f6;">
                    <th style="border: 1px solid #e5e7eb; padding: 12px; text-align: left; font-weight: 600;">Team Member</th>
                    <th style="border: 1px solid #e5e7eb; padding: 12px; text-align: center; font-weight: 600;">Role</th>
                    <th style="border: 1px solid #e5e7eb; padding: 12px; text-align: right; font-weight: 600;">Jobs</th>
                    <th style="border: 1px solid #e5e7eb; padding: 12px; text-align: right; font-weight: 600;">Hours</th>
                    <th style="border: 1px solid #e5e7eb; padding: 12px; text-align: right; font-weight: 600;">Revenue</th>
                    <th style="border: 1px solid #e5e7eb; padding: 12px; text-align: right; font-weight: 600;">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  ${technicianRows}
                </tbody>
              </table>
            </div>

            <!-- Footer -->
            <div style="background-color: #f3f4f6; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 12px;">
                Generated on ${reportData.generatedAt}
              </p>
            </div>
          </div>
        </body>
        </html>
      `;
    } else {
      // Generic report type
      subject = `${reportData.title} - ${reportData.timeRange}`;
      html = `
        <h1>${reportData.title}</h1>
        <p>Time Range: ${reportData.timeRange}</p>
        <p>Generated: ${reportData.generatedAt}</p>
        <pre>${JSON.stringify(reportData.stats, null, 2)}</pre>
      `;
    }

    const emailResponse = await resend.emails.send({
      from: "Reports <onboarding@resend.dev>",
      to: [to],
      subject,
      html,
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify(emailResponse), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ...corsHeaders,
      },
    });
  } catch (error: any) {
    console.error("Error in send-report-email function:", error);
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
