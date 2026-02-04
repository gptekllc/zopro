import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SYNC-SQUARE-CONNECT-STATUS] ${step}${detailsStr}`);
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

    // Get company's Square account using service role to ensure access
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: company, error: companyError } = await adminClient
      .from("companies")
      .select("id, square_merchant_id, square_location_id, square_onboarding_complete")
      .eq("id", profile.company_id)
      .single();

    if (companyError || !company) {
      throw new Error("Company not found");
    }

    if (!company.square_merchant_id) {
      logStep("No Square account connected");
      return new Response(
        JSON.stringify({ 
          synced: false,
          message: "No Square account connected",
          status: {
            hasSquareAccount: false,
            onboardingComplete: false,
            hasLocation: false,
          }
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    logStep("Found Square merchant", { merchantId: company.square_merchant_id });

    // TODO: When Square API is integrated, fetch actual status from Square here
    // For now, we'll check if merchant ID exists and mark as complete
    // In a real implementation, you would:
    // 1. Use Square OAuth to verify access token is still valid
    // 2. Fetch merchant info and locations
    // 3. Verify the account can process payments
    
    const squareAccessToken = Deno.env.get("SQUARE_ACCESS_TOKEN");
    
    let onboardingComplete = company.square_onboarding_complete ?? false;
    let hasLocation = !!company.square_location_id;
    
    // If we have Square credentials, we could verify the merchant status
    if (squareAccessToken) {
      // Placeholder for Square API verification
      // This would be implemented when Square integration is added
      logStep("Square credentials available - would verify merchant status");
      onboardingComplete = true; // Assume complete if we have merchant ID
    } else {
      logStep("Square credentials not configured - using stored status");
    }

    // Update company with latest status
    const { error: updateError } = await adminClient
      .from("companies")
      .update({
        square_onboarding_complete: onboardingComplete,
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
          hasSquareAccount: true,
          onboardingComplete,
          hasLocation,
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
