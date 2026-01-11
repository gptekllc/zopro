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

    const body = await req.json();
    // Support both single invoiceId and multiple invoiceIds
    const { invoiceId, invoiceIds, customerId, token, signatureData, signerName } = body;
    
    // Handle multiple invoices or single invoice
    const idsToProcess: string[] = invoiceIds || (invoiceId ? [invoiceId] : []);
    
    if (idsToProcess.length === 0 || !customerId || !token) {
      throw new Error("Missing required parameters: invoiceId(s), customerId, or token");
    }
    logStep("Parameters received", { invoiceIds: idsToProcess, customerId, hasSignature: !!signatureData });

    // Verify token - parse the signed token format (payload.signature)
    try {
      const parts = token.split('.');
      if (parts.length === 2) {
        // Signed token format
        const tokenData = JSON.parse(atob(parts[0]));
        if (tokenData.customerId !== customerId) {
          throw new Error("Invalid token - customer mismatch");
        }
        const expiresAt = new Date(tokenData.expiresAt);
        if (expiresAt < new Date()) {
          throw new Error("Token expired");
        }
      } else {
        // Legacy format - try parsing directly
        const tokenData = JSON.parse(atob(token));
        if (tokenData.customerId !== customerId) {
          throw new Error("Invalid token - customer mismatch");
        }
        const expiresAt = new Date(tokenData.expiresAt);
        if (expiresAt < new Date()) {
          throw new Error("Token expired");
        }
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes("Token")) {
        throw e;
      }
      throw new Error("Invalid token format");
    }
    logStep("Token verified");

    // Fetch all invoice details with company Stripe Connect info
    const { data: invoicesData, error: invoicesError } = await adminClient
      .from('invoices')
      .select('*, customers(id, name, email), companies(name, stripe_account_id, stripe_charges_enabled, stripe_payments_enabled, platform_fee_percentage)')
      .in('id', idsToProcess)
      .eq('customer_id', customerId);

    if (invoicesError || !invoicesData || invoicesData.length === 0) {
      throw new Error("Invoices not found or access denied");
    }

    // Validate all invoices belong to the same company and are not paid
    const companyIds = [...new Set(invoicesData.map(inv => inv.company_id))];
    if (companyIds.length > 1) {
      throw new Error("All invoices must belong to the same company");
    }

    const paidInvoices = invoicesData.filter(inv => inv.status === 'paid');
    if (paidInvoices.length > 0) {
      throw new Error(`Invoice(s) already paid: ${paidInvoices.map(i => i.invoice_number).join(', ')}`);
    }

    const firstInvoice = invoicesData[0];
    logStep("Invoices found", { 
      count: invoicesData.length, 
      invoiceNumbers: invoicesData.map(i => i.invoice_number),
      totalAmount: invoicesData.reduce((sum, i) => sum + Number(i.total), 0)
    });

    // Check if online payments are enabled for this company
    const stripePaymentsEnabled = firstInvoice.companies?.stripe_payments_enabled ?? true;
    if (!stripePaymentsEnabled) {
      throw new Error("Online payments are not available. Please contact the company for alternative payment methods.");
    }
    logStep("Online payments enabled check passed");

    // Save signature for each invoice if provided (required for payment)
    if (signatureData && signerName) {
      const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                       req.headers.get('x-real-ip') || 
                       'unknown';

      for (const invoice of invoicesData) {
        const { data: signature, error: signatureError } = await adminClient
          .from('signatures')
          .insert({
            company_id: invoice.company_id,
            customer_id: customerId,
            document_type: 'invoice',
            document_id: invoice.id,
            signature_data: signatureData,
            signer_name: signerName,
            signer_ip: clientIp,
          })
          .select()
          .single();

        if (signatureError) {
          logStep("Signature save error for invoice", { invoiceId: invoice.id, error: signatureError.message });
        } else {
          // Update invoice with signature reference
          await adminClient
            .from('invoices')
            .update({
              signature_id: signature.id,
              signed_at: new Date().toISOString(),
            })
            .eq('id', invoice.id);
          
          logStep("Signature saved for invoice", { invoiceId: invoice.id, signatureId: signature.id });
        }
      }
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Check if customer exists in Stripe
    const customerEmail = firstInvoice.customers?.email;
    let stripeCustomerId: string | undefined;
    
    if (customerEmail) {
      const customers = await stripe.customers.list({ email: customerEmail, limit: 1 });
      if (customers.data.length > 0) {
        stripeCustomerId = customers.data[0].id;
        logStep("Found existing Stripe customer", { stripeCustomerId });
      }
    }

    const productionUrl = Deno.env.get("PRODUCTION_URL") || "https://fsm.zopro.app";
    const origin = productionUrl;

    // Check if company has Stripe Connect set up
    const companyStripeAccountId = firstInvoice.companies?.stripe_account_id;
    const chargesEnabled = firstInvoice.companies?.stripe_charges_enabled;
    const platformFee = firstInvoice.companies?.platform_fee_percentage || 0;

    if (companyStripeAccountId && !chargesEnabled) {
      throw new Error("Company's Stripe account is not fully set up for payments");
    }

    logStep("Stripe Connect status", { 
      hasConnectedAccount: !!companyStripeAccountId, 
      chargesEnabled, 
      platformFee 
    });

    // Calculate total amount across all invoices
    const totalAmount = invoicesData.reduce((sum, inv) => sum + Number(inv.total), 0);
    const totalCents = Math.round(totalAmount * 100);
    const applicationFeeCents = platformFee > 0 ? Math.round(totalCents * (platformFee / 100)) : 0;

    // Create line items for each invoice
    const lineItems = invoicesData.map(invoice => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: `Invoice ${invoice.invoice_number}`,
          description: `Payment for invoice from ${invoice.companies?.name || 'Company'}`,
        },
        unit_amount: Math.round(Number(invoice.total) * 100),
      },
      quantity: 1,
    }));

    // Build checkout session options
    const sessionOptions: any = {
      customer: stripeCustomerId,
      customer_email: stripeCustomerId ? undefined : customerEmail,
      line_items: lineItems,
      mode: "payment",
      success_url: `${origin}/customer-portal?payment=success&invoices=${idsToProcess.join(',')}`,
      cancel_url: `${origin}/customer-portal?payment=cancelled`,
      metadata: {
        invoice_ids: idsToProcess.join(','),
        customer_id: customerId,
        invoice_numbers: invoicesData.map(i => i.invoice_number).join(','),
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
