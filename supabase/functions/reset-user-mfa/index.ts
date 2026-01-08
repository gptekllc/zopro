import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Create admin client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Verify the requesting user is authenticated and is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the requesting user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: requestingUser }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !requestingUser) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if requesting user is an admin
    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", {
      _user_id: requestingUser.id,
      _role: "admin"
    });

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: "Only admins can reset MFA for other users" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the target user ID from request body
    const { userId } = await req.json();
    
    if (!userId) {
      return new Response(
        JSON.stringify({ error: "User ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the target user is in the same company as the admin
    const { data: requestingProfile } = await supabaseAdmin
      .from("profiles")
      .select("company_id")
      .eq("id", requestingUser.id)
      .single();

    const { data: targetProfile } = await supabaseAdmin
      .from("profiles")
      .select("company_id, full_name, email")
      .eq("id", userId)
      .single();

    if (!requestingProfile || !targetProfile || requestingProfile.company_id !== targetProfile.company_id) {
      return new Response(
        JSON.stringify({ error: "User not found in your company" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user's MFA factors using admin API
    const { data: factors, error: factorsError } = await supabaseAdmin.auth.admin.mfa.listFactors({
      userId
    });

    if (factorsError) {
      console.error("Error listing factors:", factorsError);
      return new Response(
        JSON.stringify({ error: "Failed to list MFA factors" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Unenroll all TOTP factors
    let unenrolledCount = 0;
    for (const factor of factors.factors || []) {
      if (factor.factor_type === "totp") {
        const { error: unenrollError } = await supabaseAdmin.auth.admin.mfa.deleteFactor({
          userId,
          id: factor.id
        });
        
        if (unenrollError) {
          console.error("Error unenrolling factor:", unenrollError);
        } else {
          unenrolledCount++;
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Reset MFA for ${targetProfile.full_name || targetProfile.email}`,
        factorsRemoved: unenrolledCount
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: unknown) {
    console.error("Error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});