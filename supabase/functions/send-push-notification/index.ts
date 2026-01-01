import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PushNotificationRequest {
  userId?: string;
  companyId?: string;
  title: string;
  body: string;
  icon?: string;
  url?: string;
  tag?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    
    // Verify caller authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header provided");
      return new Response(
        JSON.stringify({ error: "Unauthorized: No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Create a user client with the provided auth header to verify the caller
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user: callingUser }, error: userError } = await userClient.auth.getUser();
    
    if (userError || !callingUser) {
      console.error("Failed to verify user:", userError);
      return new Response(
        JSON.stringify({ error: "Unauthorized: Invalid authentication" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    const { userId, companyId, title, body, icon, url, tag }: PushNotificationRequest = await req.json();
    
    console.log("Sending push notification:", { userId, companyId, title, body, callingUserId: callingUser.id });
    
    // Get caller's profile to verify permissions
    const { data: callerProfile, error: callerProfileError } = await adminClient
      .from("profiles")
      .select("id, company_id, role")
      .eq("id", callingUser.id)
      .single();
    
    if (callerProfileError || !callerProfile) {
      console.error("Failed to fetch caller profile:", callerProfileError);
      return new Response(
        JSON.stringify({ error: "Unauthorized: Profile not found" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Check caller's roles from user_roles table
    const { data: callerRoles } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callingUser.id);
    
    const isAdminOrManager = callerRoles?.some(r => 
      r.role === "admin" || r.role === "manager" || r.role === "super_admin"
    ) || ["admin", "manager", "super_admin"].includes(callerProfile.role);
    
    // Authorization checks
    if (companyId) {
      // Verify caller belongs to the target company
      if (callerProfile.company_id !== companyId) {
        console.error("Caller company mismatch:", { callerCompany: callerProfile.company_id, targetCompany: companyId });
        return new Response(
          JSON.stringify({ error: "Forbidden: Cannot send notifications to other companies" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Only admins/managers can send company-wide notifications
      if (!isAdminOrManager) {
        console.error("Caller not authorized to send company notifications");
        return new Response(
          JSON.stringify({ error: "Forbidden: Only admins and managers can send company notifications" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
    
    if (userId) {
      // If targeting a specific user, verify they're in the same company
      const { data: targetProfile } = await adminClient
        .from("profiles")
        .select("company_id")
        .eq("id", userId)
        .single();
      
      if (targetProfile && targetProfile.company_id !== callerProfile.company_id) {
        console.error("Target user not in caller's company");
        return new Response(
          JSON.stringify({ error: "Forbidden: Cannot send notifications to users in other companies" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
    
    // Build query for subscriptions
    let query = adminClient.from("push_subscriptions").select("*");
    
    if (userId) {
      query = query.eq("user_id", userId);
    } else if (companyId) {
      // Get all admin/manager users in the company
      const { data: profiles } = await adminClient
        .from("profiles")
        .select("id")
        .eq("company_id", companyId)
        .in("role", ["admin", "manager"]);
      
      if (profiles && profiles.length > 0) {
        const userIds = profiles.map((p) => p.id);
        query = query.in("user_id", userIds);
      }
    }
    
    const { data: subscriptions, error: subError } = await query;
    
    if (subError) {
      console.error("Error fetching subscriptions:", subError);
      throw subError;
    }
    
    if (!subscriptions || subscriptions.length === 0) {
      console.log("No push subscriptions found");
      return new Response(
        JSON.stringify({ success: true, message: "No subscriptions found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.log(`Found ${subscriptions.length} subscriptions`);
    
    // Store in-app notifications for each user (as fallback and record)
    const uniqueUserIds = [...new Set(subscriptions.map(s => s.user_id))];
    
    for (const targetUserId of uniqueUserIds) {
      await adminClient.from("notifications").insert({
        user_id: targetUserId,
        title,
        message: body,
        type: tag || "push",
        data: { url, icon },
      });
    }
    
    console.log(`Created ${uniqueUserIds.length} in-app notifications`);
    
    // Note: Full web push encryption requires external library
    // For now, we create in-app notifications that trigger via realtime
    // The NotificationsBell component already listens for realtime updates
    
    return new Response(
      JSON.stringify({
        success: true,
        notified: uniqueUserIds.length,
        message: "Notifications created - users will see them in real-time",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in send-push-notification:", error);
    // Return sanitized error message to client - don't expose internal details
    return new Response(
      JSON.stringify({ error: "Failed to send notification. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
