import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SUPER-ADMIN-IMPERSONATE] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    });

    // Verify the caller is a super admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header provided");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !userData.user) {
      throw new Error("Authentication failed");
    }

    const adminId = userData.user.id;
    logStep("Admin authenticated", { adminId });

    // Check if user has super_admin role
    const { data: roles, error: rolesError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", adminId)
      .eq("role", "super_admin");

    if (rolesError || !roles || roles.length === 0) {
      throw new Error("Access denied: Super admin privileges required");
    }

    logStep("Super admin verified");

    const { targetUserId, action } = await req.json();

    if (action === "generate_link") {
      if (!targetUserId) {
        throw new Error("Target user ID is required");
      }

      // Get target user details
      const { data: targetUser, error: targetError } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("id", targetUserId)
        .single();

      if (targetError || !targetUser) {
        throw new Error("Target user not found");
      }

      logStep("Target user found", { targetUserId, email: targetUser.email });

      // Generate a magic link for the target user using admin API
      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: targetUser.email,
        options: {
          redirectTo: `${req.headers.get("origin") || Deno.env.get("APP_BASE_URL")}/dashboard?impersonated=true`,
        },
      });

      if (linkError || !linkData) {
        logStep("Error generating magic link", { error: linkError?.message });
        throw new Error("Failed to generate impersonation link");
      }

      logStep("Magic link generated");

      // Log the impersonation action
      await supabase.from("super_admin_audit_log").insert({
        admin_id: adminId,
        action: "impersonation_started",
        target_type: "user",
        target_id: targetUserId,
        details: {
          target_email: targetUser.email,
          target_name: targetUser.full_name,
        },
      });

      logStep("Audit log created");

      // Return the magic link properties
      return new Response(JSON.stringify({
        success: true,
        link: linkData.properties?.action_link,
        email: targetUser.email,
        name: targetUser.full_name,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    throw new Error("Invalid action");

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
