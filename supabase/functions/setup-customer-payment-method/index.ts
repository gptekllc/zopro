import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SETUP-PAYMENT-METHOD] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { customerId, token, action } = await req.json();
    
    if (!customerId || !token) {
      throw new Error("Missing required parameters: customerId or token");
    }
    logStep("Parameters received", { customerId, action });

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

    // Fetch customer details
    const { data: customer, error: customerError } = await adminClient
      .from('customers')
      .select('*, companies(id, name)')
      .eq('id', customerId)
      .single();

    if (customerError || !customer) {
      throw new Error("Customer not found");
    }
    logStep("Customer found", { email: customer.email, companyId: customer.company_id });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const origin = Deno.env.get("APP_BASE_URL") || req.headers.get("origin") || "https://lovable.dev";

    // Check if customer already has a Stripe account record
    const { data: stripeAccount } = await adminClient
      .from('customer_stripe_accounts')
      .select('*')
      .eq('customer_id', customerId)
      .eq('company_id', customer.company_id)
      .maybeSingle();

    let stripeCustomerId = stripeAccount?.stripe_customer_id;

    // Create or retrieve Stripe customer
    if (!stripeCustomerId) {
      // Check if customer exists in Stripe by email
      if (customer.email) {
        const existingCustomers = await stripe.customers.list({ email: customer.email, limit: 1 });
        if (existingCustomers.data.length > 0) {
          stripeCustomerId = existingCustomers.data[0].id;
          logStep("Found existing Stripe customer", { stripeCustomerId });
        }
      }

      // Create new Stripe customer if not found
      if (!stripeCustomerId) {
        const stripeCustomer = await stripe.customers.create({
          email: customer.email || undefined,
          name: customer.name,
          metadata: {
            customer_id: customerId,
            company_id: customer.company_id,
          },
        });
        stripeCustomerId = stripeCustomer.id;
        logStep("Created new Stripe customer", { stripeCustomerId });
      }

      // Save stripe account record
      await adminClient
        .from('customer_stripe_accounts')
        .upsert({
          customer_id: customerId,
          company_id: customer.company_id,
          stripe_customer_id: stripeCustomerId,
        }, {
          onConflict: 'customer_id,company_id',
        });
      logStep("Saved stripe account record");
    }

    // Handle different actions
    if (action === 'get-payment-methods') {
      // Get saved payment methods
      const paymentMethods = await stripe.paymentMethods.list({
        customer: stripeCustomerId,
        type: 'card',
      });

      const bankMethods = await stripe.paymentMethods.list({
        customer: stripeCustomerId,
        type: 'us_bank_account',
      });

      const allMethods = [
        ...paymentMethods.data.map((pm: Stripe.PaymentMethod) => ({
          id: pm.id,
          type: 'card' as const,
          brand: pm.card?.brand,
          last4: pm.card?.last4,
          exp_month: pm.card?.exp_month,
          exp_year: pm.card?.exp_year,
        })),
        ...bankMethods.data.map((pm: Stripe.PaymentMethod) => ({
          id: pm.id,
          type: 'bank' as const,
          bank_name: pm.us_bank_account?.bank_name,
          last4: pm.us_bank_account?.last4,
          account_type: pm.us_bank_account?.account_type,
        })),
      ];

      logStep("Retrieved payment methods", { count: allMethods.length });

      return new Response(JSON.stringify({ paymentMethods: allMethods }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (action === 'create-setup-intent') {
      // Create a SetupIntent for saving a payment method
      const setupIntent = await stripe.setupIntents.create({
        customer: stripeCustomerId,
        payment_method_types: ['card'],
        metadata: {
          customer_id: customerId,
          company_id: customer.company_id,
        },
      });

      logStep("Created SetupIntent", { setupIntentId: setupIntent.id });

      return new Response(JSON.stringify({ 
        clientSecret: setupIntent.client_secret,
        stripeCustomerId,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (action === 'billing-portal') {
      // Create a billing portal session
      const session = await stripe.billingPortal.sessions.create({
        customer: stripeCustomerId,
        return_url: `${origin}/customer-portal`,
      });

      logStep("Created billing portal session", { url: session.url });

      return new Response(JSON.stringify({ url: session.url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    if (action === 'delete-payment-method') {
      const { paymentMethodId } = await req.json();
      if (!paymentMethodId) {
        throw new Error("Missing paymentMethodId");
      }

      await stripe.paymentMethods.detach(paymentMethodId);
      logStep("Deleted payment method", { paymentMethodId });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Default: return customer stripe info
    return new Response(JSON.stringify({ 
      stripeCustomerId,
      hasSavedPaymentMethod: stripeAccount?.has_saved_payment_method || false,
    }), {
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
