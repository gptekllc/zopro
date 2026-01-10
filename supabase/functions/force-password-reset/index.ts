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
    const appBaseUrl = Deno.env.get("PRODUCTION_URL") || Deno.env.get("APP_BASE_URL") || "https://zopro.lovable.app";

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create client with user's token to verify they're authenticated
    const supabaseUser = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create admin client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify requester is an admin
    const { data: requesterProfile } = await supabaseAdmin
      .from("profiles")
      .select("company_id, role")
      .eq("id", user.id)
      .single();

    if (!requesterProfile || requesterProfile.role !== "admin") {
      return new Response(JSON.stringify({ error: "Only admins can force password resets" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { userId, allMembers } = await req.json();

    // Get target user(s)
    let targetUsers: { id: string; email: string; full_name: string | null }[] = [];

    if (allMembers) {
      // Get all team members except the requester
      const { data: members } = await supabaseAdmin
        .from("profiles")
        .select("id, email, full_name")
        .eq("company_id", requesterProfile.company_id)
        .neq("id", user.id)
        .is("deleted_at", null);

      targetUsers = members || [];
    } else if (userId) {
      // Get specific user
      const { data: targetProfile } = await supabaseAdmin
        .from("profiles")
        .select("id, email, full_name, company_id")
        .eq("id", userId)
        .single();

      if (!targetProfile || targetProfile.company_id !== requesterProfile.company_id) {
        return new Response(JSON.stringify({ error: "User not found in your company" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      targetUsers = [targetProfile];
    } else {
      return new Response(JSON.stringify({ error: "userId or allMembers required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send password reset emails
    const results = [];
    for (const targetUser of targetUsers) {
      try {
        const { error } = await supabaseAdmin.auth.resetPasswordForEmail(targetUser.email, {
          redirectTo: `${appBaseUrl}/reset-password`,
        });

        if (error) {
          results.push({ userId: targetUser.id, email: targetUser.email, success: false, error: error.message });
        } else {
          results.push({ userId: targetUser.id, email: targetUser.email, success: true });
        }
      } catch (err) {
        results.push({ userId: targetUser.id, email: targetUser.email, success: false, error: String(err) });
      }
    }

    const successCount = results.filter(r => r.success).length;

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Password reset email sent to ${successCount} user(s)`,
        results 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in force-password-reset:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
