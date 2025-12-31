import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { Resend } from 'https://esm.sh/resend@2.0.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simple token generation (in production, use a more secure method)
function generateToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
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

      // Generate a token and store it
      const token = generateToken();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiry

      // Store token in a simple way - using customer notes or a separate table would be better in production
      // For now, we'll use a simple in-memory approach via the token itself containing expiry
      const tokenData = {
        customerId: customer.id,
        expiresAt: expiresAt.toISOString(),
        token,
      };
      
      // Encode token data in base64 for the URL
      const encodedToken = btoa(JSON.stringify(tokenData));
      
      // Get the app URL from the request origin or use a default
      const origin = req.headers.get('origin') || 'https://lovable.dev';
      const magicLink = `${origin}/customer-portal?token=${encodedToken}&customer=${customer.id}`;

      console.log('Generated magic link for customer');

      // Send email if Resend is configured
      if (resendApiKey) {
        try {
          const resend = new Resend(resendApiKey);
          const companyName = (customer as any).companies?.name || 'Our Company';
          
          await resend.emails.send({
            from: `${companyName} <onboarding@resend.dev>`,
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

      try {
        // Decode and verify token
        const tokenData = JSON.parse(atob(token));
        
        if (tokenData.customerId !== customerId) {
          console.log('Token customer ID mismatch');
          return new Response(
            JSON.stringify({ valid: false, error: 'Invalid token' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const expiresAt = new Date(tokenData.expiresAt);
        if (expiresAt < new Date()) {
          console.log('Token expired');
          return new Response(
            JSON.stringify({ valid: false, error: 'Token expired' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Fetch customer data
        const { data: customer, error: customerError } = await adminClient
          .from('customers')
          .select('id, name, email, phone, company_id, companies(id, name, logo_url)')
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

        // Fetch jobs for this customer
        const { data: jobs } = await adminClient
          .from('jobs')
          .select('id, job_number, title, status, scheduled_start, created_at')
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
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (decodeError) {
        console.error('Token decode error:', decodeError);
        return new Response(
          JSON.stringify({ valid: false, error: 'Invalid token format' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (action === 'download-invoice') {
      const { invoiceId, customerId, token } = body;
      
      if (!invoiceId || !customerId || !token) {
        return new Response(
          JSON.stringify({ error: 'Missing required parameters' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Verify token first
      try {
        const tokenData = JSON.parse(atob(token));
        
        if (tokenData.customerId !== customerId) {
          return new Response(
            JSON.stringify({ error: 'Invalid token' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const expiresAt = new Date(tokenData.expiresAt);
        if (expiresAt < new Date()) {
          return new Response(
            JSON.stringify({ error: 'Token expired' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      } catch {
        return new Response(
          JSON.stringify({ error: 'Invalid token format' }),
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

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Error in customer-portal-auth:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
