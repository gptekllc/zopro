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
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { userId, companyId, title, body, icon, url, tag }: PushNotificationRequest = await req.json();
    
    console.log("Sending push notification:", { userId, companyId, title, body });
    
    // Build query for subscriptions
    let query = supabase.from("push_subscriptions").select("*");
    
    if (userId) {
      query = query.eq("user_id", userId);
    } else if (companyId) {
      // Get all admin/manager users in the company
      const { data: profiles } = await supabase
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
      await supabase.from("notifications").insert({
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
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in send-push-notification:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
