import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Company {
  id: string;
  name: string;
  email: string | null;
  auto_expire_quotes: boolean;
  auto_send_invoice_reminders: boolean;
  invoice_reminder_days: number;
  auto_apply_late_fees: boolean;
  late_fee_percentage: number;
  notify_on_automation_run: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if a specific company was requested (for manual runs)
    let requestedCompanyId: string | null = null;
    try {
      const body = await req.json();
      requestedCompanyId = body?.companyId || null;
    } catch {
      // No body or invalid JSON, run for all companies
    }

    const results = {
      expiredQuotes: 0,
      remindersSent: 0,
      lateFeesApplied: 0,
      trialReminders: { sevenDay: 0, oneDay: 0 },
      permanentlyDeleted: { jobs: 0, quotes: 0, invoices: 0, customers: 0 },
      errors: [] as string[],
    };

    console.log("Starting scheduled automations...", requestedCompanyId ? `for company ${requestedCompanyId}` : 'for all companies');

    // Fetch companies with their automation preferences
    let companiesQuery = supabase
      .from("companies")
      .select("id, name, email, auto_expire_quotes, auto_send_invoice_reminders, invoice_reminder_days, auto_apply_late_fees, late_fee_percentage, notify_on_automation_run");
    
    if (requestedCompanyId) {
      companiesQuery = companiesQuery.eq("id", requestedCompanyId);
    }

    const { data: companies, error: companiesError } = await companiesQuery;

    if (companiesError) {
      console.error("Error fetching companies:", companiesError);
      throw companiesError;
    }

    console.log(`Processing ${companies?.length || 0} companies`);

    for (const company of (companies || []) as Company[]) {
      const companyResults = {
        expiredQuotes: 0,
        remindersSent: 0,
        lateFeesApplied: 0,
      };

      try {
        // 1. Auto-expire quotes
        if (company.auto_expire_quotes) {
          const expiredCount = await autoExpireQuotes(supabase, company.id);
          companyResults.expiredQuotes = expiredCount;
          results.expiredQuotes += expiredCount;
          console.log(`Company ${company.id}: Expired ${expiredCount} quotes`);
        }

        // 2. Auto-send invoice reminders
        if (company.auto_send_invoice_reminders) {
          const reminderCount = await sendInvoiceReminders(supabase, company, resend);
          companyResults.remindersSent = reminderCount;
          results.remindersSent += reminderCount;
          console.log(`Company ${company.id}: Sent ${reminderCount} reminders`);
        }

        // 3. Auto-apply late fees
        if (company.auto_apply_late_fees && company.late_fee_percentage > 0) {
          const lateFeesCount = await applyLateFees(supabase, company);
          companyResults.lateFeesApplied = lateFeesCount;
          results.lateFeesApplied += lateFeesCount;
          console.log(`Company ${company.id}: Applied late fees to ${lateFeesCount} invoices`);
        }

        // 4. Send admin notification if enabled and there were any actions
        if (company.notify_on_automation_run && 
            (companyResults.expiredQuotes > 0 || companyResults.remindersSent > 0 || companyResults.lateFeesApplied > 0)) {
          await sendAdminNotification(supabase, company, companyResults);
        }
      } catch (error: any) {
        console.error(`Error processing company ${company.id}:`, error);
        results.errors.push(`Company ${company.id}: ${error.message}`);
      }
    }

    // 5. Send trial expiration reminders (global, not per-company filter)
    try {
      console.log("Checking for trial expiration reminders...");
      const trialReminderResults = await sendTrialExpirationReminders(supabase, resend);
      results.trialReminders = trialReminderResults;
      console.log(`Sent ${trialReminderResults.sevenDay} seven-day and ${trialReminderResults.oneDay} one-day trial reminders`);
    } catch (trialErr: any) {
      console.error("Error sending trial expiration reminders:", trialErr);
      results.errors.push(`Trial reminders: ${trialErr.message}`);
    }

    try {
      console.log("Running permanent deletion cleanup for soft-deleted records older than 6 months...");
      const { data: cleanupResult, error: cleanupError } = await supabase
        .rpc('permanent_delete_old_soft_deleted_records');
      
      if (cleanupError) {
        console.error("Error running permanent deletion cleanup:", cleanupError);
        results.errors.push(`Permanent deletion: ${cleanupError.message}`);
      } else if (cleanupResult && cleanupResult.length > 0) {
        const cleanup = cleanupResult[0];
        results.permanentlyDeleted = {
          jobs: cleanup.jobs_deleted || 0,
          quotes: cleanup.quotes_deleted || 0,
          invoices: cleanup.invoices_deleted || 0,
          customers: cleanup.customers_deleted || 0,
        };
        const total = cleanup.jobs_deleted + cleanup.quotes_deleted + cleanup.invoices_deleted + cleanup.customers_deleted;
        if (total > 0) {
          console.log(`Permanently deleted ${total} records (${cleanup.jobs_deleted} jobs, ${cleanup.quotes_deleted} quotes, ${cleanup.invoices_deleted} invoices, ${cleanup.customers_deleted} customers)`);
        } else {
          console.log("No soft-deleted records older than 6 months to permanently delete");
        }
      }
    } catch (cleanupErr: any) {
      console.error("Error in permanent deletion cleanup:", cleanupErr);
      results.errors.push(`Permanent deletion: ${cleanupErr.message}`);
    }

    console.log("Scheduled automations completed:", results);

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in scheduled-automations:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function autoExpireQuotes(supabase: any, companyId: string): Promise<number> {
  const today = new Date().toISOString().split('T')[0];

  // Find quotes that are sent/pending and past their valid_until date
  const { data: quotes, error } = await supabase
    .from("quotes")
    .update({ status: "expired" })
    .eq("company_id", companyId)
    .in("status", ["sent", "pending"])
    .lt("valid_until", today)
    .select("id");

  if (error) {
    console.error("Error expiring quotes:", error);
    throw error;
  }

  return quotes?.length || 0;
}

async function sendInvoiceReminders(supabase: any, company: Company, resendClient: any): Promise<number> {
  const reminderDays = company.invoice_reminder_days || 7;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - reminderDays);

  // Find overdue unpaid invoices
  const { data: invoices, error } = await supabase
    .from("invoices")
    .select(`
      id,
      invoice_number,
      total,
      due_date,
      status,
      customer_id,
      customers (
        id,
        name,
        email
      )
    `)
    .eq("company_id", company.id)
    .in("status", ["sent", "overdue"])
    .lt("due_date", new Date().toISOString().split('T')[0])
    .is("paid_at", null);

  if (error) {
    console.error("Error fetching invoices for reminders:", error);
    throw error;
  }

  let remindersSent = 0;

  for (const invoice of invoices || []) {
    const customer = invoice.customers;
    if (!customer?.email) continue;

    // Check if we've already sent a reminder recently
    const { data: recentReminders } = await supabase
      .from("invoice_reminders")
      .select("id")
      .eq("invoice_id", invoice.id)
      .gte("sent_at", cutoffDate.toISOString())
      .limit(1);

    if (recentReminders && recentReminders.length > 0) {
      console.log(`Skipping invoice ${invoice.invoice_number} - reminder already sent recently`);
      continue;
    }

    try {
      // Send reminder email
      const { error: emailError } = await resendClient.emails.send({
        from: "ZoPro Notifications <noreply@email.zopro.app>",
        to: [customer.email],
        reply_to: company.email || undefined,
        subject: `Payment Reminder: Invoice ${invoice.invoice_number}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Payment Reminder</h2>
            <p>Dear ${customer.name},</p>
            <p>This is a friendly reminder that invoice <strong>${invoice.invoice_number}</strong> is now overdue.</p>
            <p><strong>Amount Due:</strong> $${Number(invoice.total).toLocaleString()}</p>
            <p><strong>Due Date:</strong> ${new Date(invoice.due_date).toLocaleDateString()}</p>
            <p>Please arrange payment at your earliest convenience. If you have already made this payment, please disregard this notice.</p>
            <p>If you have any questions, please don't hesitate to contact us.</p>
            <p>Best regards,<br>${company.name}</p>
          </div>
        `,
      });

      if (emailError) {
        console.error(`Error sending reminder for invoice ${invoice.invoice_number}:`, emailError);
        continue;
      }

      // Record the reminder
      await supabase.from("invoice_reminders").insert({
        invoice_id: invoice.id,
        company_id: company.id,
        recipient_email: customer.email,
        sent_at: new Date().toISOString(),
      });

      // Update invoice status to overdue if it isn't already
      if (invoice.status !== "overdue") {
        await supabase
          .from("invoices")
          .update({ status: "overdue" })
          .eq("id", invoice.id);
      }

      remindersSent++;
      console.log(`Sent reminder for invoice ${invoice.invoice_number} to ${customer.email}`);
    } catch (err: any) {
      console.error(`Failed to send reminder for invoice ${invoice.invoice_number}:`, err);
    }
  }

  return remindersSent;
}

async function applyLateFees(supabase: any, company: Company): Promise<number> {
  const lateFeePercentage = company.late_fee_percentage || 0;
  if (lateFeePercentage <= 0) return 0;

  // Find overdue invoices without late fees applied
  const { data: invoices, error } = await supabase
    .from("invoices")
    .select("id, invoice_number, total, due_date, late_fee_amount")
    .eq("company_id", company.id)
    .in("status", ["sent", "overdue"])
    .lt("due_date", new Date().toISOString().split('T')[0])
    .is("paid_at", null)
    .or("late_fee_amount.is.null,late_fee_amount.eq.0");

  if (error) {
    console.error("Error fetching invoices for late fees:", error);
    throw error;
  }

  let feesApplied = 0;

  for (const invoice of invoices || []) {
    const lateFeeAmount = Number(invoice.total) * (lateFeePercentage / 100);

    const { error: updateError } = await supabase
      .from("invoices")
      .update({
        late_fee_amount: lateFeeAmount,
        late_fee_applied_at: new Date().toISOString(),
        status: "overdue",
      })
      .eq("id", invoice.id);

    if (updateError) {
      console.error(`Error applying late fee to invoice ${invoice.invoice_number}:`, updateError);
      continue;
    }

    feesApplied++;
    console.log(`Applied late fee of $${lateFeeAmount.toFixed(2)} to invoice ${invoice.invoice_number}`);
  }

  return feesApplied;
}

async function sendAdminNotification(
  supabase: any, 
  company: Company, 
  results: { expiredQuotes: number; remindersSent: number; lateFeesApplied: number }
): Promise<void> {
  // Find admin users for this company
  const { data: admins, error: adminsError } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("company_id", company.id)
    .eq("role", "admin")
    .is("deleted_at", null);

  if (adminsError || !admins || admins.length === 0) {
    console.log(`No admins found for company ${company.id}`);
    return;
  }

  // Build notification message
  const actions = [];
  if (results.expiredQuotes > 0) {
    actions.push(`${results.expiredQuotes} quote${results.expiredQuotes > 1 ? 's' : ''} expired`);
  }
  if (results.remindersSent > 0) {
    actions.push(`${results.remindersSent} payment reminder${results.remindersSent > 1 ? 's' : ''} sent`);
  }
  if (results.lateFeesApplied > 0) {
    actions.push(`Late fees applied to ${results.lateFeesApplied} invoice${results.lateFeesApplied > 1 ? 's' : ''}`);
  }

  const message = actions.join('. ') + '.';

  // Create notifications for each admin
  for (const admin of admins) {
    try {
      await supabase.from("notifications").insert({
        user_id: admin.id,
        type: "automation",
        title: "Automations Completed",
        message: message,
        data: { results },
      });
      console.log(`Sent automation notification to admin ${admin.id}`);
    } catch (err) {
      console.error(`Failed to create notification for admin ${admin.id}:`, err);
    }
  }
}

async function sendTrialExpirationReminders(
  supabase: any, 
  resendClient: any
): Promise<{ sevenDay: number; oneDay: number }> {
  const results = { sevenDay: 0, oneDay: 0 };
  const now = new Date();
  const baseUrl = Deno.env.get("APP_BASE_URL") || "https://zopro.lovable.app";

  // Calculate date ranges for 7-day and 1-day reminders
  const sevenDaysFromNow = new Date(now);
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
  const sevenDayStart = sevenDaysFromNow.toISOString().split('T')[0];
  const sevenDayEnd = new Date(sevenDaysFromNow);
  sevenDayEnd.setDate(sevenDayEnd.getDate() + 1);

  const oneDayFromNow = new Date(now);
  oneDayFromNow.setDate(oneDayFromNow.getDate() + 1);
  const oneDayStart = oneDayFromNow.toISOString().split('T')[0];
  const oneDayEnd = new Date(oneDayFromNow);
  oneDayEnd.setDate(oneDayEnd.getDate() + 1);

  // Find trialing subscriptions expiring in 7 days
  const { data: sevenDayTrials, error: sevenDayError } = await supabase
    .from("company_subscriptions")
    .select(`
      id,
      company_id,
      trial_ends_at,
      companies (
        id,
        name
      )
    `)
    .eq("status", "trialing")
    .gte("trial_ends_at", sevenDayStart)
    .lt("trial_ends_at", sevenDayEnd.toISOString().split('T')[0]);

  if (sevenDayError) {
    console.error("Error fetching 7-day trial expirations:", sevenDayError);
  }

  // Find trialing subscriptions expiring in 1 day
  const { data: oneDayTrials, error: oneDayError } = await supabase
    .from("company_subscriptions")
    .select(`
      id,
      company_id,
      trial_ends_at,
      companies (
        id,
        name
      )
    `)
    .eq("status", "trialing")
    .gte("trial_ends_at", oneDayStart)
    .lt("trial_ends_at", oneDayEnd.toISOString().split('T')[0]);

  if (oneDayError) {
    console.error("Error fetching 1-day trial expirations:", oneDayError);
  }

  // Send 7-day reminder emails
  for (const subscription of sevenDayTrials || []) {
    const company = subscription.companies;
    if (!company) continue;

    const sent = await sendTrialReminderToAdmins(
      supabase,
      resendClient,
      company.id,
      company.name,
      subscription.trial_ends_at,
      7,
      baseUrl
    );
    if (sent) results.sevenDay++;
  }

  // Send 1-day reminder emails
  for (const subscription of oneDayTrials || []) {
    const company = subscription.companies;
    if (!company) continue;

    const sent = await sendTrialReminderToAdmins(
      supabase,
      resendClient,
      company.id,
      company.name,
      subscription.trial_ends_at,
      1,
      baseUrl
    );
    if (sent) results.oneDay++;
  }

  return results;
}

async function sendTrialReminderToAdmins(
  supabase: any,
  resendClient: any,
  companyId: string,
  companyName: string,
  trialEndsAt: string,
  daysRemaining: number,
  baseUrl: string
): Promise<boolean> {
  // Get admin emails for this company
  const { data: admins, error: adminsError } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .eq("company_id", companyId)
    .eq("role", "admin")
    .is("deleted_at", null);

  if (adminsError || !admins || admins.length === 0) {
    console.log(`No admins found for company ${companyId}`);
    return false;
  }

  const trialEndDate = new Date(trialEndsAt).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const urgencyColor = daysRemaining === 1 ? '#dc2626' : '#f59e0b';
  const urgencyText = daysRemaining === 1 ? 'URGENT: ' : '';

  let emailsSent = false;

  for (const admin of admins) {
    if (!admin.email) continue;

    try {
      const { error: emailError } = await resendClient.emails.send({
        from: "ZoPro <noreply@email.zopro.app>",
        to: [admin.email],
        subject: `${urgencyText}Your ZoPro trial expires in ${daysRemaining} day${daysRemaining > 1 ? 's' : ''}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="text-align: center; margin-bottom: 30px;">
              <h1 style="color: #1f2937; margin: 0;">ZoPro</h1>
            </div>
            
            <div style="background-color: ${urgencyColor}; color: white; padding: 15px 20px; border-radius: 8px; margin-bottom: 25px; text-align: center;">
              <h2 style="margin: 0; font-size: 18px;">
                ⏰ Your free trial expires in ${daysRemaining} day${daysRemaining > 1 ? 's' : ''}
              </h2>
            </div>

            <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
              Hi ${admin.full_name || 'there'},
            </p>

            <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
              Your free trial for <strong>${companyName}</strong> will end on <strong>${trialEndDate}</strong>.
            </p>

            <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
              To continue using ZoPro and keep access to all your data, jobs, invoices, and customer information, please upgrade to a paid plan before your trial expires.
            </p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="${baseUrl}/subscription" 
                 style="background-color: #2563eb; color: white; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 16px; display: inline-block;">
                Upgrade Now
              </a>
            </div>

            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 25px 0;">
              <h3 style="color: #1f2937; margin-top: 0;">What you'll keep with a paid plan:</h3>
              <ul style="color: #4b5563; line-height: 1.8; margin: 0; padding-left: 20px;">
                <li>All your jobs, quotes, and invoices</li>
                <li>Customer database and history</li>
                <li>Team member access</li>
                <li>Photo storage and documents</li>
                <li>Automated reminders and notifications</li>
              </ul>
            </div>

            <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
              Have questions? Just reply to this email and we'll be happy to help.
            </p>

            <p style="color: #4b5563; font-size: 16px; line-height: 1.6;">
              Thank you for trying ZoPro!<br>
              <strong>The ZoPro Team</strong>
            </p>

            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            
            <p style="color: #9ca3af; font-size: 12px; text-align: center;">
              You're receiving this email because you're an admin of ${companyName} on ZoPro.
            </p>
          </div>
        `,
      });

      if (emailError) {
        console.error(`Error sending trial reminder to ${admin.email}:`, emailError);
        continue;
      }

      console.log(`Sent ${daysRemaining}-day trial reminder to ${admin.email} for company ${companyName}`);
      emailsSent = true;

      // Create in-app notification as well
      await supabase.from("notifications").insert({
        user_id: admin.id,
        type: "trial_expiring",
        title: `Trial expires in ${daysRemaining} day${daysRemaining > 1 ? 's' : ''}`,
        message: `Your free trial will end on ${trialEndDate}. Upgrade now to keep your data.`,
        data: { companyId, trialEndsAt, daysRemaining },
      });
    } catch (err: any) {
      console.error(`Failed to send trial reminder to ${admin.email}:`, err);
    }
  }

  return emailsSent;
}
