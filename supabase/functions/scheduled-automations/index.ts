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
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const results = {
      expiredQuotes: 0,
      remindersSent: 0,
      lateFeesApplied: 0,
      errors: [] as string[],
    };

    console.log("Starting scheduled automations...");

    // Fetch all companies with their automation preferences
    const { data: companies, error: companiesError } = await supabase
      .from("companies")
      .select("id, name, email, auto_expire_quotes, auto_send_invoice_reminders, invoice_reminder_days, auto_apply_late_fees, late_fee_percentage");

    if (companiesError) {
      console.error("Error fetching companies:", companiesError);
      throw companiesError;
    }

    console.log(`Processing ${companies?.length || 0} companies`);

    for (const company of (companies || []) as Company[]) {
      try {
        // 1. Auto-expire quotes
        if (company.auto_expire_quotes) {
          const expiredCount = await autoExpireQuotes(supabase, company.id);
          results.expiredQuotes += expiredCount;
          console.log(`Company ${company.id}: Expired ${expiredCount} quotes`);
        }

        // 2. Auto-send invoice reminders
        if (company.auto_send_invoice_reminders) {
          const reminderCount = await sendInvoiceReminders(supabase, company, resend);
          results.remindersSent += reminderCount;
          console.log(`Company ${company.id}: Sent ${reminderCount} reminders`);
        }

        // 3. Auto-apply late fees
        if (company.auto_apply_late_fees && company.late_fee_percentage > 0) {
          const lateFeesCount = await applyLateFees(supabase, company);
          results.lateFeesApplied += lateFeesCount;
          console.log(`Company ${company.id}: Applied late fees to ${lateFeesCount} invoices`);
        }
      } catch (error: any) {
        console.error(`Error processing company ${company.id}:`, error);
        results.errors.push(`Company ${company.id}: ${error.message}`);
      }
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
  const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

  // Find overdue unpaid invoices that haven't been reminded in the last 7 days
  const { data: invoices, error } = await supabase
    .from("invoices")
    .select(`
      id,
      invoice_number,
      total,
      due_date,
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
        from: `${company.name} <onboarding@resend.dev>`,
        to: [customer.email],
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
