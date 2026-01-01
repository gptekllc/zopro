import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DocumentItem {
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface GeneratePDFRequest {
  type: "quote" | "invoice";
  documentId: string;
  action: "download" | "email";
  recipientEmail?: string;
}

function getPaymentMethodLabel(method: string | null): string {
  switch (method) {
    case 'cash': return 'Cash';
    case 'check': return 'Check';
    case 'card': return 'Credit/Debit Card';
    case 'bank_transfer': return 'Bank Transfer (ACH)';
    case 'any':
    default: return 'Any Method Accepted';
  }
}

function generateHTML(
  type: "quote" | "invoice",
  document: any,
  company: any,
  customer: any,
  items: DocumentItem[]
): string {
  const documentNumber = type === "quote" ? document.quote_number : document.invoice_number;
  const title = type === "quote" ? "QUOTE" : "INVOICE";
  const dateLabel = type === "quote" ? "Quote Date" : "Invoice Date";
  const validityLabel = type === "quote" ? "Valid Until" : "Due Date";
  const validityDate = type === "quote" ? document.valid_until : document.due_date;

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  // Payment info section for invoices
  const paymentMethod = company?.default_payment_method;
  const paymentTerms = company?.payment_terms_days;
  const lateFee = company?.late_fee_percentage;

  const paymentInfoSection = type === "invoice" ? `
    <div class="payment-info">
      <h3>Payment Information</h3>
      <div class="payment-details">
        <p><strong>Payment Method:</strong> ${getPaymentMethodLabel(paymentMethod)}</p>
        ${paymentTerms !== null && paymentTerms !== undefined ? `<p><strong>Payment Terms:</strong> ${paymentTerms === 0 ? 'Due on Receipt' : `Net ${paymentTerms} days`}</p>` : ''}
        ${lateFee && lateFee > 0 ? `<p><strong>Late Fee:</strong> ${lateFee}% on overdue balances</p>` : ''}
      </div>
    </div>
  ` : '';

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
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
    .payment-info { margin-top: 30px; padding: 20px; background: #e8f4fc; border-radius: 8px; border-left: 4px solid #2563eb; }
    .payment-info h3 { font-size: 14px; text-transform: uppercase; color: #2563eb; margin-bottom: 10px; }
    .payment-details p { margin: 5px 0; font-size: 14px; }
    .notes { margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px; }
    .notes h3 { font-size: 14px; color: #888; margin-bottom: 10px; }
    .footer { margin-top: 60px; text-align: center; color: #888; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="company-info">
        <h1>${company?.name || "Your Company"}</h1>
        ${company?.address ? `<p>${company.address}</p>` : ""}
        ${company?.city || company?.state || company?.zip ? `<p>${[company.city, company.state, company.zip].filter(Boolean).join(", ")}</p>` : ""}
        ${company?.phone ? `<p>${company.phone}</p>` : ""}
        ${company?.email ? `<p>${company.email}</p>` : ""}
      </div>
      <div class="document-info">
        <div class="document-type">${title}</div>
        <div class="document-number">${documentNumber}</div>
      </div>
    </div>

    <div class="addresses">
      <div class="address-block">
        <h3>Bill To</h3>
        <p><strong>${customer?.name || "Customer"}</strong></p>
        ${customer?.address ? `<p>${customer.address}</p>` : ""}
        ${customer?.city || customer?.state || customer?.zip ? `<p>${[customer.city, customer.state, customer.zip].filter(Boolean).join(", ")}</p>` : ""}
        ${customer?.email ? `<p>${customer.email}</p>` : ""}
        ${customer?.phone ? `<p>${customer.phone}</p>` : ""}
      </div>
    </div>

    <div class="dates">
      <p><strong>${dateLabel}:</strong> ${formatDate(document.created_at)}</p>
      ${validityDate ? `<p><strong>${validityLabel}:</strong> ${formatDate(validityDate)}</p>` : ""}
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
        ${items.map((item) => `
          <tr>
            <td>${item.description}</td>
            <td>${item.quantity}</td>
            <td>${formatCurrency(Number(item.unit_price))}</td>
            <td>${formatCurrency(Number(item.total))}</td>
          </tr>
        `).join("")}
      </tbody>
    </table>

    <div class="totals">
      <div class="totals-row">
        <span>Subtotal</span>
        <span>${formatCurrency(Number(document.subtotal))}</span>
      </div>
      <div class="totals-row">
        <span>Tax</span>
        <span>${formatCurrency(Number(document.tax))}</span>
      </div>
      <div class="totals-row total">
        <span>Total</span>
        <span>${formatCurrency(Number(document.total))}</span>
      </div>
    </div>

    ${paymentInfoSection}

    ${document.notes ? `
      <div class="notes">
        <h3>Notes</h3>
        <p>${document.notes}</p>
      </div>
    ` : ""}

    <div class="footer">
      <p>Thank you for your business!</p>
    </div>
  </div>
</body>
</html>
  `;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, documentId, action, recipientEmail }: GeneratePDFRequest = await req.json();

    console.log(`Processing ${action} request for ${type} ${documentId}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch the document with items
    const tableName = type === "quote" ? "quotes" : "invoices";
    const itemsTable = type === "quote" ? "quote_items" : "invoice_items";
    const itemsFk = type === "quote" ? "quote_id" : "invoice_id";

    const { data: document, error: docError } = await supabase
      .from(tableName)
      .select("*")
      .eq("id", documentId)
      .single();

    if (docError || !document) {
      console.error("Document fetch error:", docError);
      throw new Error(`${type} not found`);
    }

    // Fetch items
    const { data: items, error: itemsError } = await supabase
      .from(itemsTable)
      .select("*")
      .eq(itemsFk, documentId);

    if (itemsError) {
      console.error("Items fetch error:", itemsError);
    }

    // Fetch company
    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("*")
      .eq("id", document.company_id)
      .single();

    if (companyError) {
      console.error("Company fetch error:", companyError);
    }

    // Fetch customer
    const { data: customer, error: customerError } = await supabase
      .from("customers")
      .select("*")
      .eq("id", document.customer_id)
      .single();

    if (customerError) {
      console.error("Customer fetch error:", customerError);
    }

    // Generate HTML
    const html = generateHTML(type, document, company, customer, items || []);
    const documentNumber = type === "quote" ? document.quote_number : document.invoice_number;

    if (action === "email") {
      if (!recipientEmail) {
        throw new Error("Recipient email is required for email action");
      }

      const subject = type === "quote" 
        ? `Quote ${documentNumber} from ${company?.name || "Our Company"}`
        : `Invoice ${documentNumber} from ${company?.name || "Our Company"}`;

      // Payment info for email
      const paymentMethodLabel = getPaymentMethodLabel(company?.default_payment_method);
      const paymentTerms = company?.payment_terms_days;
      const lateFee = company?.late_fee_percentage;

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Hello ${customer?.name || ""},</h2>
          <p>Please find your ${type} attached below.</p>
          <p><strong>${type === "quote" ? "Quote" : "Invoice"} Number:</strong> ${documentNumber}</p>
          <p><strong>Total Amount:</strong> $${Number(document.total).toLocaleString()}</p>
          ${type === "invoice" && document.due_date ? `<p><strong>Due Date:</strong> ${new Date(document.due_date).toLocaleDateString()}</p>` : ""}
          ${type === "quote" && document.valid_until ? `<p><strong>Valid Until:</strong> ${new Date(document.valid_until).toLocaleDateString()}</p>` : ""}
          ${type === "invoice" ? `
            <div style="margin: 20px 0; padding: 15px; background: #e8f4fc; border-left: 4px solid #2563eb; border-radius: 4px;">
              <p style="margin: 0 0 5px 0; font-weight: bold; color: #2563eb;">Payment Information</p>
              <p style="margin: 5px 0;"><strong>Accepted Payment Method:</strong> ${paymentMethodLabel}</p>
              ${paymentTerms !== null && paymentTerms !== undefined ? `<p style="margin: 5px 0;"><strong>Payment Terms:</strong> ${paymentTerms === 0 ? 'Due on Receipt' : `Net ${paymentTerms} days`}</p>` : ''}
              ${lateFee && lateFee > 0 ? `<p style="margin: 5px 0;"><strong>Late Fee:</strong> ${lateFee}% on overdue balances</p>` : ''}
            </div>
          ` : ""}
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;" />
          ${html}
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;" />
          <p>If you have any questions, please don't hesitate to contact us.</p>
          <p>Best regards,<br/>${company?.name || "The Team"}</p>
        </div>
      `;

      const { error: emailError } = await resend.emails.send({
        from: `${company?.name || "Company"} <onboarding@resend.dev>`,
        to: [recipientEmail],
        subject,
        html: emailHtml,
      });

      if (emailError) {
        console.error("Email send error:", emailError);
        throw new Error("Failed to send email: " + emailError.message);
      }

      // Update document status to 'sent' if it's a draft
      if (document.status === "draft") {
        await supabase
          .from(tableName)
          .update({ status: "sent" })
          .eq("id", documentId);
      }

      console.log(`Email sent successfully to ${recipientEmail}`);

      return new Response(
        JSON.stringify({ success: true, message: "Email sent successfully" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For download action, return HTML content
    return new Response(
      JSON.stringify({ success: true, html, documentNumber }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in generate-pdf function:", error);
    // Return sanitized error message to client - don't expose internal details
    return new Response(
      JSON.stringify({ error: "Failed to generate document. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
