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
  type: "quote" | "invoice" | "job";
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

function getStatusLabel(type: string, status: string): string {
  if (type === 'job') {
    switch (status) {
      case 'draft': return 'Draft';
      case 'scheduled': return 'Scheduled';
      case 'in_progress': return 'In Progress';
      case 'completed': return 'Completed';
      case 'invoiced': return 'Invoiced';
      case 'paid': return 'Paid';
      default: return status;
    }
  }
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function generateHTML(
  type: "quote" | "invoice" | "job",
  document: any,
  company: any,
  customer: any,
  items: DocumentItem[],
  assignee?: any,
  signature?: any,
  pdfPreferences?: { 
    pdf_show_notes: boolean; 
    pdf_show_signature: boolean; 
    pdf_show_logo: boolean;
    pdf_show_line_item_details: boolean;
    pdf_terms_conditions: string | null;
    pdf_footer_text: string | null;
  }
): string {
  let documentNumber: string;
  let title: string;
  let dateLabel: string;
  let validityLabel: string | null = null;
  let validityDate: string | null = null;

  if (type === "quote") {
    documentNumber = document.quote_number;
    title = "QUOTE";
    dateLabel = "Quote Date";
    validityLabel = "Valid Until";
    validityDate = document.valid_until;
  } else if (type === "invoice") {
    documentNumber = document.invoice_number;
    title = "INVOICE";
    dateLabel = "Invoice Date";
    validityLabel = "Due Date";
    validityDate = document.due_date;
  } else {
    documentNumber = document.job_number;
    title = "JOB SUMMARY";
    dateLabel = "Created Date";
    validityLabel = null;
    validityDate = null;
  }

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
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

  // Job-specific info section
  const jobInfoSection = type === "job" ? `
    <div class="job-info">
      <div class="info-row">
        <div class="info-item">
          <span class="info-label">Status</span>
          <span class="info-value status-badge">${getStatusLabel('job', document.status)}</span>
        </div>
        <div class="info-item">
          <span class="info-label">Priority</span>
          <span class="info-value priority-${document.priority}">${document.priority?.toUpperCase() || 'MEDIUM'}</span>
        </div>
        ${assignee ? `
          <div class="info-item">
            <span class="info-label">Assigned To</span>
            <span class="info-value">${assignee.full_name}</span>
          </div>
        ` : ''}
      </div>
      ${document.scheduled_start ? `
        <div class="schedule-info">
          <h3>Schedule</h3>
          <p><strong>Scheduled Start:</strong> ${formatDateTime(document.scheduled_start)}</p>
          ${document.scheduled_end ? `<p><strong>Scheduled End:</strong> ${formatDateTime(document.scheduled_end)}</p>` : ''}
        </div>
      ` : ''}
      ${document.actual_start ? `
        <div class="actual-info">
          <h3>Actual Times</h3>
          <p><strong>Started:</strong> ${formatDateTime(document.actual_start)}</p>
          ${document.actual_end ? `<p><strong>Completed:</strong> ${formatDateTime(document.actual_end)}</p>` : ''}
        </div>
      ` : ''}
    </div>
  ` : '';

  // Description section for jobs
  const descriptionSection = type === "job" && document.description ? `
    <div class="description-section">
      <h3>Description</h3>
      <p>${document.description}</p>
    </div>
  ` : '';

  // Signature section
  const signatureSection = signature ? `
    <div class="signature-section">
      <h3>Signature</h3>
      <div class="signature-content">
        <img src="${signature.signature_data}" alt="Signature" class="signature-image" />
        <div class="signature-details">
          <p><strong>Signed by:</strong> ${signature.signer_name}</p>
          <p><strong>Date:</strong> ${new Date(signature.signed_at).toLocaleString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}</p>
        </div>
      </div>
    </div>
  ` : `
    <div class="signature-section">
      <h3>Customer Signature</h3>
      <div class="signature-field">
        <div class="signature-line"></div>
        <div class="signature-labels">
          <div class="signature-label-item">
            <span class="label-text">Signature</span>
          </div>
          <div class="signature-label-item">
            <span class="label-text">Printed Name</span>
            <div class="name-line"></div>
          </div>
          <div class="signature-label-item">
            <span class="label-text">Date</span>
            <div class="date-line"></div>
          </div>
        </div>
      </div>
      <p class="signature-agreement">By signing above, I acknowledge and accept this ${type === 'quote' ? 'quote' : type === 'invoice' ? 'invoice' : 'job summary'}.</p>
    </div>
  `;

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
    .company-logo { max-height: 60px; max-width: 180px; object-fit: contain; }
    .job-info { margin-bottom: 30px; }
    .info-row { display: flex; gap: 30px; margin-bottom: 20px; }
    .info-item { }
    .info-label { display: block; font-size: 12px; text-transform: uppercase; color: #888; margin-bottom: 4px; }
    .info-value { font-weight: 600; }
    .status-badge { padding: 4px 10px; background: #e8f4fc; color: #2563eb; border-radius: 4px; font-size: 14px; }
    .priority-low { color: #22c55e; }
    .priority-medium { color: #f59e0b; }
    .priority-high { color: #f97316; }
    .priority-urgent { color: #dc2626; font-weight: bold; }
    .schedule-info, .actual-info { margin-top: 15px; padding: 15px; background: #f8f9fa; border-radius: 8px; }
    .schedule-info h3, .actual-info h3 { font-size: 12px; text-transform: uppercase; color: #888; margin-bottom: 10px; }
    .description-section { margin-bottom: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px; }
    .description-section h3 { font-size: 12px; text-transform: uppercase; color: #888; margin-bottom: 10px; }
    .signature-section { margin-top: 40px; padding: 20px; border: 1px solid #eee; border-radius: 8px; }
    .signature-section h3 { font-size: 12px; text-transform: uppercase; color: #888; margin-bottom: 15px; }
    .signature-content { display: flex; gap: 30px; align-items: flex-end; }
    .signature-image { max-width: 250px; max-height: 80px; border-bottom: 1px solid #333; }
    .signature-details { font-size: 13px; color: #666; }
    .signature-details p { margin: 4px 0; }
    .signature-field { margin-top: 20px; }
    .signature-line { width: 100%; max-width: 350px; height: 60px; border-bottom: 2px solid #333; margin-bottom: 8px; }
    .signature-labels { display: flex; gap: 40px; margin-top: 15px; }
    .signature-label-item { display: flex; flex-direction: column; gap: 4px; }
    .signature-label-item .label-text { font-size: 11px; text-transform: uppercase; color: #666; }
    .signature-label-item .name-line, .signature-label-item .date-line { width: 150px; border-bottom: 1px solid #999; height: 20px; }
    .signature-agreement { margin-top: 20px; font-size: 12px; color: #666; font-style: italic; }
    .terms-section { margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px; border-top: 2px solid #eee; }
    .terms-section h3 { font-size: 12px; text-transform: uppercase; color: #888; margin-bottom: 10px; }
    .terms-section p { font-size: 12px; color: #666; white-space: pre-wrap; line-height: 1.5; }
    @media print {
      .container { padding: 20px; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="document-info" style="text-align: left;">
        <div class="document-type">${title}</div>
        <div class="document-number">${documentNumber}</div>
      </div>
      ${(pdfPreferences?.pdf_show_logo !== false) && company?.logo_url ? `<img src="${company.logo_url}" alt="${company.name}" class="company-logo" style="margin-left: auto;" />` : ''}
    </div>

    <div class="addresses">
      <div class="address-block">
        <h3>${type === "job" ? "Customer" : "Bill To"}</h3>
        <p><strong>${customer?.name || "Customer"}</strong></p>
        ${customer?.address ? `<p>${customer.address}</p>` : ""}
        ${customer?.city || customer?.state || customer?.zip ? `<p>${[customer.city, customer.state, customer.zip].filter(Boolean).join(", ")}</p>` : ""}
        ${customer?.email ? `<p>${customer.email}</p>` : ""}
        ${customer?.phone ? `<p>${customer.phone}</p>` : ""}
      </div>
      <div class="address-block" style="text-align: right;">
        <h3>From</h3>
        <p><strong>${company?.name || "Your Company"}</strong></p>
        ${company?.address ? `<p>${company.address}</p>` : ""}
        ${company?.city || company?.state || company?.zip ? `<p>${[company.city, company.state, company.zip].filter(Boolean).join(", ")}</p>` : ""}
        ${company?.phone ? `<p>${company.phone}</p>` : ""}
        ${company?.email ? `<p>${company.email}</p>` : ""}
        ${company?.website ? `<p><a href="${company.website}" style="color: #2563eb; text-decoration: none;">${company.website}</a></p>` : ""}
        ${(company?.facebook_url || company?.instagram_url || company?.linkedin_url) ? `
          <p style="margin-top: 8px;">
            ${company?.facebook_url ? `<a href="${company.facebook_url}" style="color: #2563eb; text-decoration: none; margin-right: 10px;">Facebook</a>` : ''}
            ${company?.instagram_url ? `<a href="${company.instagram_url}" style="color: #2563eb; text-decoration: none; margin-right: 10px;">Instagram</a>` : ''}
            ${company?.linkedin_url ? `<a href="${company.linkedin_url}" style="color: #2563eb; text-decoration: none;">LinkedIn</a>` : ''}
          </p>
        ` : ''}
      </div>
    </div>

    ${jobInfoSection}

    ${descriptionSection}

    <div class="dates">
      <p><strong>${dateLabel}:</strong> ${formatDate(document.created_at)}</p>
      ${validityDate && validityLabel ? `<p><strong>${validityLabel}:</strong> ${formatDate(validityDate)}</p>` : ""}
    </div>

    ${items && items.length > 0 ? `
      <table>
        <thead>
          <tr>
            <th>Description</th>
            ${pdfPreferences?.pdf_show_line_item_details !== false ? `<th>Qty</th>
            <th>Unit Price</th>` : ''}
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          ${items.map((item) => `
            <tr>
              <td>${item.description}</td>
              ${pdfPreferences?.pdf_show_line_item_details !== false ? `<td>${item.quantity}</td>
              <td>${formatCurrency(Number(item.unit_price))}</td>` : ''}
              <td>${formatCurrency(Number(item.total))}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>

      <div class="totals">
        <div class="totals-row">
          <span>Subtotal</span>
          <span>${formatCurrency(Number(document.subtotal || 0))}</span>
        </div>
        <div class="totals-row">
          <span>Tax</span>
          <span>${formatCurrency(Number(document.tax || 0))}</span>
        </div>
        ${type === "invoice" ? `
          <div class="totals-row" style="border-bottom: 2px solid #eee;">
            <span>Invoice Total</span>
            <span>${formatCurrency(Number(document.total || 0))}</span>
          </div>
          ${document.late_fee_amount && Number(document.late_fee_amount) > 0 ? `
            <div class="totals-row" style="color: #dc2626;">
              <span>Late Fee${lateFee && lateFee > 0 ? ` (${lateFee}%)` : ''}</span>
              <span>+${formatCurrency(Number(document.late_fee_amount))}</span>
            </div>
            <div class="totals-row total" style="color: #dc2626;">
              <span>Total Due</span>
              <span>${formatCurrency(Number(document.total) + Number(document.late_fee_amount))}</span>
            </div>
          ` : `
            <div class="totals-row total">
              <span>Total</span>
              <span>${formatCurrency(Number(document.total || 0))}</span>
            </div>
          `}
        ` : `
          <div class="totals-row total">
            <span>Total</span>
            <span>${formatCurrency(Number(document.total || 0))}</span>
          </div>
        `}
      </div>
    ` : ''}

    ${paymentInfoSection}

    ${(pdfPreferences?.pdf_show_notes !== false) && document.notes ? `
      <div class="notes">
        <h3>Notes</h3>
        <p>${document.notes}</p>
      </div>
    ` : ""}

    ${pdfPreferences?.pdf_show_signature !== false ? signatureSection : ''}

    ${pdfPreferences?.pdf_terms_conditions ? `
      <div class="terms-section">
        <h3>Terms & Conditions</h3>
        <p>${pdfPreferences.pdf_terms_conditions}</p>
      </div>
    ` : ''}

    <div class="footer">
      ${pdfPreferences?.pdf_footer_text ? `<p>${pdfPreferences.pdf_footer_text}</p>` : '<p>Thank you for your business!</p>'}
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

    // Determine table and item table names
    let tableName: string;
    let itemsTable: string;
    let itemsFk: string;

    if (type === "quote") {
      tableName = "quotes";
      itemsTable = "quote_items";
      itemsFk = "quote_id";
    } else if (type === "invoice") {
      tableName = "invoices";
      itemsTable = "invoice_items";
      itemsFk = "invoice_id";
    } else {
      tableName = "jobs";
      itemsTable = "job_items";
      itemsFk = "job_id";
    }

    // Fetch the document
    const { data: document, error: docError } = await supabase
      .from(tableName)
      .select("*")
      .eq("id", documentId)
      .single();

    if (docError || !document) {
      console.error("Document fetch error:", docError);
      throw new Error(`${type} not found`);
    }

    console.log(`Found ${type}:`, document);

    // Fetch items
    const { data: items, error: itemsError } = await supabase
      .from(itemsTable)
      .select("*")
      .eq(itemsFk, documentId);

    if (itemsError) {
      console.error("Items fetch error:", itemsError);
    }

    console.log(`Found ${items?.length || 0} items`);

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

    // Fetch assignee for jobs
    let assignee = null;
    if (type === "job" && document.assigned_to) {
      const { data: assigneeData, error: assigneeError } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", document.assigned_to)
        .single();

      if (!assigneeError) {
        assignee = assigneeData;
      }
    }

    // Fetch signature if exists
    let signature = null;
    const signatureId = type === "job" ? document.completion_signature_id : document.signature_id;
    if (signatureId) {
      const { data: signatureData, error: signatureError } = await supabase
        .from("signatures")
        .select("signature_data, signer_name, signed_at")
        .eq("id", signatureId)
        .single();

      if (!signatureError && signatureData) {
        signature = signatureData;
        console.log("Found signature for document");
      }
    }

    // Extract PDF preferences from company
    const pdfPreferences = {
      pdf_show_notes: company?.pdf_show_notes ?? true,
      pdf_show_signature: company?.pdf_show_signature ?? true,
      pdf_show_logo: company?.pdf_show_logo ?? true,
      pdf_show_line_item_details: company?.pdf_show_line_item_details ?? true,
      pdf_terms_conditions: company?.pdf_terms_conditions ?? null,
      pdf_footer_text: company?.pdf_footer_text ?? null,
    };

    // Generate HTML
    const html = generateHTML(type, document, company, customer, items || [], assignee, signature, pdfPreferences);
    
    let documentNumber: string;
    if (type === "quote") {
      documentNumber = document.quote_number;
    } else if (type === "invoice") {
      documentNumber = document.invoice_number;
    } else {
      documentNumber = document.job_number;
    }

    if (action === "email") {
      if (!recipientEmail) {
        throw new Error("Recipient email is required for email action");
      }

      let subject: string;
      if (type === "quote") {
        subject = `Quote ${documentNumber} from ${company?.name || "Our Company"}`;
      } else if (type === "invoice") {
        subject = `Invoice ${documentNumber} from ${company?.name || "Our Company"}`;
      } else {
        subject = `Job Summary ${documentNumber} from ${company?.name || "Our Company"}`;
      }

      // Payment info for email
      const paymentMethodLabel = getPaymentMethodLabel(company?.default_payment_method);
      const paymentTerms = company?.payment_terms_days;
      const lateFee = company?.late_fee_percentage;

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Hello ${customer?.name || ""},</h2>
          <p>Please find your ${type === "job" ? "job summary" : type} attached below.</p>
          <p><strong>${type === "quote" ? "Quote" : type === "invoice" ? "Invoice" : "Job"} Number:</strong> ${documentNumber}</p>
          ${document.total ? `<p><strong>Total Amount:</strong> $${Number(document.total).toLocaleString()}</p>` : ""}
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
          ${company?.website ? `<p style="margin-top: 15px;"><a href="${company.website}" style="color: #2563eb; text-decoration: none;">${company.website}</a></p>` : ""}
          ${(company?.facebook_url || company?.instagram_url || company?.linkedin_url) ? `
            <p style="margin-top: 10px;">
              ${company?.facebook_url ? `<a href="${company.facebook_url}" style="color: #2563eb; text-decoration: none; margin-right: 15px;">Facebook</a>` : ''}
              ${company?.instagram_url ? `<a href="${company.instagram_url}" style="color: #2563eb; text-decoration: none; margin-right: 15px;">Instagram</a>` : ''}
              ${company?.linkedin_url ? `<a href="${company.linkedin_url}" style="color: #2563eb; text-decoration: none;">LinkedIn</a>` : ''}
            </p>
          ` : ''}
        </div>
      `;

      console.log(`Sending email to ${recipientEmail}`);

      const { data: emailData, error: emailError } = await resend.emails.send({
        from: "ZoPro Notifications <noreply@email.zopro.app>",
        to: [recipientEmail],
        reply_to: company?.email || undefined,
        subject,
        html: emailHtml,
      });

      if (emailError) {
        console.error("Email send error:", emailError);
        throw new Error("Failed to send email: " + (emailError as any).message);
      }

      console.log("Email sent successfully:", emailData);

      // Update document status to 'sent' if it's a draft (not for jobs)
      if (type !== "job" && document.status === "draft") {
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
    console.log("Returning HTML for download");
    return new Response(
      JSON.stringify({ success: true, html, documentNumber }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("Error in generate-pdf function:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Failed to generate document. Please try again." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
