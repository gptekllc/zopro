import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

// Safe base64 encoder that handles large Uint8Array without stack overflow
function uint8ArrayToBase64(bytes: Uint8Array): string {
  const CHUNK_SIZE = 0x8000;
  const chunks: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    const chunk = bytes.subarray(i, i + CHUNK_SIZE);
    chunks.push(String.fromCharCode.apply(null, chunk as unknown as number[]));
  }
  return btoa(chunks.join(''));
}

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[GENERATE-PAYMENT-RECEIPT] ${step}${detailsStr}`);
};

interface GenerateReceiptRequest {
  paymentId: string;
  action: "download" | "email";
  recipientEmail?: string;
}

function getPaymentMethodLabel(method: string): string {
  const methods: Record<string, string> = {
    'cash': 'Cash',
    'check': 'Check',
    'credit_debit': 'Credit/Debit Card',
    'bank_payment': 'Bank Payment',
    'zelle': 'Zelle',
    'venmo': 'Venmo',
    'paypal': 'PayPal',
    'other': 'Other',
  };
  return methods[method] || method;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
}

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

// Helper function to get public storage URL
function getPublicStorageUrl(bucket: string, path: string): string {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
}

function isAbsoluteUrl(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://');
}

async function embedImageFromUrl(pdfDoc: any, imageUrlOrPath: string): Promise<any | null> {
  try {
    const candidates = isAbsoluteUrl(imageUrlOrPath)
      ? [imageUrlOrPath]
      : [getPublicStorageUrl('company-logos', imageUrlOrPath)];

    for (const url of candidates) {
      try {
        const response = await fetch(url);
        if (!response.ok) continue;
        
        const contentType = response.headers.get('content-type') || '';
        const imageBytes = new Uint8Array(await response.arrayBuffer());
        
        if (contentType.includes('png') || url.toLowerCase().endsWith('.png')) {
          return await pdfDoc.embedPng(imageBytes);
        } else if (contentType.includes('jpeg') || contentType.includes('jpg') || 
                   url.toLowerCase().endsWith('.jpg') || url.toLowerCase().endsWith('.jpeg')) {
          return await pdfDoc.embedJpg(imageBytes);
        }
      } catch (e) {
        continue;
      }
    }
    return null;
  } catch (error) {
    console.error("Error embedding image:", error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const payload: GenerateReceiptRequest = await req.json();
    logStep("Received request", payload);

    // Fetch payment with related data
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .select(`
        *,
        invoice:invoices(
          id,
          invoice_number,
          total,
          late_fee_amount,
          customer:customers(name, email, address, city, state, zip, phone),
          company:companies(name, email, phone, address, city, state, zip, logo_url, brand_primary_color)
        ),
        recorded_by_profile:profiles!payments_recorded_by_fkey(full_name)
      `)
      .eq('id', payload.paymentId)
      .single();

    if (paymentError || !payment) {
      logStep("Payment not found", { error: paymentError });
      return new Response(JSON.stringify({ error: "Payment not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 404,
      });
    }

    logStep("Payment fetched", { invoiceNumber: payment.invoice?.invoice_number });

    const invoice = payment.invoice;
    const customer = invoice?.customer;
    const company = invoice?.company;

    if (!invoice || !customer || !company) {
      return new Response(JSON.stringify({ error: "Missing related data" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Get all payments for this invoice to show balance
    const { data: allPayments } = await supabase
      .from('payments')
      .select('amount, status')
      .eq('invoice_id', invoice.id);

    const completedPayments = (allPayments || []).filter(p => p.status === 'completed');
    const totalPaid = completedPayments.reduce((sum, p) => sum + Number(p.amount), 0);
    const totalDue = Number(invoice.total) + Number(invoice.late_fee_amount || 0);
    const remainingBalance = Math.max(0, totalDue - totalPaid);

    // Generate PDF
    const pdfDoc = await PDFDocument.create();
    const page = pdfDoc.addPage([612, 792]); // Letter size
    const { width, height } = page.getSize();
    
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Parse brand color
    let brandColor = rgb(0.09, 0.39, 0.89); // Default blue
    if (company.brand_primary_color) {
      try {
        const hex = company.brand_primary_color.replace('#', '');
        const r = parseInt(hex.substring(0, 2), 16) / 255;
        const g = parseInt(hex.substring(2, 4), 16) / 255;
        const b = parseInt(hex.substring(4, 6), 16) / 255;
        brandColor = rgb(r, g, b);
      } catch (e) {}
    }

    let yPosition = height - 50;
    const leftMargin = 50;
    const rightMargin = width - 50;

    // Embed logo if available
    if (company.logo_url) {
      try {
        const logoImage = await embedImageFromUrl(pdfDoc, company.logo_url);
        if (logoImage) {
          const maxLogoWidth = 120;
          const maxLogoHeight = 60;
          const logoScale = Math.min(maxLogoWidth / logoImage.width, maxLogoHeight / logoImage.height);
          const logoWidth = logoImage.width * logoScale;
          const logoHeight = logoImage.height * logoScale;
          page.drawImage(logoImage, {
            x: leftMargin,
            y: yPosition - logoHeight,
            width: logoWidth,
            height: logoHeight,
          });
          yPosition -= logoHeight + 10;
        }
      } catch (e) {
        logStep("Logo embedding failed", { error: String(e) });
      }
    }

    // Company name
    page.drawText(company.name || 'Company', {
      x: leftMargin,
      y: yPosition,
      size: 16,
      font: helveticaBold,
      color: brandColor,
    });
    yPosition -= 18;

    // Company address
    const companyAddress = [
      company.address,
      [company.city, company.state, company.zip].filter(Boolean).join(', ')
    ].filter(Boolean).join(' | ');
    
    if (companyAddress) {
      page.drawText(companyAddress, {
        x: leftMargin,
        y: yPosition,
        size: 9,
        font: helvetica,
        color: rgb(0.4, 0.4, 0.4),
      });
      yPosition -= 12;
    }

    if (company.phone || company.email) {
      const contactInfo = [company.phone, company.email].filter(Boolean).join(' | ');
      page.drawText(contactInfo, {
        x: leftMargin,
        y: yPosition,
        size: 9,
        font: helvetica,
        color: rgb(0.4, 0.4, 0.4),
      });
      yPosition -= 12;
    }

    yPosition -= 30;

    // Receipt title
    page.drawText('PAYMENT RECEIPT', {
      x: leftMargin,
      y: yPosition,
      size: 24,
      font: helveticaBold,
      color: rgb(0.1, 0.6, 0.3), // Green for receipts
    });
    yPosition -= 40;

    // Receipt details box
    const boxY = yPosition;
    const boxHeight = 80;
    page.drawRectangle({
      x: leftMargin,
      y: boxY - boxHeight,
      width: rightMargin - leftMargin,
      height: boxHeight,
      color: rgb(0.97, 0.97, 0.97),
      borderColor: rgb(0.9, 0.9, 0.9),
      borderWidth: 1,
    });

    // Receipt info inside box
    const infoY = boxY - 20;
    page.drawText('Receipt Date:', { x: leftMargin + 15, y: infoY, size: 10, font: helvetica, color: rgb(0.5, 0.5, 0.5) });
    page.drawText(formatDate(payment.payment_date), { x: leftMargin + 100, y: infoY, size: 10, font: helveticaBold, color: rgb(0.2, 0.2, 0.2) });

    page.drawText('Invoice:', { x: leftMargin + 15, y: infoY - 18, size: 10, font: helvetica, color: rgb(0.5, 0.5, 0.5) });
    page.drawText(invoice.invoice_number, { x: leftMargin + 100, y: infoY - 18, size: 10, font: helveticaBold, color: rgb(0.2, 0.2, 0.2) });

    page.drawText('Payment Method:', { x: leftMargin + 15, y: infoY - 36, size: 10, font: helvetica, color: rgb(0.5, 0.5, 0.5) });
    page.drawText(getPaymentMethodLabel(payment.method), { x: leftMargin + 120, y: infoY - 36, size: 10, font: helveticaBold, color: rgb(0.2, 0.2, 0.2) });

    page.drawText('Payment ID:', { x: leftMargin + 15, y: infoY - 54, size: 10, font: helvetica, color: rgb(0.5, 0.5, 0.5) });
    page.drawText(payment.id.substring(0, 8).toUpperCase(), { x: leftMargin + 100, y: infoY - 54, size: 10, font: helvetica, color: rgb(0.4, 0.4, 0.4) });

    // Amount on right side of box
    page.drawText('Amount Paid', { x: rightMargin - 150, y: infoY, size: 10, font: helvetica, color: rgb(0.5, 0.5, 0.5) });
    page.drawText(formatCurrency(Number(payment.amount)), { x: rightMargin - 150, y: infoY - 20, size: 22, font: helveticaBold, color: rgb(0.1, 0.6, 0.3) });

    yPosition = boxY - boxHeight - 30;

    // Bill To section
    page.drawText('RECEIVED FROM:', { x: leftMargin, y: yPosition, size: 10, font: helveticaBold, color: rgb(0.5, 0.5, 0.5) });
    yPosition -= 18;

    page.drawText(customer.name || 'Customer', { x: leftMargin, y: yPosition, size: 12, font: helveticaBold, color: rgb(0.2, 0.2, 0.2) });
    yPosition -= 14;

    if (customer.address) {
      page.drawText(customer.address, { x: leftMargin, y: yPosition, size: 10, font: helvetica, color: rgb(0.4, 0.4, 0.4) });
      yPosition -= 12;
    }

    const customerCityState = [customer.city, customer.state, customer.zip].filter(Boolean).join(', ');
    if (customerCityState) {
      page.drawText(customerCityState, { x: leftMargin, y: yPosition, size: 10, font: helvetica, color: rgb(0.4, 0.4, 0.4) });
      yPosition -= 12;
    }

    if (customer.email) {
      page.drawText(customer.email, { x: leftMargin, y: yPosition, size: 10, font: helvetica, color: rgb(0.4, 0.4, 0.4) });
      yPosition -= 12;
    }

    yPosition -= 30;

    // Payment Summary
    page.drawText('PAYMENT SUMMARY', { x: leftMargin, y: yPosition, size: 12, font: helveticaBold, color: rgb(0.2, 0.2, 0.2) });
    yPosition -= 20;

    // Summary table
    const summaryItems = [
      { label: 'Invoice Total:', value: formatCurrency(totalDue) },
      { label: 'This Payment:', value: formatCurrency(Number(payment.amount)) },
      { label: 'Total Paid to Date:', value: formatCurrency(totalPaid) },
      { label: 'Remaining Balance:', value: formatCurrency(remainingBalance) },
    ];

    summaryItems.forEach((item, index) => {
      const isLast = index === summaryItems.length - 1;
      page.drawText(item.label, {
        x: leftMargin,
        y: yPosition,
        size: 10,
        font: isLast ? helveticaBold : helvetica,
        color: rgb(0.4, 0.4, 0.4),
      });
      page.drawText(item.value, {
        x: leftMargin + 150,
        y: yPosition,
        size: 10,
        font: helveticaBold,
        color: isLast && remainingBalance > 0 ? rgb(0.8, 0.2, 0.2) : rgb(0.2, 0.2, 0.2),
      });
      yPosition -= 16;
    });

    yPosition -= 20;

    // Payment status
    if (remainingBalance <= 0) {
      page.drawText('PAID IN FULL', {
        x: leftMargin,
        y: yPosition,
        size: 14,
        font: helveticaBold,
        color: rgb(0.1, 0.6, 0.3),
      });
    } else {
      page.drawText('Partial Payment - Balance Due', {
        x: leftMargin,
        y: yPosition,
        size: 12,
        font: helveticaBold,
        color: rgb(0.8, 0.5, 0.1),
      });
    }

    yPosition -= 30;

    // Notes if any
    if (payment.notes) {
      page.drawText('Notes:', { x: leftMargin, y: yPosition, size: 10, font: helveticaBold, color: rgb(0.4, 0.4, 0.4) });
      yPosition -= 14;
      
      // Simple word wrap for notes
      const maxWidth = rightMargin - leftMargin;
      const words = payment.notes.split(' ');
      let line = '';
      
      for (const word of words) {
        const testLine = line + (line ? ' ' : '') + word;
        const testWidth = helvetica.widthOfTextAtSize(testLine, 10);
        if (testWidth > maxWidth) {
          page.drawText(line, { x: leftMargin, y: yPosition, size: 10, font: helvetica, color: rgb(0.4, 0.4, 0.4) });
          yPosition -= 12;
          line = word;
        } else {
          line = testLine;
        }
      }
      if (line) {
        page.drawText(line, { x: leftMargin, y: yPosition, size: 10, font: helvetica, color: rgb(0.4, 0.4, 0.4) });
        yPosition -= 12;
      }
    }

    // Footer
    const footerY = 50;
    page.drawText('Thank you for your payment!', {
      x: width / 2 - helveticaBold.widthOfTextAtSize('Thank you for your payment!', 12) / 2,
      y: footerY,
      size: 12,
      font: helveticaBold,
      color: brandColor,
    });

    page.drawText(`Generated on ${formatDate(new Date().toISOString())}`, {
      x: width / 2 - helvetica.widthOfTextAtSize(`Generated on ${formatDate(new Date().toISOString())}`, 8) / 2,
      y: footerY - 15,
      size: 8,
      font: helvetica,
      color: rgb(0.6, 0.6, 0.6),
    });

    // Save PDF
    const pdfBytes = await pdfDoc.save();
    const pdfBase64 = uint8ArrayToBase64(pdfBytes);
    const fileName = `Receipt-${invoice.invoice_number}-${payment.id.substring(0, 8).toUpperCase()}.pdf`;

    logStep("PDF generated", { fileName, size: pdfBytes.length });

    if (payload.action === "download") {
      return new Response(
        JSON.stringify({
          success: true,
          pdf: pdfBase64,
          fileName,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Email action
    const recipientEmail = payload.recipientEmail || customer.email;
    if (!recipientEmail) {
      return new Response(
        JSON.stringify({ error: "No recipient email provided" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    const emailResponse = await resend.emails.send({
      from: "ZoPro Notifications <noreply@email.zopro.app>",
      to: [recipientEmail],
      reply_to: company.email || undefined,
      subject: `Payment Receipt - ${invoice.invoice_number}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #16a34a;">Payment Receipt</h1>
          <p>Dear ${customer.name},</p>
          <p>Thank you for your payment to <strong>${company.name}</strong>.</p>
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0;"><strong>Invoice:</strong> ${invoice.invoice_number}</p>
            <p style="margin: 10px 0 0 0;"><strong>Amount Paid:</strong> ${formatCurrency(Number(payment.amount))}</p>
            <p style="margin: 10px 0 0 0;"><strong>Payment Method:</strong> ${getPaymentMethodLabel(payment.method)}</p>
            <p style="margin: 10px 0 0 0;"><strong>Payment Date:</strong> ${formatDate(payment.payment_date)}</p>
            ${remainingBalance > 0 ? `<p style="margin: 10px 0 0 0; color: #dc2626;"><strong>Remaining Balance:</strong> ${formatCurrency(remainingBalance)}</p>` : '<p style="margin: 10px 0 0 0; color: #16a34a;"><strong>Status:</strong> Paid in Full</p>'}
          </div>
          <p>Please find your payment receipt attached.</p>
          <p style="color: #6b7280; font-size: 14px;">Thank you for your business!<br>${company.name}</p>
        </div>
      `,
      attachments: [
        {
          filename: fileName,
          content: pdfBase64,
        },
      ],
    });

    logStep("Email sent", { response: emailResponse });

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { error: errorMessage });
    return new Response(
      JSON.stringify({ error: "Failed to generate receipt. Please try again." }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
