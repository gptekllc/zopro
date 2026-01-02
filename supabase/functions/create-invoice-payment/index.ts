import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-INVOICE-PAYMENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    logStep("Stripe key verified");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { invoiceId, customerId, token, signatureData, signerName } = await req.json();
    
    if (!invoiceId || !customerId || !token) {
      throw new Error("Missing required parameters: invoiceId, customerId, or token");
    }
    logStep("Parameters received", { invoiceId, customerId, hasSignature: !!signatureData });

    // Verify token
    try {
      const tokenData = JSON.parse(atob(token));
      
      if (tokenData.customerId !== customerId) {
        throw new Error("Invalid token - customer mismatch");
      }

      const expiresAt = new Date(tokenData.expiresAt);
      if (expiresAt < new Date()) {
        throw new Error("Token expired");
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes("Token")) {
        throw e;
      }
      throw new Error("Invalid token format");
    }
    logStep("Token verified");

    // Fetch invoice details with company Stripe Connect info
    const { data: invoice, error: invoiceError } = await adminClient
      .from('invoices')
      .select('*, customers(id, name, email), companies(name, stripe_account_id, stripe_charges_enabled, stripe_payments_enabled, platform_fee_percentage)')
      .eq('id', invoiceId)
      .eq('customer_id', customerId)
      .single();

    if (invoiceError || !invoice) {
      throw new Error("Invoice not found or access denied");
    }
    logStep("Invoice found", { invoiceNumber: invoice.invoice_number, total: invoice.total });

    if (invoice.status === 'paid') {
      throw new Error("Invoice is already paid");
    }

    // Check if online payments are enabled for this company
    const stripePaymentsEnabled = invoice.companies?.stripe_payments_enabled ?? true;
    if (!stripePaymentsEnabled) {
      throw new Error("Online payments are not available. Please contact the company for alternative payment methods.");
    }
    logStep("Online payments enabled check passed");

    // Save signature if provided (required for payment)
    if (signatureData && signerName) {
      const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                       req.headers.get('x-real-ip') || 
                       'unknown';

      const { data: signature, error: signatureError } = await adminClient
        .from('signatures')
        .insert({
          company_id: invoice.company_id,
          customer_id: customerId,
          document_type: 'invoice',
          document_id: invoiceId,
          signature_data: signatureData,
          signer_name: signerName,
          signer_ip: clientIp,
        })
        .select()
        .single();

      if (signatureError) {
        logStep("Signature save error", { error: signatureError.message });
      } else {
        // Update invoice with signature reference
        await adminClient
          .from('invoices')
          .update({
            signature_id: signature.id,
            signed_at: new Date().toISOString(),
          })
          .eq('id', invoiceId);
        
        logStep("Signature saved", { signatureId: signature.id });
      }
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Check if customer exists in Stripe
    const customerEmail = invoice.customers?.email;
    let stripeCustomerId: string | undefined;
    
    if (customerEmail) {
      const customers = await stripe.customers.list({ email: customerEmail, limit: 1 });
      if (customers.data.length > 0) {
        stripeCustomerId = customers.data[0].id;
        logStep("Found existing Stripe customer", { stripeCustomerId });
      }
    }

    const origin = req.headers.get("origin") || "https://lovable.dev";

    // Check if company has Stripe Connect set up
    const companyStripeAccountId = invoice.companies?.stripe_account_id;
    const chargesEnabled = invoice.companies?.stripe_charges_enabled;
    const platformFee = invoice.companies?.platform_fee_percentage || 0;

    if (companyStripeAccountId && !chargesEnabled) {
      throw new Error("Company's Stripe account is not fully set up for payments");
    }

    logStep("Stripe Connect status", { 
      hasConnectedAccount: !!companyStripeAccountId, 
      chargesEnabled, 
      platformFee 
    });

    // Calculate amounts
    const totalCents = Math.round(Number(invoice.total) * 100);
    const applicationFeeCents = platformFee > 0 ? Math.round(totalCents * (platformFee / 100)) : 0;

    // Build checkout session options
    const sessionOptions: any = {
      customer: stripeCustomerId,
      customer_email: stripeCustomerId ? undefined : customerEmail,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Invoice ${invoice.invoice_number}`,
              description: `Payment for invoice from ${invoice.companies?.name || 'Company'}`,
            },
            unit_amount: totalCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/customer-portal?payment=success&invoice=${invoiceId}`,
      cancel_url: `${origin}/customer-portal?payment=cancelled`,
      metadata: {
        invoice_id: invoiceId,
        customer_id: customerId,
        invoice_number: invoice.invoice_number,
      },
    };

    // If company has Stripe Connect, route payment to their account
    if (companyStripeAccountId && chargesEnabled) {
      sessionOptions.payment_intent_data = {
        transfer_data: {
          destination: companyStripeAccountId,
        },
      };
      
      // Add platform fee if configured
      if (applicationFeeCents > 0) {
        sessionOptions.payment_intent_data.application_fee_amount = applicationFeeCents;
      }
      
      logStep("Routing payment to connected account", { 
        destination: companyStripeAccountId, 
        applicationFee: applicationFeeCents 
      });
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create(sessionOptions);

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
