import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { Resend } from 'https://esm.sh/resend@2.0.0';
import { encode as hexEncode } from 'https://deno.land/std@0.190.0/encoding/hex.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Get the secret key for HMAC signing
function getTokenSecret(): string {
  // Use service role key as the secret for HMAC (it's already secret and available)
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

// Verify and decode a signed token
async function verifySignedToken(signedToken: string): Promise<{ customerId: string; expiresAt: Date } | null> {
  try {
    const parts = signedToken.split('.');
    if (parts.length !== 2) {
      console.log('Invalid token format: missing signature');
      return null;
    }
    
    const [payload, signature] = parts;
    const secret = getTokenSecret();
    
    // Verify signature
    const expectedSignature = await createHmacSignature(payload, secret);
    if (signature !== expectedSignature) {
      console.log('Invalid token: signature mismatch');
      return null;
    }
    
    // Decode payload
    const tokenData = JSON.parse(atob(payload));
    const expiresAt = new Date(tokenData.expiresAt);
    
    // Check expiry
    if (expiresAt < new Date()) {
      console.log('Token expired');
      return null;
    }
    
    return {
      customerId: tokenData.customerId,
      expiresAt,
    };
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    
    const body = await req.json();
    const { action } = body;

    if (action === 'send-link') {
      const { email } = body;
      
      if (!email) {
        return new Response(
          JSON.stringify({ error: 'Email is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Looking up customer with email:', email);

      // Find customer by email
      const { data: customers, error: customerError } = await adminClient
        .from('customers')
        .select('id, name, email, company_id, companies(name)')
        .eq('email', email.toLowerCase())
        .limit(1);

      if (customerError) {
        console.error('Error finding customer:', customerError);
        throw customerError;
      }

      if (!customers || customers.length === 0) {
        // Don't reveal if email exists or not for security
        console.log('No customer found with email:', email);
        return new Response(
          JSON.stringify({ success: true, message: 'If an account exists, a magic link has been sent.' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const customer = customers[0];
      console.log('Found customer:', customer.id, customer.name);

      // Generate a signed token
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiry

      const signedToken = await generateSignedToken(customer.id, expiresAt);
      
      // Get the app URL from environment or request origin
      const origin = Deno.env.get('APP_BASE_URL') || 'https://zopro.app';
      const magicLink = `${origin}/customer-portal?token=${encodeURIComponent(signedToken)}&customer=${customer.id}`;

      console.log('Generated magic link for customer');

      // Send email if Resend is configured
      if (resendApiKey) {
        try {
          const resend = new Resend(resendApiKey);
          const companyName = (customer as any).companies?.name || 'Our Company';
          
          await resend.emails.send({
            from: "ZoPro Notifications <noreply@email.zopro.app>",
            to: [email],
            subject: `Your ${companyName} Customer Portal Access`,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #333;">Customer Portal Access</h1>
                <p>Hello ${customer.name},</p>
                <p>Click the button below to access your customer portal where you can view your invoices and service history:</p>
                <p style="margin: 30px 0;">
                  <a href="${magicLink}" style="background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                    Access Customer Portal
                  </a>
                </p>
                <p style="color: #666; font-size: 14px;">This link will expire in 24 hours.</p>
                <p style="color: #666; font-size: 14px;">If you didn't request this link, you can safely ignore this email.</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
                <p style="color: #999; font-size: 12px;">${companyName}</p>
                <p style="color: #999; font-size: 12px;">© ${new Date().getFullYear()} <a href="https://zopro.app" style="color: #999;">ZoPro</a></p>
              </div>
            `,
          });
          console.log('Email sent successfully');
        } catch (emailError) {
          console.error('Failed to send email:', emailError);
          // Continue anyway - in development, we'll just log the link
        }
      } else {
        console.log('RESEND_API_KEY not configured. Magic link:', magicLink);
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Magic link sent!' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'verify') {
      const { token, customerId } = body;
      
      if (!token || !customerId) {
        return new Response(
          JSON.stringify({ valid: false, error: 'Missing token or customer ID' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify signed token
      const tokenData = await verifySignedToken(token);
      
      if (!tokenData) {
        return new Response(
          JSON.stringify({ valid: false, error: 'Invalid or expired token' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (tokenData.customerId !== customerId) {
        console.log('Token customer ID mismatch');
        return new Response(
          JSON.stringify({ valid: false, error: 'Invalid token' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch customer data with expanded company info including payment settings
      const { data: customer, error: customerError } = await adminClient
        .from('customers')
        .select('id, name, email, phone, company_id, companies(id, name, logo_url, address, city, state, zip, phone, email, stripe_payments_enabled, default_payment_method)')
        .eq('id', customerId)
        .single();

      if (customerError || !customer) {
        console.error('Customer not found:', customerError);
        return new Response(
          JSON.stringify({ valid: false, error: 'Customer not found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch invoices for this customer
      const { data: invoices } = await adminClient
        .from('invoices')
        .select('id, invoice_number, status, total, created_at, due_date')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      // Fetch jobs for this customer with more details
      const { data: jobs } = await adminClient
        .from('jobs')
        .select('id, job_number, title, description, status, priority, scheduled_start, scheduled_end, actual_start, actual_end, notes, created_at, completion_signed_at, completion_signed_by')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      // Fetch quotes for this customer
      const { data: quotes } = await adminClient
        .from('quotes')
        .select('id, quote_number, status, total, created_at, valid_until, notes')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      console.log('Token verified successfully for customer:', customer.name);

      return new Response(
        JSON.stringify({
          valid: true,
          customer: {
            id: customer.id,
            name: customer.name,
            email: customer.email,
            phone: customer.phone,
            company: customer.companies,
          },
          invoices: invoices || [],
          jobs: jobs || [],
          quotes: quotes || [],
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'download-invoice') {
      const { invoiceId, customerId, token } = body;
      
      if (!invoiceId || !customerId || !token) {
        return new Response(
          JSON.stringify({ error: 'Missing required parameters' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify signed token
      const tokenData = await verifySignedToken(token);
      
      if (!tokenData || tokenData.customerId !== customerId) {
        return new Response(
          JSON.stringify({ error: 'Invalid or expired token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify invoice belongs to customer
      const { data: invoice, error: invoiceError } = await adminClient
        .from('invoices')
        .select('*, companies(*), customers(*)')
        .eq('id', invoiceId)
        .eq('customer_id', customerId)
        .single();

      if (invoiceError || !invoice) {
        console.error('Invoice not found or access denied:', invoiceError);
        return new Response(
          JSON.stringify({ error: 'Invoice not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch invoice items
      const { data: items } = await adminClient
        .from('invoice_items')
        .select('*')
        .eq('invoice_id', invoiceId);

      // Generate HTML for the invoice
      const company = invoice.companies;
      const customer = invoice.customers;
      
      const formatDate = (dateStr: string) => {
        if (!dateStr) return 'N/A';
        return new Date(dateStr).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
      };

      const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
        }).format(amount);
      };

      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Invoice ${invoice.invoice_number}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #333; line-height: 1.6; }
    .container { max-width: 800px; margin: 0 auto; padding: 40px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
    .company-info h1 { font-size: 28px; color: #1a1a1a; margin-bottom: 5px; }
    .company-info p { color: #666; font-size: 14px; }
    .document-info { text-align: right; }
    .document-type { font-size: 32px; font-weight: bold; color: #2563eb; margin-bottom: 10px; }
    .document-number { font-size: 18px; color: #666; }
    .addresses { display: flex; justify-content: space-between; margin-bottom: 40px; padding: 20px; background: #f8f9fa; border-radius: 8px; }
    .address-block h3 { font-size: 12px; text-transform: uppercase; color: #888; margin-bottom: 10px; }
    .address-block p { margin: 2px 0; }
    .dates { margin-bottom: 30px; }
    .dates p { display: inline-block; margin-right: 40px; }
    .dates strong { color: #666; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    thead { background: #1a1a1a; color: white; }
    th { padding: 12px 15px; text-align: left; font-weight: 500; font-size: 14px; }
    th:last-child { text-align: right; }
    td { padding: 15px; border-bottom: 1px solid #eee; }
    td:last-child { text-align: right; }
    .totals { margin-left: auto; width: 300px; }
    .totals-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
    .totals-row.total { border-bottom: none; font-size: 20px; font-weight: bold; color: #2563eb; padding-top: 15px; }
    .notes { margin-top: 40px; padding: 20px; background: #f8f9fa; border-radius: 8px; }
    .notes h3 { font-size: 14px; color: #888; margin-bottom: 10px; }
    .footer { margin-top: 60px; text-align: center; color: #888; font-size: 12px; }
    @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="company-info">
        <h1>${company?.name || 'Company'}</h1>
        ${company?.address ? `<p>${company.address}</p>` : ''}
        ${company?.city || company?.state || company?.zip ? `<p>${[company.city, company.state, company.zip].filter(Boolean).join(', ')}</p>` : ''}
        ${company?.phone ? `<p>${company.phone}</p>` : ''}
        ${company?.email ? `<p>${company.email}</p>` : ''}
      </div>
      <div class="document-info">
        <div class="document-type">INVOICE</div>
        <div class="document-number">${invoice.invoice_number}</div>
      </div>
    </div>

    <div class="addresses">
      <div class="address-block">
        <h3>Bill To</h3>
        <p><strong>${customer?.name || 'Customer'}</strong></p>
        ${customer?.address ? `<p>${customer.address}</p>` : ''}
        ${customer?.city || customer?.state || customer?.zip ? `<p>${[customer.city, customer.state, customer.zip].filter(Boolean).join(', ')}</p>` : ''}
        ${customer?.email ? `<p>${customer.email}</p>` : ''}
        ${customer?.phone ? `<p>${customer.phone}</p>` : ''}
      </div>
    </div>

    <div class="dates">
      <p><strong>Invoice Date:</strong> ${formatDate(invoice.created_at)}</p>
      ${invoice.due_date ? `<p><strong>Due Date:</strong> ${formatDate(invoice.due_date)}</p>` : ''}
    </div>

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th>Qty</th>
          <th>Unit Price</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        ${(items || []).map((item: any) => `
          <tr>
            <td>${item.description}</td>
            <td>${item.quantity}</td>
            <td>${formatCurrency(Number(item.unit_price))}</td>
            <td>${formatCurrency(Number(item.total))}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="totals">
      <div class="totals-row">
        <span>Subtotal</span>
        <span>${formatCurrency(Number(invoice.subtotal))}</span>
      </div>
      <div class="totals-row">
        <span>Tax</span>
        <span>${formatCurrency(Number(invoice.tax))}</span>
      </div>
      <div class="totals-row total">
        <span>Total</span>
        <span>${formatCurrency(Number(invoice.total))}</span>
      </div>
    </div>

    ${invoice.notes ? `
      <div class="notes">
        <h3>Notes</h3>
        <p>${invoice.notes}</p>
      </div>
    ` : ''}

    <div class="footer">
      <p>Thank you for your business!</p>
    </div>
  </div>
</body>
</html>
      `;

      console.log('Generated invoice PDF HTML for:', invoice.invoice_number);

      return new Response(
        JSON.stringify({ html, invoiceNumber: invoice.invoice_number }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'download-quote') {
      const { quoteId, customerId, token } = body;
      
      if (!quoteId || !customerId || !token) {
        return new Response(
          JSON.stringify({ error: 'Missing required parameters' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify signed token
      const tokenData = await verifySignedToken(token);
      
      if (!tokenData || tokenData.customerId !== customerId) {
        return new Response(
          JSON.stringify({ error: 'Invalid or expired token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify quote belongs to customer
      const { data: quote, error: quoteError } = await adminClient
        .from('quotes')
        .select('*, companies(*), customers(*)')
        .eq('id', quoteId)
        .eq('customer_id', customerId)
        .single();

      if (quoteError || !quote) {
        console.error('Quote not found or access denied:', quoteError);
        return new Response(
          JSON.stringify({ error: 'Quote not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch quote items
      const { data: items } = await adminClient
        .from('quote_items')
        .select('*')
        .eq('quote_id', quoteId);

      const company = quote.companies;
      const customer = quote.customers;
      
      const formatDate = (dateStr: string) => {
        if (!dateStr) return 'N/A';
        return new Date(dateStr).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
      };

      const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
        }).format(amount);
      };

      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Quote ${quote.quote_number}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #333; line-height: 1.6; }
    .container { max-width: 800px; margin: 0 auto; padding: 40px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
    .company-info h1 { font-size: 28px; color: #1a1a1a; margin-bottom: 5px; }
    .company-info p { color: #666; font-size: 14px; }
    .document-info { text-align: right; }
    .document-type { font-size: 32px; font-weight: bold; color: #2563eb; margin-bottom: 10px; }
    .document-number { font-size: 18px; color: #666; }
    .addresses { display: flex; justify-content: space-between; margin-bottom: 40px; padding: 20px; background: #f8f9fa; border-radius: 8px; }
    .address-block h3 { font-size: 12px; text-transform: uppercase; color: #888; margin-bottom: 10px; }
    .address-block p { margin: 2px 0; }
    .dates { margin-bottom: 30px; }
    .dates p { display: inline-block; margin-right: 40px; }
    .dates strong { color: #666; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    thead { background: #1a1a1a; color: white; }
    th { padding: 12px 15px; text-align: left; font-weight: 500; font-size: 14px; }
    th:last-child { text-align: right; }
    td { padding: 15px; border-bottom: 1px solid #eee; }
    td:last-child { text-align: right; }
    .totals { margin-left: auto; width: 300px; }
    .totals-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
    .totals-row.total { border-bottom: none; font-size: 20px; font-weight: bold; color: #2563eb; padding-top: 15px; }
    .notes { margin-top: 40px; padding: 20px; background: #f8f9fa; border-radius: 8px; }
    .notes h3 { font-size: 14px; color: #888; margin-bottom: 10px; }
    .footer { margin-top: 60px; text-align: center; color: #888; font-size: 12px; }
    .status { display: inline-block; padding: 4px 12px; border-radius: 16px; font-size: 12px; font-weight: 500; text-transform: uppercase; margin-left: 10px; }
    .status-approved { background: #dcfce7; color: #166534; }
    .status-pending { background: #fef3c7; color: #92400e; }
    .status-sent { background: #dbeafe; color: #1e40af; }
    @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="company-info">
        <h1>${company?.name || 'Company'}</h1>
        ${company?.address ? `<p>${company.address}</p>` : ''}
        ${company?.city || company?.state || company?.zip ? `<p>${[company.city, company.state, company.zip].filter(Boolean).join(', ')}</p>` : ''}
        ${company?.phone ? `<p>${company.phone}</p>` : ''}
        ${company?.email ? `<p>${company.email}</p>` : ''}
      </div>
      <div class="document-info">
        <div class="document-type">QUOTE</div>
        <div class="document-number">${quote.quote_number}
          <span class="status status-${quote.status}">${quote.status}</span>
        </div>
      </div>
    </div>

    <div class="addresses">
      <div class="address-block">
        <h3>Prepared For</h3>
        <p><strong>${customer?.name || 'Customer'}</strong></p>
        ${customer?.address ? `<p>${customer.address}</p>` : ''}
        ${customer?.city || customer?.state || customer?.zip ? `<p>${[customer.city, customer.state, customer.zip].filter(Boolean).join(', ')}</p>` : ''}
        ${customer?.email ? `<p>${customer.email}</p>` : ''}
        ${customer?.phone ? `<p>${customer.phone}</p>` : ''}
      </div>
    </div>

    <div class="dates">
      <p><strong>Quote Date:</strong> ${formatDate(quote.created_at)}</p>
      ${quote.valid_until ? `<p><strong>Valid Until:</strong> ${formatDate(quote.valid_until)}</p>` : ''}
    </div>

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th>Qty</th>
          <th>Unit Price</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        ${(items || []).map((item: any) => `
          <tr>
            <td>${item.description}</td>
            <td>${item.quantity}</td>
            <td>${formatCurrency(Number(item.unit_price))}</td>
            <td>${formatCurrency(Number(item.total))}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="totals">
      <div class="totals-row">
        <span>Subtotal</span>
        <span>${formatCurrency(Number(quote.subtotal))}</span>
      </div>
      <div class="totals-row">
        <span>Tax</span>
        <span>${formatCurrency(Number(quote.tax))}</span>
      </div>
      <div class="totals-row total">
        <span>Total</span>
        <span>${formatCurrency(Number(quote.total))}</span>
      </div>
    </div>

    ${quote.notes ? `
      <div class="notes">
        <h3>Notes</h3>
        <p>${quote.notes}</p>
      </div>
    ` : ''}

    <div class="footer">
      <p>Thank you for considering our services!</p>
    </div>
  </div>
</body>
</html>
      `;

      console.log('Generated quote PDF HTML for:', quote.quote_number);

      return new Response(
        JSON.stringify({ html, quoteNumber: quote.quote_number }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'download-job') {
      const { jobId, customerId, token } = body;
      
      if (!jobId || !customerId || !token) {
        return new Response(
          JSON.stringify({ error: 'Missing required parameters' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify signed token
      const tokenData = await verifySignedToken(token);
      
      if (!tokenData || tokenData.customerId !== customerId) {
        return new Response(
          JSON.stringify({ error: 'Invalid or expired token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify job belongs to customer
      const { data: job, error: jobError } = await adminClient
        .from('jobs')
        .select('*, companies(*), customers(*)')
        .eq('id', jobId)
        .eq('customer_id', customerId)
        .single();

      if (jobError || !job) {
        console.error('Job not found or access denied:', jobError);
        return new Response(
          JSON.stringify({ error: 'Job not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch job items
      const { data: items } = await adminClient
        .from('job_items')
        .select('*')
        .eq('job_id', jobId);

      const company = job.companies;
      const customer = job.customers;
      
      const formatDate = (dateStr: string) => {
        if (!dateStr) return 'N/A';
        return new Date(dateStr).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
      };

      const formatDateTime = (dateStr: string) => {
        if (!dateStr) return 'N/A';
        return new Date(dateStr).toLocaleString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        });
      };

      const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
        }).format(amount);
      };

      const statusColors: Record<string, string> = {
        draft: 'background: #f3f4f6; color: #374151;',
        scheduled: 'background: #dbeafe; color: #1e40af;',
        in_progress: 'background: #fef3c7; color: #92400e;',
        completed: 'background: #dcfce7; color: #166534;',
        invoiced: 'background: #fce7f3; color: #9d174d;',
        paid: 'background: #d1fae5; color: #065f46;',
      };

      const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Job ${job.job_number}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #333; line-height: 1.6; }
    .container { max-width: 800px; margin: 0 auto; padding: 40px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; }
    .company-info h1 { font-size: 28px; color: #1a1a1a; margin-bottom: 5px; }
    .company-info p { color: #666; font-size: 14px; }
    .document-info { text-align: right; }
    .document-type { font-size: 32px; font-weight: bold; color: #059669; margin-bottom: 10px; }
    .document-number { font-size: 18px; color: #666; }
    .addresses { display: flex; justify-content: space-between; margin-bottom: 40px; padding: 20px; background: #f8f9fa; border-radius: 8px; }
    .address-block h3 { font-size: 12px; text-transform: uppercase; color: #888; margin-bottom: 10px; }
    .address-block p { margin: 2px 0; }
    .job-title { font-size: 24px; font-weight: bold; margin-bottom: 20px; }
    .job-description { margin-bottom: 30px; padding: 15px; background: #f8f9fa; border-radius: 8px; }
    .schedule-info { margin-bottom: 30px; }
    .schedule-info h3 { font-size: 14px; text-transform: uppercase; color: #888; margin-bottom: 15px; }
    .schedule-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
    .schedule-item { padding: 10px; background: #f0fdf4; border-radius: 8px; }
    .schedule-item strong { display: block; color: #059669; font-size: 12px; text-transform: uppercase; margin-bottom: 5px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    thead { background: #1a1a1a; color: white; }
    th { padding: 12px 15px; text-align: left; font-weight: 500; font-size: 14px; }
    th:last-child { text-align: right; }
    td { padding: 15px; border-bottom: 1px solid #eee; }
    td:last-child { text-align: right; }
    .totals { margin-left: auto; width: 300px; }
    .totals-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
    .totals-row.total { border-bottom: none; font-size: 20px; font-weight: bold; color: #059669; padding-top: 15px; }
    .notes { margin-top: 40px; padding: 20px; background: #f8f9fa; border-radius: 8px; }
    .notes h3 { font-size: 14px; color: #888; margin-bottom: 10px; }
    .footer { margin-top: 60px; text-align: center; color: #888; font-size: 12px; }
    .status { display: inline-block; padding: 4px 12px; border-radius: 16px; font-size: 12px; font-weight: 500; text-transform: uppercase; margin-left: 10px; }
    .signature-block { margin-top: 30px; padding: 20px; background: #f0fdf4; border-radius: 8px; }
    .signature-block h3 { color: #059669; margin-bottom: 10px; }
    @media print { body { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="company-info">
        <h1>${company?.name || 'Company'}</h1>
        ${company?.address ? `<p>${company.address}</p>` : ''}
        ${company?.city || company?.state || company?.zip ? `<p>${[company.city, company.state, company.zip].filter(Boolean).join(', ')}</p>` : ''}
        ${company?.phone ? `<p>${company.phone}</p>` : ''}
        ${company?.email ? `<p>${company.email}</p>` : ''}
      </div>
      <div class="document-info">
        <div class="document-type">JOB DETAILS</div>
        <div class="document-number">${job.job_number}
          <span class="status" style="${statusColors[job.status] || ''}">${job.status.replace('_', ' ')}</span>
        </div>
      </div>
    </div>

    <div class="addresses">
      <div class="address-block">
        <h3>Customer</h3>
        <p><strong>${customer?.name || 'Customer'}</strong></p>
        ${customer?.address ? `<p>${customer.address}</p>` : ''}
        ${customer?.city || customer?.state || customer?.zip ? `<p>${[customer.city, customer.state, customer.zip].filter(Boolean).join(', ')}</p>` : ''}
        ${customer?.email ? `<p>${customer.email}</p>` : ''}
        ${customer?.phone ? `<p>${customer.phone}</p>` : ''}
      </div>
    </div>

    <h2 class="job-title">${job.title}</h2>
    
    ${job.description ? `
      <div class="job-description">
        <p>${job.description}</p>
      </div>
    ` : ''}

    ${job.scheduled_start || job.actual_start ? `
      <div class="schedule-info">
        <h3>Schedule Information</h3>
        <div class="schedule-grid">
          ${job.scheduled_start ? `
            <div class="schedule-item">
              <strong>Scheduled Start</strong>
              ${formatDateTime(job.scheduled_start)}
            </div>
          ` : ''}
          ${job.scheduled_end ? `
            <div class="schedule-item">
              <strong>Scheduled End</strong>
              ${formatDateTime(job.scheduled_end)}
            </div>
          ` : ''}
          ${job.actual_start ? `
            <div class="schedule-item">
              <strong>Actual Start</strong>
              ${formatDateTime(job.actual_start)}
            </div>
          ` : ''}
          ${job.actual_end ? `
            <div class="schedule-item">
              <strong>Actual End</strong>
              ${formatDateTime(job.actual_end)}
            </div>
          ` : ''}
        </div>
      </div>
    ` : ''}

    ${items && items.length > 0 ? `
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th>Qty</th>
            <th>Unit Price</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((item: any) => `
            <tr>
              <td>${item.description}</td>
              <td>${item.quantity}</td>
              <td>${formatCurrency(Number(item.unit_price))}</td>
              <td>${formatCurrency(Number(item.total))}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>

      <div class="totals">
        <div class="totals-row">
          <span>Subtotal</span>
          <span>${formatCurrency(Number(job.subtotal || 0))}</span>
        </div>
        <div class="totals-row">
          <span>Tax</span>
          <span>${formatCurrency(Number(job.tax || 0))}</span>
        </div>
        <div class="totals-row total">
          <span>Total</span>
          <span>${formatCurrency(Number(job.total || 0))}</span>
        </div>
      </div>
    ` : ''}

    ${job.notes ? `
      <div class="notes">
        <h3>Notes</h3>
        <p>${job.notes}</p>
      </div>
    ` : ''}

    ${job.completion_signed_at ? `
      <div class="signature-block">
        <h3>✓ Job Completion Confirmed</h3>
        <p>Signed by ${job.completion_signed_by} on ${formatDate(job.completion_signed_at)}</p>
      </div>
    ` : ''}

    <div class="footer">
      <p>Thank you for your business!</p>
    </div>
  </div>
</body>
</html>
      `;

      console.log('Generated job PDF HTML for:', job.job_number);

      return new Response(
        JSON.stringify({ html, jobNumber: job.job_number }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'approve-quote') {
      const { quoteId, customerId, token, signatureData, signerName } = body;
      
      if (!quoteId || !customerId || !token) {
        return new Response(
          JSON.stringify({ error: 'Missing required parameters' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Signature is required for quote approval
      if (!signatureData || !signerName) {
        return new Response(
          JSON.stringify({ error: 'Signature is required to approve quote' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify signed token
      const tokenData = await verifySignedToken(token);
      
      if (!tokenData || tokenData.customerId !== customerId) {
        return new Response(
          JSON.stringify({ error: 'Invalid or expired token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify quote belongs to customer and update status
      const { data: quote, error: quoteError } = await adminClient
        .from('quotes')
        .select('*, companies(*)')
        .eq('id', quoteId)
        .eq('customer_id', customerId)
        .single();

      if (quoteError || !quote) {
        console.error('Quote not found or access denied:', quoteError);
        return new Response(
          JSON.stringify({ error: 'Quote not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (quote.status === 'approved') {
        return new Response(
          JSON.stringify({ success: true, message: 'Quote already approved' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get client IP from headers
      const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                       req.headers.get('x-real-ip') || 
                       'unknown';

      // Save signature first
      const { data: signature, error: signatureError } = await adminClient
        .from('signatures')
        .insert({
          company_id: quote.company_id,
          customer_id: customerId,
          document_type: 'quote',
          document_id: quoteId,
          signature_data: signatureData,
          signer_name: signerName,
          signer_ip: clientIp,
        })
        .select()
        .single();

      if (signatureError) {
        console.error('Error saving signature:', signatureError);
        return new Response(
          JSON.stringify({ error: 'Failed to save signature' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Signature saved:', signature.id);

      // Update quote status to approved with signature reference
      const { error: updateError } = await adminClient
        .from('quotes')
        .update({ 
          status: 'approved', 
          updated_at: new Date().toISOString(),
          signature_id: signature.id,
          signed_at: new Date().toISOString(),
        })
        .eq('id', quoteId);

      if (updateError) {
        console.error('Error updating quote:', updateError);
        throw updateError;
      }

      console.log('Quote approved with signature:', quote.quote_number);

      // Auto-create a draft job from the approved quote
      let jobNumber = '';
      try {
        // Generate job number using the database function
        const { data: jobNumberData, error: jobNumberError } = await adminClient
          .rpc('generate_job_number', { _company_id: quote.company_id });
        
        if (jobNumberError) {
          console.error('Error generating job number:', jobNumberError);
          throw jobNumberError;
        }
        jobNumber = jobNumberData;

        // Fetch customer data for the job
        const { data: customer } = await adminClient
          .from('customers')
          .select('name, email')
          .eq('id', customerId)
          .single();

        // Create the job
        const { data: newJob, error: jobError } = await adminClient
          .from('jobs')
          .insert({
            company_id: quote.company_id,
            customer_id: customerId,
            quote_id: quoteId,
            job_number: jobNumber,
            title: `Job from Quote ${quote.quote_number}`,
            description: quote.notes || null,
            status: 'draft',
            priority: 'medium',
          })
          .select()
          .single();

        if (jobError) {
          console.error('Error creating job:', jobError);
        } else {
          console.log('Auto-created job:', newJob.job_number);
        }

        // Create notifications for admins/managers about the new job
        const { data: admins } = await adminClient
          .from('profiles')
          .select('id')
          .eq('company_id', quote.company_id)
          .in('role', ['admin', 'manager']);

        if (admins && admins.length > 0) {
          const notifications = admins.map((admin: { id: string }) => ({
            user_id: admin.id,
            type: 'quote_approved',
            title: 'Quote Approved - Job Created',
            message: `${customer?.name || 'A customer'} approved Quote ${quote.quote_number}. Job ${jobNumber} has been created.`,
            data: { quoteId, quoteNumber: quote.quote_number, jobNumber, customerName: customer?.name, total: quote.total },
          }));
          
          await adminClient.from('notifications').insert(notifications);
          console.log('Admin notifications created:', notifications.length);
        }
      } catch (jobCreateError) {
        console.error('Failed to auto-create job:', jobCreateError);
        // Continue anyway - quote is still approved
      }

      // Send notification email to company
      const resendApiKey = Deno.env.get('RESEND_API_KEY');
      if (resendApiKey && quote.companies?.email) {
        try {
          const resend = new Resend(resendApiKey);
          
          // Fetch customer data for the notification
          const { data: customer } = await adminClient
            .from('customers')
            .select('name, email')
            .eq('id', customerId)
            .single();
          
          await resend.emails.send({
            from: `Quote Notifications <onboarding@resend.dev>`,
            to: [quote.companies.email],
            subject: `Quote ${quote.quote_number} Approved - Job ${jobNumber} Created`,
            html: `
              <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h1 style="color: #22c55e;">Quote Approved!</h1>
                <p>Great news! ${customer?.name || 'A customer'} has approved quote <strong>${quote.quote_number}</strong>.</p>
                <p><strong>Total:</strong> $${Number(quote.total).toFixed(2)}</p>
                <p><strong>Signed by:</strong> ${signerName}</p>
                ${jobNumber ? `<p><strong>Job ${jobNumber}</strong> has been automatically created and is ready for scheduling.</p>` : ''}
                <p>You can now proceed with scheduling the work.</p>
              </div>
            `,
          });
          console.log('Notification email sent to company');
        } catch (emailError) {
          console.error('Failed to send notification email:', emailError);
        }
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Quote approved successfully', jobCreated: !!jobNumber, jobNumber }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle job completion signature from customer
    if (action === 'sign-job-completion') {
      const { jobId, customerId, token, signatureData, signerName } = body;
      
      if (!jobId || !customerId || !token) {
        return new Response(
          JSON.stringify({ error: 'Missing required parameters' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!signatureData || !signerName) {
        return new Response(
          JSON.stringify({ error: 'Signature is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify signed token
      const tokenData = await verifySignedToken(token);
      
      if (!tokenData || tokenData.customerId !== customerId) {
        return new Response(
          JSON.stringify({ error: 'Invalid or expired token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify job belongs to customer
      const { data: job, error: jobError } = await adminClient
        .from('jobs')
        .select('*, companies(*)')
        .eq('id', jobId)
        .eq('customer_id', customerId)
        .single();

      if (jobError || !job) {
        console.error('Job not found or access denied:', jobError);
        return new Response(
          JSON.stringify({ error: 'Job not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Get client IP
      const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                       req.headers.get('x-real-ip') || 
                       'unknown';

      // Save signature
      const { data: signature, error: signatureError } = await adminClient
        .from('signatures')
        .insert({
          company_id: job.company_id,
          customer_id: customerId,
          document_type: 'job_completion',
          document_id: jobId,
          signature_data: signatureData,
          signer_name: signerName,
          signer_ip: clientIp,
        })
        .select()
        .single();

      if (signatureError) {
        console.error('Error saving signature:', signatureError);
        return new Response(
          JSON.stringify({ error: 'Failed to save signature' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update job with completion signature
      const { error: updateError } = await adminClient
        .from('jobs')
        .update({
          completion_signature_id: signature.id,
          completion_signed_at: new Date().toISOString(),
          completion_signed_by: signerName,
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);

      if (updateError) {
        console.error('Error updating job:', updateError);
        throw updateError;
      }

      console.log('Job completion signed:', job.job_number);

      return new Response(
        JSON.stringify({ success: true, message: 'Job completion confirmed', promptFeedback: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle customer feedback submission
    if (action === 'submit-feedback') {
      const { jobId, customerId, token, rating, feedbackText } = body;
      
      if (!jobId || !customerId || !token || !rating) {
        return new Response(
          JSON.stringify({ error: 'Missing required parameters' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify signed token
      const tokenData = await verifySignedToken(token);
      
      if (!tokenData || tokenData.customerId !== customerId) {
        return new Response(
          JSON.stringify({ error: 'Invalid or expired token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify job belongs to customer
      const { data: job, error: jobError } = await adminClient
        .from('jobs')
        .select('id, job_number, company_id, companies(email, name)')
        .eq('id', jobId)
        .eq('customer_id', customerId)
        .single();

      if (jobError || !job) {
        console.error('Job not found or access denied:', jobError);
        return new Response(
          JSON.stringify({ error: 'Job not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if feedback already exists
      const { data: existingFeedback } = await adminClient
        .from('job_feedbacks')
        .select('id')
        .eq('job_id', jobId)
        .single();

      if (existingFeedback) {
        return new Response(
          JSON.stringify({ error: 'Feedback already submitted for this job' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Determine if feedback is negative (rating <= 3)
      const isNegative = rating <= 3;

      // Save feedback
      const { error: feedbackError } = await adminClient
        .from('job_feedbacks')
        .insert({
          job_id: jobId,
          customer_id: customerId,
          company_id: job.company_id,
          rating: rating,
          feedback_text: feedbackText || null,
          is_negative: isNegative,
        });

      if (feedbackError) {
        console.error('Error saving feedback:', feedbackError);
        return new Response(
          JSON.stringify({ error: 'Failed to save feedback' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Feedback saved for job:', job.job_number, 'Rating:', rating);

      // If negative feedback, notify managers/admins
      if (isNegative) {
        // Fetch customer info
        const { data: customer } = await adminClient
          .from('customers')
          .select('name, email')
          .eq('id', customerId)
          .single();

        // Get managers and admins
        const { data: managers } = await adminClient
          .from('profiles')
          .select('id')
          .eq('company_id', job.company_id)
          .in('role', ['admin', 'manager']);

        if (managers && managers.length > 0) {
          const notifications = managers.map((manager: { id: string }) => ({
            user_id: manager.id,
            type: 'negative_feedback',
            title: 'Customer Feedback Requires Attention',
            message: `${customer?.name || 'A customer'} left a ${rating}-star rating for Job ${job.job_number}. "${feedbackText || 'No comment'}"`,
            data: { jobId, jobNumber: job.job_number, rating, feedbackText, customerName: customer?.name },
          }));
          
          await adminClient.from('notifications').insert(notifications);
          console.log('Manager notifications created for negative feedback');
        }

        // Also send email to company if very negative (1-2 stars)
        const resendApiKey = Deno.env.get('RESEND_API_KEY');
        if (rating <= 2 && resendApiKey && (job as any).companies?.email) {
          try {
            const resend = new Resend(resendApiKey);
            
            await resend.emails.send({
              from: `Feedback Alert <noreply@email.zopro.app>`,
              to: [(job as any).companies.email],
              subject: `⚠️ Low Customer Rating for Job ${job.job_number}`,
              html: `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                  <h1 style="color: #dc2626;">Customer Feedback Alert</h1>
                  <p>A customer has left a low rating that requires your attention.</p>
                  <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p><strong>Job:</strong> ${job.job_number}</p>
                    <p><strong>Customer:</strong> ${customer?.name || 'Unknown'}</p>
                    <p><strong>Rating:</strong> ${'⭐'.repeat(rating)}${'☆'.repeat(5-rating)} (${rating}/5)</p>
                    ${feedbackText ? `<p><strong>Comment:</strong> "${feedbackText}"</p>` : ''}
                  </div>
                  <p>Please review this feedback and take appropriate action.</p>
                </div>
              `,
            });
            console.log('Negative feedback email sent to company');
          } catch (emailError) {
            console.error('Failed to send feedback email:', emailError);
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Feedback submitted successfully' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'get-document-for-signing') {
      const { documentType, documentId, customerId, token } = body;
      
      if (!documentType || !documentId || !customerId || !token) {
        return new Response(
          JSON.stringify({ error: 'Missing required parameters' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify signed token
      const tokenData = await verifySignedToken(token);
      
      if (!tokenData || tokenData.customerId !== customerId) {
        return new Response(
          JSON.stringify({ error: 'Invalid or expired token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let document = null;
      let items: any[] = [];
      let company = null;

      if (documentType === 'quote') {
        const { data: quote, error } = await adminClient
          .from('quotes')
          .select('*, companies(*)')
          .eq('id', documentId)
          .eq('customer_id', customerId)
          .single();
        
        if (error || !quote) {
          return new Response(
            JSON.stringify({ error: 'Quote not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Fetch quote items
        const { data: quoteItems } = await adminClient
          .from('quote_items')
          .select('*')
          .eq('quote_id', documentId)
          .order('created_at', { ascending: true });
        
        document = quote;
        items = quoteItems || [];
        company = quote.companies;
      } else if (documentType === 'invoice') {
        const { data: invoice, error } = await adminClient
          .from('invoices')
          .select('*, companies(*)')
          .eq('id', documentId)
          .eq('customer_id', customerId)
          .single();
        
        if (error || !invoice) {
          return new Response(
            JSON.stringify({ error: 'Invoice not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Fetch invoice items
        const { data: invoiceItems } = await adminClient
          .from('invoice_items')
          .select('*')
          .eq('invoice_id', documentId)
          .order('created_at', { ascending: true });
        
        document = invoice;
        items = invoiceItems || [];
        company = invoice.companies;
      } else if (documentType === 'job') {
        const { data: job, error } = await adminClient
          .from('jobs')
          .select('*, companies(*)')
          .eq('id', documentId)
          .eq('customer_id', customerId)
          .single();
        
        if (error || !job) {
          return new Response(
            JSON.stringify({ error: 'Job not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        // Fetch job items
        const { data: jobItems } = await adminClient
          .from('job_items')
          .select('*')
          .eq('job_id', documentId)
          .order('created_at', { ascending: true });
        
        document = job;
        items = jobItems || [];
        company = job.companies;
      } else {
        return new Response(
          JSON.stringify({ error: 'Invalid document type' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Fetch customer details
      const { data: customer } = await adminClient
        .from('customers')
        .select('id, name, email, phone')
        .eq('id', customerId)
        .single();

      return new Response(
        JSON.stringify({
          success: true,
          document,
          items,
          company,
          customer,
          documentType,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get document details (for viewing in detail sheets)
    if (action === 'get-document-details') {
      const { documentType, documentId, customerId, token } = body;
      
      if (!documentType || !documentId || !customerId || !token) {
        return new Response(
          JSON.stringify({ error: 'Missing required parameters' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify signed token
      const tokenData = await verifySignedToken(token);
      
      if (!tokenData || tokenData.customerId !== customerId) {
        return new Response(
          JSON.stringify({ error: 'Invalid or expired token' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      let document = null;
      let items: any[] = [];

      if (documentType === 'quote') {
        const { data: quote, error } = await adminClient
          .from('quotes')
          .select('id, quote_number, status, total, subtotal, tax, created_at, valid_until, notes, signed_at, signature_id')
          .eq('id', documentId)
          .eq('customer_id', customerId)
          .single();
        
        if (error || !quote) {
          return new Response(
            JSON.stringify({ error: 'Quote not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const { data: quoteItems } = await adminClient
          .from('quote_items')
          .select('id, description, quantity, unit_price, total')
          .eq('quote_id', documentId)
          .order('created_at', { ascending: true });
        
        // Fetch signature if exists
        let signature = null;
        if (quote.signature_id) {
          const { data: sig } = await adminClient
            .from('signatures')
            .select('id, signature_data, signer_name, signed_at, signer_ip')
            .eq('id', quote.signature_id)
            .single();
          signature = sig;
        }
        
        document = { ...quote, signature };
        items = quoteItems || [];
      } else if (documentType === 'invoice') {
        const { data: invoice, error } = await adminClient
          .from('invoices')
          .select('id, invoice_number, status, total, subtotal, tax, created_at, due_date, notes, signed_at, signature_id')
          .eq('id', documentId)
          .eq('customer_id', customerId)
          .single();
        
        if (error || !invoice) {
          return new Response(
            JSON.stringify({ error: 'Invoice not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const { data: invoiceItems } = await adminClient
          .from('invoice_items')
          .select('id, description, quantity, unit_price, total')
          .eq('invoice_id', documentId)
          .order('created_at', { ascending: true });
        
        // Fetch signature if exists
        let signature = null;
        if (invoice.signature_id) {
          const { data: sig } = await adminClient
            .from('signatures')
            .select('id, signature_data, signer_name, signed_at, signer_ip')
            .eq('id', invoice.signature_id)
            .single();
          signature = sig;
        }
        
        document = { ...invoice, signature };
        items = invoiceItems || [];
      } else if (documentType === 'job') {
        const { data: job, error } = await adminClient
          .from('jobs')
          .select('id, job_number, title, description, status, priority, scheduled_start, scheduled_end, actual_start, actual_end, notes, subtotal, tax, total, completion_signed_at, completion_signed_by, completion_signature_id')
          .eq('id', documentId)
          .eq('customer_id', customerId)
          .single();
        
        if (error || !job) {
          return new Response(
            JSON.stringify({ error: 'Job not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        const { data: jobItems } = await adminClient
          .from('job_items')
          .select('id, description, quantity, unit_price, total')
          .eq('job_id', documentId)
          .order('created_at', { ascending: true });
        
        // Fetch job photos
        const { data: photos } = await adminClient
          .from('job_photos')
          .select('id, photo_url, photo_type, caption, created_at')
          .eq('job_id', documentId)
          .order('display_order', { ascending: true });
        
        // Fetch completion signature if exists
        let signature = null;
        if (job.completion_signature_id) {
          const { data: sig } = await adminClient
            .from('signatures')
            .select('id, signature_data, signer_name, signed_at, signer_ip')
            .eq('id', job.completion_signature_id)
            .single();
          signature = sig;
        }
        
        document = { ...job, signature, photos: photos || [] };
        items = jobItems || [];
      } else {
        return new Response(
          JSON.stringify({ error: 'Invalid document type' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          document,
          items,
          documentType,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in customer-portal-auth:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
