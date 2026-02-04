import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SYNC-STRIPE-CONNECT-STATUS] ${step}${detailsStr}`);
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
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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
      .select("company_id")
      .eq("id", user.id)
      .single();

    if (profileError || !profile?.company_id) {
      throw new Error("User profile or company not found");
    }

    // Get company's Stripe account using service role to ensure access
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: company, error: companyError } = await adminClient
      .from("companies")
      .select("id, stripe_account_id, stripe_onboarding_complete, stripe_charges_enabled, stripe_payouts_enabled")
      .eq("id", profile.company_id)
      .single();

    if (companyError || !company) {
      throw new Error("Company not found");
    }

    if (!company.stripe_account_id) {
      logStep("No Stripe account connected");
      return new Response(
        JSON.stringify({ 
          synced: false,
          message: "No Stripe account connected",
          status: {
            hasStripeAccount: false,
            onboardingComplete: false,
            chargesEnabled: false,
            payoutsEnabled: false,
          }
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    logStep("Found Stripe account", { accountId: company.stripe_account_id });

    // Fetch latest status from Stripe
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const account = await stripe.accounts.retrieve(company.stripe_account_id);

    const chargesEnabled = account.charges_enabled ?? false;
    const payoutsEnabled = account.payouts_enabled ?? false;
    const detailsSubmitted = account.details_submitted ?? false;
    const onboardingComplete = detailsSubmitted && chargesEnabled;

    logStep("Stripe account status fetched", { 
      chargesEnabled, 
      payoutsEnabled, 
      detailsSubmitted,
      onboardingComplete 
    });

    // Update company with latest status
    const { error: updateError } = await adminClient
      .from("companies")
      .update({
        stripe_charges_enabled: chargesEnabled,
        stripe_payouts_enabled: payoutsEnabled,
        stripe_onboarding_complete: onboardingComplete,
        updated_at: new Date().toISOString(),
      })
      .eq("id", company.id);

    if (updateError) {
      logStep("WARNING: Failed to update company status", { error: updateError.message });
      throw new Error("Failed to update company status");
    }

    logStep("Company status updated successfully");

    return new Response(
      JSON.stringify({ 
        synced: true,
        status: {
          hasStripeAccount: true,
          onboardingComplete,
          chargesEnabled,
          payoutsEnabled,
        }
      }),
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
