import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user is super admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user is super admin
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "super_admin");

    if (!roles || roles.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Not authorized - super admin required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { provider, eventType } = await req.json();

    if (!provider || !eventType) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing provider or eventType" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Log the test event
    const startTime = Date.now();
    
    const { data: logEntry, error: logError } = await supabase
      .from("webhook_event_logs")
      .insert({
        provider,
        event_type: eventType,
        event_id: `test_${Date.now()}`,
        status: "received",
        payload: { 
          test: true, 
          triggered_by: userData.user.email,
          timestamp: new Date().toISOString()
        },
      })
      .select("id")
      .single();

    if (logError) {
      console.error("Failed to create log entry:", logError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to create log entry" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Simulate processing
    await new Promise(resolve => setTimeout(resolve, 100));

    // Update log entry to processed
    const processingTime = Date.now() - startTime;
    await supabase
      .from("webhook_event_logs")
      .update({
        status: "processed",
        processing_time_ms: processingTime,
      })
      .eq("id", logEntry.id);

    console.log(`Test webhook processed: ${provider}/${eventType} in ${processingTime}ms`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Test ${eventType} event created successfully`,
        processingTime 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Test webhook error:", errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
