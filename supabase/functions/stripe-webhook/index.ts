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

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  let logEntryId: string | null = null;
  const startTime = Date.now();

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

    // Log the webhook event to database
    try {
      const { data: logEntry } = await supabase
        .from("webhook_event_logs")
        .insert({
          provider: "stripe",
          event_type: event.type,
          event_id: event.id,
          status: "processing",
          payload: { id: event.id, type: event.type, created: event.created },
        })
        .select("id")
        .single();
      
      if (logEntry) {
        logEntryId = logEntry.id;
      }
    } catch (logErr) {
      // Don't fail the webhook if logging fails
      logStep("WARNING: Failed to log webhook event", { error: String(logErr) });
    }

    // Handle checkout.session.completed event
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      logStep("Processing checkout.session.completed", { sessionId: session.id });

      const invoiceId = session.metadata?.invoice_id;
      
      if (invoiceId) {
        logStep("Found invoice ID in metadata", { invoiceId });
        
        // Get invoice details first
        const { data: invoice, error: invoiceError } = await supabase
          .from("invoices")
          .select(`
            *,
            customers (id, name, email),
            companies (name, email, id)
          `)
          .eq("id", invoiceId)
          .single();

        if (invoiceError || !invoice) {
          logStep("ERROR: Failed to fetch invoice", { error: invoiceError?.message });
          return new Response(`Failed to fetch invoice: ${invoiceError?.message}`, { status: 500 });
        }

        // Get payment amount from session
        const paymentAmount = session.amount_total ? session.amount_total / 100 : Number(invoice.total);
        const stripePaymentIntentId = typeof session.payment_intent === 'string' 
          ? session.payment_intent 
          : session.payment_intent?.id || null;

        logStep("Payment details", { paymentAmount, stripePaymentIntentId });

        // Create payment record in payments table
        const { data: newPayment, error: paymentError } = await supabase
          .from("payments")
          .insert({
            invoice_id: invoiceId,
            company_id: invoice.company_id,
            amount: paymentAmount,
            method: "credit_debit", // Stripe payments are card payments
            payment_date: new Date().toISOString(),
            notes: `Stripe payment (${stripePaymentIntentId || session.id})`,
            status: "completed",
          })
          .select()
          .single();

        if (paymentError) {
          logStep("WARNING: Failed to create payment record", { error: paymentError.message });
        } else {
          logStep("Payment record created", { paymentId: newPayment.id, amount: paymentAmount });
        }

        // Get all completed payments to calculate totals
        const { data: allPayments } = await supabase
          .from("payments")
          .select("amount, status")
          .eq("invoice_id", invoiceId)
          .eq("status", "completed");

        const totalPaid = (allPayments || []).reduce((sum, p) => sum + Number(p.amount), 0);
        const totalDue = Number(invoice.total) + Number(invoice.late_fee_amount || 0);
        const isFullyPaid = totalPaid >= totalDue;
        const hasPartialPayment = totalPaid > 0 && totalPaid < totalDue;

        logStep("Payment totals", { totalPaid, totalDue, isFullyPaid, hasPartialPayment });

        // Update invoice status based on payment totals
        const newStatus = isFullyPaid ? "paid" : hasPartialPayment ? "partially_paid" : invoice.status;
        const paidAt = isFullyPaid ? new Date().toISOString() : null;

        const { error: updateError } = await supabase
          .from("invoices")
          .update({
            status: newStatus,
            paid_at: paidAt,
          })
          .eq("id", invoiceId);

        if (updateError) {
          logStep("ERROR: Failed to update invoice status", { error: updateError.message });
        } else {
          logStep("Invoice status updated", { invoiceId, status: newStatus });
        }

        // Auto-sync job status to 'paid' if fully paid and there's a linked job
        if (isFullyPaid && invoice.quote_id) {
          const { data: linkedJobs, error: jobsError } = await supabase
            .from("jobs")
            .select("id, job_number")
            .eq("quote_id", invoice.quote_id)
            .in("status", ["completed", "invoiced"]);

          if (!jobsError && linkedJobs && linkedJobs.length > 0) {
            for (const job of linkedJobs) {
              const { error: jobUpdateError } = await supabase
                .from("jobs")
                .update({ status: "paid" })
                .eq("id", job.id);

              if (jobUpdateError) {
                logStep("WARNING: Failed to update job status", { jobId: job.id, error: jobUpdateError.message });
              } else {
                logStep("Job status synced to paid", { jobId: job.id, jobNumber: job.job_number });
              }
            }
          }
        }

        // Create notification for admins
        const { data: admins } = await supabase
          .from("profiles")
          .select("id")
          .eq("company_id", invoice.companies?.id)
          .in("role", ["admin", "manager"]);

        if (admins && admins.length > 0) {
          const remainingBalance = Math.max(0, totalDue - totalPaid);
          const notificationMessage = isFullyPaid
            ? `${invoice.customers?.name} paid Invoice #${invoice.invoice_number} in full - $${paymentAmount.toFixed(2)}`
            : `${invoice.customers?.name} made a payment of $${paymentAmount.toFixed(2)} on Invoice #${invoice.invoice_number} ($${remainingBalance.toFixed(2)} remaining)`;
          
          const notifications = admins.map((admin) => ({
            user_id: admin.id,
            type: "payment_received",
            title: isFullyPaid ? "Invoice Paid in Full" : "Partial Payment Received",
            message: notificationMessage,
            data: { 
              invoiceId, 
              invoiceNumber: invoice.invoice_number, 
              amount: paymentAmount, 
              customerName: invoice.customers?.name,
              isFullyPaid,
              remainingBalance,
            },
          }));
          
          await supabase.from("notifications").insert(notifications);
          logStep("Admin notifications created", { count: notifications.length });
        }

        // Send email notification
        if (invoice.customers?.email && invoice.companies?.email) {
          try {
            const remainingBalance = Math.max(0, totalDue - totalPaid);
            await fetch(`${supabaseUrl}/functions/v1/send-payment-notification`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({
                type: isFullyPaid ? "invoice_paid" : "payment_recorded",
                invoiceNumber: invoice.invoice_number,
                customerName: invoice.customers.name,
                customerEmail: invoice.customers.email,
                customerId: invoice.customers.id,
                companyName: invoice.companies.name,
                companyEmail: invoice.companies.email,
                companyId: invoice.company_id,
                amount: isFullyPaid ? invoice.total : undefined,
                paymentAmount,
                paymentMethod: "credit_debit",
                totalPaid,
                totalDue,
                remainingBalance,
                isFullyPaid,
              }),
            });
            logStep("Payment notification email sent");
          } catch (notifyError: unknown) {
            const errorMessage = notifyError instanceof Error ? notifyError.message : String(notifyError);
            logStep("WARNING: Failed to send notification email", { error: errorMessage });
          }
        }
      } else {
        logStep("No invoice_id in session metadata - may be a different payment type");
      }
    }

    // Handle customer.subscription.created - new subscription
    if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
      const subscription = event.data.object as Stripe.Subscription;
      logStep(`Processing ${event.type}`, { subscriptionId: subscription.id });

      const stripeCustomerId = typeof subscription.customer === 'string' 
        ? subscription.customer 
        : subscription.customer.id;

      // Get customer email to find company
      const customer = await stripe.customers.retrieve(stripeCustomerId);
      if (customer.deleted) {
        logStep("Customer was deleted, skipping");
      } else {
        const companyId = (customer as Stripe.Customer).metadata?.company_id;
        
        if (companyId) {
          // Get price info to determine plan
          const priceId = subscription.items.data[0]?.price?.id;
          const productId = subscription.items.data[0]?.price?.product;
          
          // Try to find matching plan by price or create/update subscription
          const { data: plans } = await supabase
            .from("subscription_plans")
            .select("id, name, price_monthly")
            .eq("is_active", true);

          // For now, try to match by name in metadata or default to first paid plan
          let planId = plans?.[0]?.id;
          const planName = (customer as Stripe.Customer).metadata?.plan_name;
          if (planName && plans) {
            const matchingPlan = plans.find(p => p.name === planName);
            if (matchingPlan) planId = matchingPlan.id;
          }

          // Map Stripe status to our status
          let status = 'active';
          if (subscription.status === 'trialing') status = 'trialing';
          else if (subscription.status === 'past_due') status = 'past_due';
          else if (subscription.status === 'canceled' || subscription.status === 'unpaid') status = 'cancelled';

          // Upsert company subscription
          const { error: subError } = await supabase
            .from("company_subscriptions")
            .upsert({
              company_id: companyId,
              plan_id: planId,
              status,
              current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
              current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              stripe_subscription_id: subscription.id,
              trial_ends_at: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
              cancel_at_period_end: subscription.cancel_at_period_end,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'company_id',
            });

          if (subError) {
            logStep("ERROR: Failed to upsert subscription", { error: subError.message });
          } else {
            logStep("Company subscription synced", { companyId, status, stripeSubId: subscription.id });
          }
        } else {
          logStep("No company_id in customer metadata, skipping subscription sync");
        }
      }
    }

    // Handle customer.subscription.deleted - subscription cancelled
    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object as Stripe.Subscription;
      logStep("Processing customer.subscription.deleted", { subscriptionId: subscription.id });

      // Update subscription status to cancelled
      const { error: updateError } = await supabase
        .from("company_subscriptions")
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString(),
        })
        .eq("stripe_subscription_id", subscription.id);

      if (updateError) {
        logStep("WARNING: Failed to update cancelled subscription", { error: updateError.message });
      } else {
        logStep("Subscription marked as cancelled", { stripeSubId: subscription.id });
      }
    }

    // Handle invoice.payment_failed for subscriptions
    if (event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      
      if (invoice.subscription) {
        const subscriptionId = typeof invoice.subscription === 'string' 
          ? invoice.subscription 
          : invoice.subscription.id;

        logStep("Subscription payment failed", { subscriptionId });

        const { error: updateError } = await supabase
          .from("company_subscriptions")
          .update({
            status: 'past_due',
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_subscription_id", subscriptionId);

        if (updateError) {
          logStep("WARNING: Failed to update subscription to past_due", { error: updateError.message });
        }
      }
    }

    // Handle payment_intent.payment_failed event
    if (event.type === "payment_intent.payment_failed") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      logStep("Processing payment_intent.payment_failed", { paymentIntentId: paymentIntent.id });

      const invoiceId = paymentIntent.metadata?.invoice_id;
      const customerEmail = paymentIntent.receipt_email || paymentIntent.metadata?.customer_email;
      
      if (invoiceId) {
        // Get invoice details
        const { data: invoice } = await supabase
          .from("invoices")
          .select(`
            *,
            customers (name, email),
            companies (name, email, id)
          `)
          .eq("id", invoiceId)
          .single();

        if (invoice) {
          // Create notification for admins about failed payment
          const { data: admins } = await supabase
            .from("profiles")
            .select("id")
            .eq("company_id", invoice.companies?.id)
            .in("role", ["admin", "manager"]);

          if (admins && admins.length > 0) {
            const errorMessage = paymentIntent.last_payment_error?.message || "Payment failed";
            const notifications = admins.map((admin) => ({
              user_id: admin.id,
              type: "payment_failed",
              title: "Payment Failed",
              message: `Payment failed for Invoice #${invoice.invoice_number} - ${errorMessage}`,
              data: { 
                invoiceId, 
                invoiceNumber: invoice.invoice_number, 
                amount: invoice.total, 
                customerName: invoice.customers?.name,
                errorMessage 
              },
            }));
            
            await supabase.from("notifications").insert(notifications);
            logStep("Failed payment notifications created", { count: notifications.length });
          }

          // Send email to customer about failed payment
          const email = invoice.customers?.email || customerEmail;
          if (email && invoice.companies?.email) {
            try {
              await fetch(`${supabaseUrl}/functions/v1/send-payment-notification`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${supabaseServiceKey}`,
                },
                body: JSON.stringify({
                  type: "payment_failed",
                  invoiceNumber: invoice.invoice_number,
                  customerName: invoice.customers?.name || "Customer",
                  customerEmail: email,
                  companyName: invoice.companies.name,
                  companyEmail: invoice.companies.email,
                  amount: invoice.total,
                  errorMessage: paymentIntent.last_payment_error?.message || "Your payment could not be processed",
                }),
              });
              logStep("Failed payment notification email sent");
            } catch (notifyError: unknown) {
              const errorMessage = notifyError instanceof Error ? notifyError.message : String(notifyError);
              logStep("WARNING: Failed to send notification email", { error: errorMessage });
            }
          }
        }
      }
      logStep("Payment failed event processed");
    }

    // Handle setup_intent.succeeded - payment method saved
    if (event.type === "setup_intent.succeeded") {
      const setupIntent = event.data.object as Stripe.SetupIntent;
      logStep("Processing setup_intent.succeeded", { setupIntentId: setupIntent.id });

      const customerId = setupIntent.metadata?.customer_id;
      const companyId = setupIntent.metadata?.company_id;

      if (customerId && companyId && setupIntent.payment_method) {
        // Get payment method details
        const paymentMethod = await stripe.paymentMethods.retrieve(setupIntent.payment_method as string);
        
        const last4 = paymentMethod.card?.last4 || paymentMethod.us_bank_account?.last4;
        const type = paymentMethod.type;

        // Update customer_stripe_accounts with saved payment method info
        const { error: updateError } = await supabase
          .from("customer_stripe_accounts")
          .update({
            has_saved_payment_method: true,
            default_payment_method_last4: last4,
            default_payment_method_type: type,
            updated_at: new Date().toISOString(),
          })
          .eq("customer_id", customerId)
          .eq("company_id", companyId);

        if (updateError) {
          logStep("WARNING: Failed to update customer stripe account", { error: updateError.message });
        } else {
          logStep("Updated customer stripe account with payment method", { customerId, type, last4 });
        }
      }
    }

    // Handle payment_method.detached - payment method removed
    if (event.type === "payment_method.detached") {
      const paymentMethod = event.data.object as Stripe.PaymentMethod;
      logStep("Processing payment_method.detached", { paymentMethodId: paymentMethod.id });

      // Check if customer has any remaining payment methods
      if (paymentMethod.customer) {
        const customerId = typeof paymentMethod.customer === 'string' 
          ? paymentMethod.customer 
          : paymentMethod.customer.id;

        const remainingCards = await stripe.paymentMethods.list({
          customer: customerId,
          type: 'card',
        });

        const remainingBanks = await stripe.paymentMethods.list({
          customer: customerId,
          type: 'us_bank_account',
        });

        const hasRemainingMethods = remainingCards.data.length > 0 || remainingBanks.data.length > 0;

        if (!hasRemainingMethods) {
          // Update all records for this stripe customer
          const { error: updateError } = await supabase
            .from("customer_stripe_accounts")
            .update({
              has_saved_payment_method: false,
              default_payment_method_last4: null,
              default_payment_method_type: null,
              updated_at: new Date().toISOString(),
            })
            .eq("stripe_customer_id", customerId);

          if (updateError) {
            logStep("WARNING: Failed to update customer stripe account after detach", { error: updateError.message });
          } else {
            logStep("Cleared saved payment method status", { stripeCustomerId: customerId });
          }
        }
      }
    }

    // Handle account.updated - Stripe Connect onboarding status changes
    if (event.type === "account.updated") {
      const account = event.data.object as Stripe.Account;
      logStep("Processing account.updated", { accountId: account.id });

      const companyId = account.metadata?.company_id;
      
      if (companyId) {
        const chargesEnabled = account.charges_enabled ?? false;
        const payoutsEnabled = account.payouts_enabled ?? false;
        const detailsSubmitted = account.details_submitted ?? false;

        const { error: updateError } = await supabase
          .from("companies")
          .update({
            stripe_charges_enabled: chargesEnabled,
            stripe_payouts_enabled: payoutsEnabled,
            stripe_onboarding_complete: detailsSubmitted && chargesEnabled,
            updated_at: new Date().toISOString(),
          })
          .eq("id", companyId);

        if (updateError) {
          logStep("WARNING: Failed to update company Stripe Connect status", { error: updateError.message });
        } else {
          logStep("Company Stripe Connect status updated", { 
            companyId, 
            chargesEnabled, 
            payoutsEnabled, 
            onboardingComplete: detailsSubmitted && chargesEnabled 
          });
        }
      } else {
        logStep("No company_id in account metadata - skipping");
      }
    }

    // Update log entry to processed
    if (logEntryId) {
      try {
        await supabase
          .from("webhook_event_logs")
          .update({
            status: "processed",
            processing_time_ms: Date.now() - startTime,
          })
          .eq("id", logEntryId);
      } catch (updateErr) {
        logStep("WARNING: Failed to update log entry", { error: String(updateErr) });
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR: Unexpected error", { error: errorMessage });

    // Update log entry to failed
    if (logEntryId) {
      try {
        await supabase
          .from("webhook_event_logs")
          .update({
            status: "failed",
            error_message: errorMessage,
            processing_time_ms: Date.now() - startTime,
          })
          .eq("id", logEntryId);
      } catch (updateErr) {
        logStep("WARNING: Failed to update log entry with error", { error: String(updateErr) });
      }
    }

    return new Response(`Webhook error: ${errorMessage}`, {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
