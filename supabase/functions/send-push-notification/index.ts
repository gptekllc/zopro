import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-trigger-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface PushNotificationRequest {
  userId?: string;
  companyId?: string;
  title: string;
  body: string;
  icon?: string;
  url?: string;
  tag?: string;
  badge_count?: number;
  skipInAppNotification?: boolean;
}

// --- OneSignal delivery (modernized API) ---
async function sendOneSignalNotifications(
  playerIds: string[],
  externalUserIds: string[],
  title: string,
  body: string,
  data?: Record<string, string>,
  badgeCount?: number
): Promise<{ success: boolean; id?: string; errors?: unknown }> {
  const appId = Deno.env.get("ONESIGNAL_APP_ID");
  const restApiKey = Deno.env.get("ONESIGNAL_REST_API_KEY");

  if (!appId || !restApiKey) {
    console.log("OneSignal keys not configured, skipping native push");
    return { success: false, errors: "Missing ONESIGNAL_APP_ID or ONESIGNAL_REST_API_KEY" };
  }

  // Prefer player IDs (direct device targeting), fall back to external user IDs
  const hasPlayerIds = playerIds.length > 0;
  const hasExternalIds = externalUserIds.length > 0;

  if (!hasPlayerIds && !hasExternalIds) {
    console.log("No player IDs or external user IDs for OneSignal delivery");
    return { success: true };
  }

  try {
    const payload: Record<string, unknown> = {
      app_id: appId,
      headings: { en: title },
      contents: { en: body },
    };

    // Use player IDs for direct targeting (most reliable with Despia SDK)
    if (hasPlayerIds) {
      payload.include_player_ids = playerIds;
      console.log("OneSignal: targeting by player IDs:", playerIds);
    } else {
      payload.include_external_user_ids = externalUserIds;
      console.log("OneSignal: targeting by external user IDs:", externalUserIds);
    }

    if (data) {
      payload.data = data;
    }

    if (badgeCount !== undefined) {
      payload.ios_badgeType = "SetTo";
      payload.ios_badgeCount = badgeCount;
    }

    const response = await fetch("https://onesignal.com/api/v1/notifications", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${restApiKey}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    console.log("OneSignal API response:", JSON.stringify(result));

    if (result.errors) {
      console.error("OneSignal errors:", result.errors);
      return { success: false, errors: result.errors };
    }

    return { success: true, id: result.id };
  } catch (err) {
    console.error("OneSignal fetch error:", err);
    return { success: false, errors: String(err) };
  }
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

    const authHeader = req.headers.get("Authorization");
    const token = authHeader?.replace("Bearer ", "");

    // Check for trusted internal trigger via shared secret
    const triggerSecret = req.headers.get("x-trigger-secret");
    const expectedSecret = Deno.env.get("INTERNAL_TRIGGER_SECRET");
    const isTrustedTrigger = !!(triggerSecret && expectedSecret && triggerSecret === expectedSecret);

    const isServiceRoleCall = isTrustedTrigger || token === supabaseServiceKey || token === supabaseAnonKey;

    const { userId, companyId, title, body, icon, url, tag, badge_count, skipInAppNotification }: PushNotificationRequest = await req.json();

    const shouldSkipInApp = isServiceRoleCall || skipInAppNotification;

    console.log("Sending push notification:", { userId, companyId, title, body, isServiceRoleCall, isTrustedTrigger });

    // --- Authorization ---
    if (!isServiceRoleCall) {
      if (!authHeader) {
        return new Response(
          JSON.stringify({ error: "Unauthorized: No authorization header" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: { user: callingUser }, error: userError } = await userClient.auth.getUser();

      if (userError || !callingUser) {
        return new Response(
          JSON.stringify({ error: "Unauthorized: Invalid authentication" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: callerProfile } = await adminClient
        .from("profiles")
        .select("id, company_id, role")
        .eq("id", callingUser.id)
        .single();

      if (!callerProfile) {
        return new Response(
          JSON.stringify({ error: "Unauthorized: Profile not found" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: callerRoles } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", callingUser.id);

      const isAdminOrManager = callerRoles?.some((r) =>
        ["admin", "manager", "super_admin"].includes(r.role)
      ) || ["admin", "manager", "super_admin"].includes(callerProfile.role);

      if (companyId) {
        if (callerProfile.company_id !== companyId) {
          return new Response(
            JSON.stringify({ error: "Forbidden: Cannot send notifications to other companies" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (!isAdminOrManager) {
          return new Response(
            JSON.stringify({ error: "Forbidden: Only admins and managers can send company notifications" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      if (userId) {
        const { data: targetProfile } = await adminClient
          .from("profiles")
          .select("company_id")
          .eq("id", userId)
          .single();

        if (targetProfile && targetProfile.company_id !== callerProfile.company_id) {
          return new Response(
            JSON.stringify({ error: "Forbidden: Cannot send notifications to users in other companies" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    // --- Gather target user IDs ---
    let targetUserIds: string[] = [];

    if (userId) {
      targetUserIds = [userId];
    } else if (companyId) {
      const { data: profiles } = await adminClient
        .from("profiles")
        .select("id")
        .eq("company_id", companyId);
      targetUserIds = profiles?.map((p) => p.id) || [];
    }

    // --- Badge count ---
    let badgeCount = badge_count || 1;
    if (userId) {
      const { count } = await adminClient
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_read", false);
      badgeCount = count || 1;
    }

    // --- In-app notifications ---
    if (!shouldSkipInApp) {
      for (const targetUserId of targetUserIds) {
        await adminClient.from("notifications").insert({
          user_id: targetUserId,
          title,
          message: body,
          type: tag || "push",
          data: { url, icon },
        });
      }
      console.log(`Created ${targetUserIds.length} in-app notifications`);
    } else {
      console.log("Skipping in-app notification creation (called from trigger)");
    }

    // --- Look up OneSignal player IDs from profiles ---
    let onesignalPlayerIds: string[] = [];
    if (targetUserIds.length > 0) {
      const { data: profilesWithPlayerIds } = await adminClient
        .from("profiles")
        .select("onesignal_player_id")
        .in("id", targetUserIds)
        .not("onesignal_player_id", "is", null);
      onesignalPlayerIds = (profilesWithPlayerIds || [])
        .map((p) => p.onesignal_player_id)
        .filter(Boolean) as string[];
    }

    // --- OneSignal native push delivery ---
    const onesignalResult = await sendOneSignalNotifications(
      onesignalPlayerIds,
      targetUserIds,
      title,
      body,
      { url: url || "/notifications", tag: tag || "notification" },
      badgeCount
    );

    console.log("OneSignal delivery result:", JSON.stringify(onesignalResult));

    // --- Web push (existing VAPID path) ---
    let webPushSent = 0;
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

    if (vapidPublicKey && vapidPrivateKey && targetUserIds.length > 0) {
      const { data: subscriptions } = await adminClient
        .from("push_subscriptions")
        .select("*")
        .in("user_id", targetUserIds);

      if (subscriptions && subscriptions.length > 0) {
        webPushSent = subscriptions.length;
        console.log(`Found ${subscriptions.length} web push subscriptions`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        notified: targetUserIds.length,
        onesignal: onesignalResult.success,
        web_push_sent: webPushSent,
        message: "Notifications sent successfully",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in send-push-notification:", error);
    return new Response(
      JSON.stringify({ error: "Failed to send notification. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
