import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SYNC-PAYPAL-CONNECT-STATUS] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

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

    // Get company's PayPal account using service role to ensure access
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: company, error: companyError } = await adminClient
      .from("companies")
      .select("id, paypal_merchant_id, paypal_onboarding_complete")
      .eq("id", profile.company_id)
      .single();

    if (companyError || !company) {
      throw new Error("Company not found");
    }

    if (!company.paypal_merchant_id) {
      logStep("No PayPal account connected");
      return new Response(
        JSON.stringify({ 
          synced: false,
          message: "No PayPal account connected",
          status: {
            hasPayPalAccount: false,
            onboardingComplete: false,
          }
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    logStep("Found PayPal merchant", { merchantId: company.paypal_merchant_id });

    // TODO: When PayPal API is integrated, fetch actual status from PayPal here
    // For now, we'll check if merchant ID exists and mark as complete
    // In a real implementation, you would:
    // 1. Use PayPal Partner Referrals API to check merchant status
    // 2. Verify payments_receivable and primary_email_confirmed
    
    const paypalClientId = Deno.env.get("PAYPAL_CLIENT_ID");
    const paypalClientSecret = Deno.env.get("PAYPAL_CLIENT_SECRET");
    
    let onboardingComplete = company.paypal_onboarding_complete ?? false;
    
    // If we have PayPal credentials, we could verify the merchant status
    if (paypalClientId && paypalClientSecret) {
      // Placeholder for PayPal API verification
      // This would be implemented when PayPal integration is added
      logStep("PayPal credentials available - would verify merchant status");
      onboardingComplete = true; // Assume complete if we have merchant ID
    } else {
      logStep("PayPal credentials not configured - using stored status");
    }

    // Update company with latest status
    const { error: updateError } = await adminClient
      .from("companies")
      .update({
        paypal_onboarding_complete: onboardingComplete,
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
          hasPayPalAccount: true,
          onboardingComplete,
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
