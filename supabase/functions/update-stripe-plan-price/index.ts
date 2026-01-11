import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[UPDATE-STRIPE-PLAN-PRICE] ${step}${detailsStr}`);
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

    const body = await req.json();
    const {
      stripe_product_id,
      new_price_monthly,
      new_price_yearly,
      old_price_id_monthly,
      old_price_id_yearly,
    } = body;

    logStep("Request body", { 
      stripe_product_id, 
      new_price_monthly, 
      new_price_yearly,
      old_price_id_monthly,
      old_price_id_yearly 
    });

    if (!stripe_product_id) {
      throw new Error("stripe_product_id is required");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    let new_price_id_monthly: string | null = null;
    let new_price_id_yearly: string | null = null;

    // Create new monthly price if provided
    if (new_price_monthly !== undefined && new_price_monthly !== null) {
      logStep("Creating new monthly price", { amount: new_price_monthly });
      const monthlyPrice = await stripe.prices.create({
        product: stripe_product_id,
        unit_amount: Math.round(new_price_monthly * 100), // Convert to cents
        currency: "usd",
        recurring: { interval: "month" },
      });
      new_price_id_monthly = monthlyPrice.id;
      logStep("Created monthly price", { id: new_price_id_monthly });

      // Archive old monthly price if provided
      if (old_price_id_monthly && old_price_id_monthly !== new_price_id_monthly) {
        try {
          await stripe.prices.update(old_price_id_monthly, { active: false });
          logStep("Archived old monthly price", { id: old_price_id_monthly });
        } catch (archiveError: unknown) {
          const message = archiveError instanceof Error ? archiveError.message : String(archiveError);
          logStep("Could not archive old monthly price (may already be archived)", { 
            id: old_price_id_monthly,
            error: message 
          });
        }
      }
    }

    // Create new yearly price if provided
    if (new_price_yearly !== undefined && new_price_yearly !== null) {
      logStep("Creating new yearly price", { amount: new_price_yearly });
      const yearlyPrice = await stripe.prices.create({
        product: stripe_product_id,
        unit_amount: Math.round(new_price_yearly * 100), // Convert to cents
        currency: "usd",
        recurring: { interval: "year" },
      });
      new_price_id_yearly = yearlyPrice.id;
      logStep("Created yearly price", { id: new_price_id_yearly });

      // Archive old yearly price if provided
      if (old_price_id_yearly && old_price_id_yearly !== new_price_id_yearly) {
        try {
          await stripe.prices.update(old_price_id_yearly, { active: false });
          logStep("Archived old yearly price", { id: old_price_id_yearly });
        } catch (archiveError: unknown) {
          const message = archiveError instanceof Error ? archiveError.message : String(archiveError);
          logStep("Could not archive old yearly price (may already be archived)", { 
            id: old_price_id_yearly,
            error: message 
          });
        }
      }
    }

    logStep("Successfully created new prices", { 
      new_price_id_monthly, 
      new_price_id_yearly 
    });

    return new Response(
      JSON.stringify({
        success: true,
        new_price_id_monthly,
        new_price_id_yearly,
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
