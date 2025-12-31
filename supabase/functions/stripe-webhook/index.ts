import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2025-08-27.basil",
});

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Webhook received");
    
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      logStep("ERROR: No stripe signature");
      return new Response("No signature", { status: 400 });
    }

    const body = await req.text();
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    
    if (!webhookSecret) {
      logStep("ERROR: Webhook secret not configured");
      return new Response("Webhook secret not configured", { status: 500 });
    }

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
      logStep("Event verified", { type: event.type });
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      logStep("ERROR: Signature verification failed", { error: errorMessage });
      return new Response(`Webhook signature verification failed: ${errorMessage}`, { status: 400 });
    }

    // Handle checkout.session.completed event
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      logStep("Processing checkout.session.completed", { sessionId: session.id });

      // Extract invoice ID from metadata
      const invoiceId = session.metadata?.invoice_id;
      
      if (invoiceId) {
        logStep("Found invoice ID in metadata", { invoiceId });
        
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        
        // Update invoice status to paid
        const { data: invoice, error: updateError } = await supabase
          .from("invoices")
          .update({
            status: "paid",
            paid_at: new Date().toISOString(),
          })
          .eq("id", invoiceId)
          .select(`
            *,
            customers (name, email),
            companies (name, email)
          `)
          .single();

        if (updateError) {
          logStep("ERROR: Failed to update invoice", { error: updateError.message });
          return new Response(`Failed to update invoice: ${updateError.message}`, { status: 500 });
        }

        logStep("Invoice marked as paid", { invoiceId, invoiceNumber: invoice.invoice_number });

        // Send email notification for payment received
        if (invoice.customers?.email && invoice.companies?.email) {
          try {
            const notificationResponse = await fetch(`${supabaseUrl}/functions/v1/send-payment-notification`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({
                type: "invoice_paid",
                invoiceNumber: invoice.invoice_number,
                customerName: invoice.customers.name,
                customerEmail: invoice.customers.email,
                companyName: invoice.companies.name,
                companyEmail: invoice.companies.email,
                amount: invoice.total,
              }),
            });
            logStep("Payment notification sent", { status: notificationResponse.status });
          } catch (notifyError: unknown) {
            const errorMessage = notifyError instanceof Error ? notifyError.message : String(notifyError);
            logStep("WARNING: Failed to send notification", { error: errorMessage });
            // Don't fail the webhook for notification errors
          }
        }
      } else {
        logStep("No invoice_id in session metadata - may be a different payment type");
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR: Unexpected error", { error: errorMessage });
    return new Response(`Webhook error: ${errorMessage}`, {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
