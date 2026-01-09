import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  console.log(`[TEST-PAYMENT-FLOW] ${step}${details ? ` - ${JSON.stringify(details)}` : ''}`);
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
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const anonClient = createClient(supabaseUrl, supabaseAnonKey);

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header provided");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await anonClient.auth.getUser(token);
    if (userError || !userData.user) {
      throw new Error("Authentication failed");
    }
    logStep("User authenticated", { userId: userData.user.id });

    // Check if user is super admin
    const { data: roles } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', userData.user.id);

    const isSuperAdmin = roles?.some(r => r.role === 'super_admin');
    if (!isSuperAdmin) {
      throw new Error("Only super admins can test payment flow");
    }
    logStep("Super admin verified");

    const { testAmount = 100 } = await req.json();

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const productionUrl = Deno.env.get("PRODUCTION_URL") || "https://fsm.zopro.app";

    // Create a test checkout session
    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: 'Test Payment - Webhook Verification',
              description: 'This is a test payment to verify webhook processing',
            },
            unit_amount: testAmount, // $1.00 in cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${productionUrl}/super-admin?tab=webhooks&test=success`,
      cancel_url: `${productionUrl}/super-admin?tab=webhooks&test=cancelled`,
      metadata: {
        test_payment: 'true',
        initiated_by: userData.user.id,
        initiated_at: new Date().toISOString(),
      },
    });

    logStep("Test checkout session created", { sessionId: session.id, url: session.url });

    return new Response(JSON.stringify({ 
      url: session.url,
      sessionId: session.id,
      amount: testAmount / 100,
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
