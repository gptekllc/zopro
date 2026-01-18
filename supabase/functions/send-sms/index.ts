import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// SMS Templates
const SMS_TEMPLATES = {
  invoice: "Hi {{customer_first_name}}, your invoice {{invoice_number}} is ready. View and pay: {{portal_link}}",
  portal_link: "Hi {{customer_first_name}}, access your {{company_name}} customer portal here: {{portal_link}}",
  technician_eta: "Hi {{customer_first_name}}, {{technician_name}} is on the way for {{job_title}}. ETA: {{eta_time}}",
};

interface SendSmsRequest {
  message_type: 'invoice' | 'portal_link' | 'technician_eta';
  recipient_phone: string;
  customer_id?: string;
  variables: Record<string, string>;
  metadata?: Record<string, any>;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client with user's token
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify JWT and get user
    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub;

    // Get user's company
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('id', userId)
      .single();

    if (profileError || !profile?.company_id) {
      return new Response(
        JSON.stringify({ error: 'User not associated with a company' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const companyId = profile.company_id;

    // Parse request body
    const body: SendSmsRequest = await req.json();
    const { message_type, recipient_phone, customer_id, variables, metadata } = body;

    // Validate required fields
    if (!message_type || !recipient_phone || !variables) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: message_type, recipient_phone, variables' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate message type
    if (!SMS_TEMPLATES[message_type]) {
      return new Response(
        JSON.stringify({ error: `Invalid message_type. Must be one of: ${Object.keys(SMS_TEMPLATES).join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate phone number format (basic E.164 validation)
    const phoneRegex = /^\+[1-9]\d{1,14}$/;
    if (!phoneRegex.test(recipient_phone)) {
      return new Response(
        JSON.stringify({ error: 'Invalid phone number format. Must be in E.164 format (e.g., +15551234567)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role client for admin operations
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // === CHECK 1: Global SMS Kill Switch ===
    const { data: globalSetting } = await adminClient
      .from('app_settings')
      .select('value')
      .eq('key', 'sms_global_enabled')
      .single();

    if (globalSetting?.value === false || globalSetting?.value === 'false') {
      await logSmsAttempt(adminClient, {
        company_id: companyId,
        customer_id: customer_id || null,
        recipient_phone,
        message_type,
        template_name: message_type,
        message_body: '',
        status: 'blocked',
        error_message: 'SMS service is temporarily disabled',
        error_code: 'GLOBAL_DISABLED',
        metadata,
        sent_by: userId,
      });

      return new Response(
        JSON.stringify({ error: 'SMS service is temporarily unavailable' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // === CHECK 2: Plan SMS Enabled ===
    const { data: subscription } = await adminClient
      .from('company_subscriptions')
      .select(`
        status,
        subscription_plans (
          sms_enabled,
          sms_monthly_limit,
          name
        )
      `)
      .eq('company_id', companyId)
      .in('status', ['active', 'trialing'])
      .single();

    const planData = subscription?.subscription_plans as any;
    if (!planData?.sms_enabled) {
      await logSmsAttempt(adminClient, {
        company_id: companyId,
        customer_id: customer_id || null,
        recipient_phone,
        message_type,
        template_name: message_type,
        message_body: '',
        status: 'blocked',
        error_message: `SMS is not available on the ${planData?.name || 'current'} plan`,
        error_code: 'PLAN_NOT_ALLOWED',
        metadata,
        sent_by: userId,
      });

      return new Response(
        JSON.stringify({ error: 'SMS is not available on your current plan. Upgrade to Professional or Enterprise.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // === CHECK 3: Company SMS Enabled ===
    const { data: smsSettings } = await adminClient
      .from('company_sms_settings')
      .select('sms_enabled')
      .eq('company_id', companyId)
      .single();

    // If no settings exist, create default (disabled)
    if (!smsSettings) {
      await adminClient
        .from('company_sms_settings')
        .insert({ company_id: companyId, sms_enabled: false });
      
      await logSmsAttempt(adminClient, {
        company_id: companyId,
        customer_id: customer_id || null,
        recipient_phone,
        message_type,
        template_name: message_type,
        message_body: '',
        status: 'blocked',
        error_message: 'SMS is disabled for your company',
        error_code: 'COMPANY_DISABLED',
        metadata,
        sent_by: userId,
      });

      return new Response(
        JSON.stringify({ error: 'SMS is disabled for your company. Contact your administrator to enable it.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!smsSettings.sms_enabled) {
      await logSmsAttempt(adminClient, {
        company_id: companyId,
        customer_id: customer_id || null,
        recipient_phone,
        message_type,
        template_name: message_type,
        message_body: '',
        status: 'blocked',
        error_message: 'SMS is disabled for your company',
        error_code: 'COMPANY_DISABLED',
        metadata,
        sent_by: userId,
      });

      return new Response(
        JSON.stringify({ error: 'SMS is disabled for your company. Contact your administrator to enable it.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // === CHECK 4: Usage Limits ===
    const { data: usageData } = await adminClient.rpc('get_sms_usage_for_period', {
      p_company_id: companyId
    });

    const usage = usageData?.[0];
    if (usage && !usage.can_send) {
      const periodEnd = new Date();
      periodEnd.setMonth(periodEnd.getMonth() + 1, 1);
      periodEnd.setDate(0);

      await logSmsAttempt(adminClient, {
        company_id: companyId,
        customer_id: customer_id || null,
        recipient_phone,
        message_type,
        template_name: message_type,
        message_body: '',
        status: 'blocked',
        error_message: `Monthly SMS limit reached (${usage.messages_sent}/${usage.messages_limit})`,
        error_code: 'LIMIT_REACHED',
        metadata,
        sent_by: userId,
      });

      return new Response(
        JSON.stringify({ 
          error: `Monthly SMS limit reached (${usage.messages_sent}/${usage.messages_limit}). Resets on ${periodEnd.toLocaleDateString()}.` 
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // === RENDER TEMPLATE ===
    let messageBody = SMS_TEMPLATES[message_type];
    for (const [key, value] of Object.entries(variables)) {
      messageBody = messageBody.replace(new RegExp(`{{${key}}}`, 'g'), value || '');
    }

    // === SEND SMS VIA TWILIO ===
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioPhoneNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

    if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
      console.error('Missing Twilio credentials');
      
      await logSmsAttempt(adminClient, {
        company_id: companyId,
        customer_id: customer_id || null,
        recipient_phone,
        message_type,
        template_name: message_type,
        message_body: messageBody,
        status: 'failed',
        error_message: 'SMS service is not configured',
        error_code: 'CONFIG_MISSING',
        metadata,
        sent_by: userId,
      });

      return new Response(
        JSON.stringify({ error: 'SMS service is not configured. Please contact support.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    try {
      // Call Twilio API
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
      const twilioAuth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

      const twilioResponse = await fetch(twilioUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${twilioAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: recipient_phone,
          From: twilioPhoneNumber,
          Body: messageBody,
        }),
      });

      const twilioData = await twilioResponse.json();

      if (!twilioResponse.ok) {
        console.error('Twilio error:', twilioData);

        await logSmsAttempt(adminClient, {
          company_id: companyId,
          customer_id: customer_id || null,
          recipient_phone,
          message_type,
          template_name: message_type,
          message_body: messageBody,
          status: 'failed',
          error_message: twilioData.message || 'Failed to send SMS',
          error_code: twilioData.code?.toString() || 'TWILIO_ERROR',
          metadata: { ...metadata, twilio_response: twilioData },
          sent_by: userId,
        });

        return new Response(
          JSON.stringify({ error: 'Failed to send SMS. Please try again later.' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // SUCCESS - Log and increment usage
      await logSmsAttempt(adminClient, {
        company_id: companyId,
        customer_id: customer_id || null,
        recipient_phone,
        message_type,
        template_name: message_type,
        message_body: messageBody,
        status: 'sent',
        twilio_sid: twilioData.sid,
        metadata: { ...metadata, twilio_response: { sid: twilioData.sid, status: twilioData.status } },
        sent_by: userId,
      });

      // Increment usage atomically
      await adminClient.rpc('increment_sms_usage', { p_company_id: companyId });

      return new Response(
        JSON.stringify({ 
          success: true, 
          message_sid: twilioData.sid,
          message: 'SMS sent successfully' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (twilioError: any) {
      console.error('Twilio API error:', twilioError);

      await logSmsAttempt(adminClient, {
        company_id: companyId,
        customer_id: customer_id || null,
        recipient_phone,
        message_type,
        template_name: message_type,
        message_body: messageBody,
        status: 'failed',
        error_message: twilioError.message || 'Network error',
        error_code: 'NETWORK_ERROR',
        metadata,
        sent_by: userId,
      });

      return new Response(
        JSON.stringify({ error: 'Failed to connect to SMS service. Please try again later.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error: any) {
    console.error('Send SMS error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// Helper function to log SMS attempts
async function logSmsAttempt(
  client: any,
  data: {
    company_id: string;
    customer_id: string | null;
    recipient_phone: string;
    message_type: string;
    template_name: string;
    message_body: string;
    status: 'sent' | 'failed' | 'blocked';
    twilio_sid?: string;
    error_message?: string;
    error_code?: string;
    metadata?: Record<string, any>;
    sent_by: string;
  }
) {
  try {
    await client.from('sms_logs').insert({
      company_id: data.company_id,
      customer_id: data.customer_id,
      recipient_phone: data.recipient_phone,
      message_type: data.message_type,
      template_name: data.template_name,
      message_body: data.message_body,
      status: data.status,
      twilio_sid: data.twilio_sid || null,
      error_message: data.error_message || null,
      error_code: data.error_code || null,
      metadata: data.metadata || null,
      sent_by: data.sent_by,
    });
  } catch (err) {
    console.error('Failed to log SMS attempt:', err);
  }
}
