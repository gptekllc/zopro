import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-PAYMENT-NOTIFICATION] ${step}${detailsStr}`);
};

interface NotificationRequest {
  type: "invoice_paid" | "quote_approved" | "payment_failed";
  invoiceNumber?: string;
  quoteNumber?: string;
  customerName: string;
  customerEmail: string;
  companyName: string;
  companyEmail: string;
  amount?: number;
  errorMessage?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: NotificationRequest = await req.json();
    logStep("Received notification request", { type: payload.type });

    if (payload.type === "invoice_paid") {
      // Email to company about payment received
      const companyEmailResponse = await resend.emails.send({
        from: "FieldFlow <onboarding@resend.dev>",
        to: [payload.companyEmail],
        subject: `Payment Received - Invoice #${payload.invoiceNumber}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #16a34a;">Payment Received!</h1>
            <p>Great news! <strong>${payload.customerName}</strong> has paid Invoice #${payload.invoiceNumber}.</p>
            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0;"><strong>Amount:</strong> $${payload.amount?.toFixed(2)}</p>
              <p style="margin: 10px 0 0 0;"><strong>Customer:</strong> ${payload.customerName}</p>
            </div>
            <p>The invoice has been automatically marked as paid in your system.</p>
            <p style="color: #6b7280; font-size: 14px;">Best regards,<br>FieldFlow</p>
          </div>
        `,
      });
      logStep("Company email sent", { response: companyEmailResponse });

      // Email to customer confirming payment
      const customerEmailResponse = await resend.emails.send({
        from: "FieldFlow <onboarding@resend.dev>",
        to: [payload.customerEmail],
        subject: `Payment Confirmation - Invoice #${payload.invoiceNumber}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #16a34a;">Payment Confirmed!</h1>
            <p>Thank you for your payment to <strong>${payload.companyName}</strong>.</p>
            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0;"><strong>Invoice:</strong> #${payload.invoiceNumber}</p>
              <p style="margin: 10px 0 0 0;"><strong>Amount Paid:</strong> $${payload.amount?.toFixed(2)}</p>
            </div>
            <p>This email serves as your payment receipt.</p>
            <p style="color: #6b7280; font-size: 14px;">Thank you for your business!<br>${payload.companyName}</p>
          </div>
        `,
      });
      logStep("Customer email sent", { response: customerEmailResponse });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (payload.type === "quote_approved") {
      // Email to company about quote approval
      const companyEmailResponse = await resend.emails.send({
        from: "FieldFlow <onboarding@resend.dev>",
        to: [payload.companyEmail],
        subject: `Quote Approved - #${payload.quoteNumber}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #2563eb;">Quote Approved!</h1>
            <p><strong>${payload.customerName}</strong> has approved Quote #${payload.quoteNumber}.</p>
            <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 0;"><strong>Quote:</strong> #${payload.quoteNumber}</p>
              <p style="margin: 10px 0 0 0;"><strong>Customer:</strong> ${payload.customerName}</p>
              <p style="margin: 10px 0 0 0;"><strong>Email:</strong> ${payload.customerEmail}</p>
            </div>
            <p>You can now proceed with scheduling the work or converting this quote to an invoice.</p>
            <p style="color: #6b7280; font-size: 14px;">Best regards,<br>FieldFlow</p>
          </div>
        `,
      });
      logStep("Quote approval email sent to company", { response: companyEmailResponse });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (payload.type === "payment_failed") {
      // Email to customer about failed payment
      const customerEmailResponse = await resend.emails.send({
        from: "FieldFlow <onboarding@resend.dev>",
        to: [payload.customerEmail],
        subject: `Payment Issue - Invoice #${payload.invoiceNumber}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #dc2626;">Payment Could Not Be Processed</h1>
            <p>Hello ${payload.customerName},</p>
            <p>We were unable to process your payment for Invoice #${payload.invoiceNumber}.</p>
            <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc2626;">
              <p style="margin: 0;"><strong>Amount:</strong> $${payload.amount?.toFixed(2)}</p>
              <p style="margin: 10px 0 0 0;"><strong>Reason:</strong> ${payload.errorMessage || 'Payment declined'}</p>
            </div>
            <p>Please try again with a different payment method or contact us if you need assistance.</p>
            <p style="color: #6b7280; font-size: 14px;">Best regards,<br>${payload.companyName}</p>
          </div>
        `,
      });
      logStep("Failed payment email sent to customer", { response: customerEmailResponse });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    return new Response(JSON.stringify({ error: "Unknown notification type" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { error: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
