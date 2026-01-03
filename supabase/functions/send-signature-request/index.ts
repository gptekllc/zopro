import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { Resend } from 'https://esm.sh/resend@2.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Get the secret key for HMAC signing
function getTokenSecret(): string {
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!secret) {
    throw new Error('Token secret not configured');
  }
  return secret;
}

// Generate a random token
function generateRandomToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

// Create HMAC signature for data
async function createHmacSignature(data: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const messageData = encoder.encode(data);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  return Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, '0')).join('');
}

// Generate a signed token
async function generateSignedToken(customerId: string, expiresAt: Date): Promise<string> {
  const secret = getTokenSecret();
  const randomToken = generateRandomToken();
  
  const tokenData = {
    customerId,
    expiresAt: expiresAt.toISOString(),
    nonce: randomToken,
  };
  
  const payload = btoa(JSON.stringify(tokenData));
  const signature = await createHmacSignature(payload, secret);
  
  return `${payload}.${signature}`;
}

interface SignatureRequestBody {
  documentType: 'quote' | 'invoice' | 'job';
  documentId: string;
  recipientEmail: string;
  recipientName: string;
  companyName: string;
  documentNumber: string;
  customerId: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    // Verify caller authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header provided');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create a user client with the provided auth header to verify the caller
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();

    if (userError || !user) {
      console.error('Failed to verify user:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: SignatureRequestBody = await req.json();
    const { documentType, documentId, recipientEmail, recipientName, companyName, documentNumber, customerId } = body;

    console.log('Processing signature request:', { documentType, documentId, recipientEmail });

    if (!documentType || !documentId || !recipientEmail || !customerId) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate magic link token
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 72); // 72 hour expiry for signature requests

    const signedToken = await generateSignedToken(customerId, expiresAt);
    
    // Get the app URL from the request origin
    const origin = req.headers.get('origin') || 'https://lovable.dev';
    
    // Build the magic link - the customer portal will handle the document
    const magicLink = `${origin}/customer-portal?token=${encodeURIComponent(signedToken)}&customer=${customerId}&sign=${documentType}&doc=${documentId}`;

    console.log('Generated signature request magic link');

    // Document type display labels
    const documentTypeLabels: Record<string, string> = {
      quote: 'Quote',
      invoice: 'Invoice',
      job: 'Job Completion',
    };

    const documentLabel = documentTypeLabels[documentType] || documentType;

    // Send email if Resend is configured
    if (!resendApiKey) {
      console.log('RESEND_API_KEY not configured. Magic link:', magicLink);
      return new Response(
        JSON.stringify({ success: true, message: 'Signature request generated (email not configured)', magicLink }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    try {
      const resend = new Resend(resendApiKey);
      
      await resend.emails.send({
        from: "ZoPro Notifications <noreply@email.zopro.app>",
        to: [recipientEmail],
        subject: `Signature Required: ${documentLabel} ${documentNumber}`,
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); border-radius: 12px 12px 0 0; padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0; font-size: 24px;">Signature Required</h1>
            </div>
            
            <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 12px 12px;">
              <p style="color: #374151; font-size: 16px;">Hello ${recipientName || 'Valued Customer'},</p>
              
              <p style="color: #374151; font-size: 16px;">
                <strong>${companyName || 'Our Company'}</strong> has requested your signature on the following document:
              </p>
              
              <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
                <p style="color: #6b7280; font-size: 14px; margin: 0 0 5px 0;">${documentLabel}</p>
                <p style="color: #111827; font-size: 20px; font-weight: 600; margin: 0;">${documentNumber}</p>
              </div>
              
              <p style="text-align: center; margin: 30px 0;">
                <a href="${magicLink}" style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 500; font-size: 16px;">
                  Review & Sign Document
                </a>
              </p>
              
              <p style="color: #9ca3af; font-size: 14px; text-align: center;">
                This link will expire in 72 hours.
              </p>
              
              <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;" />
              
              <p style="color: #9ca3af; font-size: 12px; text-align: center;">
                If you didn't expect this request, please contact ${companyName || 'the company'} directly.
              </p>
            </div>
          </div>
        `,
      });
      
      console.log('Signature request email sent successfully');
      
      return new Response(
        JSON.stringify({ success: true, message: 'Signature request sent successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (emailError) {
      console.error('Failed to send signature request email:', emailError);
      return new Response(
        JSON.stringify({ error: 'Failed to send email', details: emailError instanceof Error ? emailError.message : 'Unknown error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Error in send-signature-request function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
