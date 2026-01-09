import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-CONNECT-REFRESH] ${step}${detailsStr}`);
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
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error("Unauthorized");
    }
    logStep("User authenticated", { userId: user.id });

    // Get user's company
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("company_id, role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.company_id) {
      throw new Error("User profile or company not found");
    }

    if (profile.role !== "admin") {
      throw new Error("Only admins can manage Stripe accounts");
    }

    // Get company's Stripe account
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("stripe_account_id")
      .eq("id", profile.company_id)
      .single();

    if (companyError || !company?.stripe_account_id) {
      throw new Error("Stripe account not found");
    }
    logStep("Found Stripe account", { accountId: company.stripe_account_id });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const productionUrl = Deno.env.get("PRODUCTION_URL") || "https://fsm.zopro.app";
    const origin = productionUrl;

    // Create new account link for continuing onboarding
    const accountLink = await stripe.accountLinks.create({
      account: company.stripe_account_id,
      refresh_url: `${origin}/stripe-connect/refresh`,
      return_url: `${origin}/stripe-connect/return`,
      type: "account_onboarding",
    });

    logStep("New account link created", { url: accountLink.url });

    return new Response(
      JSON.stringify({ url: accountLink.url }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
