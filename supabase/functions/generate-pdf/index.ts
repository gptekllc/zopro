import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";

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

interface SocialLink {
  platform_name: string;
  url: string;
  icon_url: string | null;
  show_on_invoice: boolean;
  show_on_quote: boolean;
  show_on_job: boolean;
  show_on_email: boolean;
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

// Default platform icons - inline SVG data URIs
const PLATFORM_ICONS: Record<string, string> = {
  facebook: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>')}`,
  instagram: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#E4405F"><path d="M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227-.224.562-.479.96-.899 1.382-.419.419-.824.679-1.38.896-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421-.569-.224-.96-.479-1.379-.899-.421-.419-.69-.824-.9-1.38-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678c-3.405 0-6.162 2.76-6.162 6.162 0 3.405 2.76 6.162 6.162 6.162 3.405 0 6.162-2.76 6.162-6.162 0-3.405-2.757-6.162-6.162-6.162zM12 16c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm7.846-10.405c0 .795-.646 1.44-1.44 1.44-.795 0-1.44-.646-1.44-1.44 0-.794.646-1.439 1.44-1.439.793-.001 1.44.645 1.44 1.439z"/></svg>')}`,
  linkedin: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#0A66C2"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>')}`,
  twitter: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#1DA1F2"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/></svg>')}`,
  x: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#000000"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>')}`,
  youtube: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#FF0000"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>')}`,
  tiktok: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#000000"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>')}`,
  whatsapp: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>')}`,
  messenger: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#0084FF"><path d="M.001 11.639C.001 4.949 5.241 0 12.001 0S24 4.95 24 11.639c0 6.689-5.24 11.638-12 11.638-1.21 0-2.38-.16-3.47-.46a.96.96 0 00-.64.05l-2.39 1.05a.96.96 0 01-1.35-.85l-.07-2.14a.97.97 0 00-.32-.68A11.39 11.389 0 01.002 11.64zm8.32-2.19l-3.52 5.6c-.35.53.32 1.139.82.75l3.79-2.87c.26-.2.6-.2.87 0l2.8 2.1c.84.63 2.04.4 2.6-.48l3.52-5.6c.35-.53-.32-1.13-.82-.75l-3.79 2.87c-.25.2-.6.2-.86 0l-2.8-2.1a1.8 1.8 0 00-2.61.48z"/></svg>')}`,
  telegram: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#0088CC"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>')}`,
  viber: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#7360F2"><path d="M11.398.002C9.473.028 5.331.344 3.014 2.467 1.294 4.182.518 6.792.434 10.044c-.084 3.252-.19 9.356 5.705 11.088V23.3s-.038.763.473 1.022c.62.318 1.084-.015 1.732-.665l1.925-2.043c5.303.5 9.37-.581 9.834-.745.533-.193 3.57-.557 4.077-4.546.522-4.112.317-6.744-.396-8.878-.484-1.452-1.69-2.56-1.69-2.56s-1.919-1.57-6.148-2.083c0 0-1.73-.2-4.549-.163z"/></svg>')}`,
  threads: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#000000"><path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.96-.065-1.182.408-2.256 1.332-3.023.85-.706 2.024-1.109 3.39-1.165 1.166-.047 2.237.093 3.198.421-.084-.904-.36-1.6-.83-2.065-.556-.552-1.398-.838-2.502-.853-.89.012-1.67.24-2.318.68l-1.177-1.69c.942-.64 2.088-.99 3.43-1.106l.133-.007c1.694 0 3.037.484 3.994 1.44.897.896 1.381 2.167 1.44 3.78.413.183.803.394 1.169.634 1.017.67 1.793 1.57 2.246 2.607.755 1.73.768 4.459-1.44 6.615-1.792 1.752-4.006 2.548-7.164 2.57z"/></svg>')}`,
  pinterest: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#BD081C"><path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.39 18.592.026 11.985.026L12.017 0z"/></svg>')}`,
  google: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>')}`,
  thumbtack: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#009FD9"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0z"/></svg>')}`,
  yelp: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#D32323"><path d="M20.16 12.594l-4.995 1.433c-.96.276-1.74-.8-1.176-1.63l2.905-4.308c.224-.332.586-.53.976-.539.397-.01.766.174 1.003.497l2.09 2.875c.403.553.177 1.346-.463 1.597z"/></svg>')}`,
  angi: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#FF6153"><circle cx="12" cy="12" r="10"/></svg>')}`,
  homeadvisor: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#F68315"><path d="M12 2L2 9l1.5 1V20h6v-6h5v6h6V10l1.5-1L12 2z"/></svg>')}`,
  bbb: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#005A8C"><rect x="3.75" y="3" width="16.5" height="18" rx="1"/></svg>')}`,
  nextdoor: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#8ED500"><circle cx="12" cy="12" r="10"/></svg>')}`,
  networx: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#00B2A9"><path d="M12 2L2 7v10l10 5 10-5V7L12 2z"/></svg>')}`,
  houzz: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#4DBC15"><path d="M.5.5v23h12.5V12H5.5V.5H.5zm6.5 12v11h16.5v-23H18v12H7z"/></svg>')}`,
  craftjack: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#FF6B35"><rect x="5" y="3" width="14" height="18" rx="2"/></svg>')}`,
  porch: `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="#00C16E"><path d="M12 3L2 9v12h20V9L12 3z"/></svg>')}`,
};

function getDefaultPlatformIcon(platformName: string): string | null {
  const normalized = platformName.toLowerCase().trim();
  if (PLATFORM_ICONS[normalized]) return PLATFORM_ICONS[normalized];
  for (const [key, icon] of Object.entries(PLATFORM_ICONS)) {
    if (normalized.includes(key)) return icon;
  }
  return null;
}

function generateSocialIconsHtml(socialLinks: SocialLink[], documentType: 'invoice' | 'quote' | 'job'): string {
  const visibleLinks = socialLinks.filter(link => {
    if (documentType === 'invoice') return link.show_on_invoice;
    if (documentType === 'quote') return link.show_on_quote;
    if (documentType === 'job') return link.show_on_job;
    return false;
  });

  if (visibleLinks.length === 0) return '';

  const iconsHtml = visibleLinks.map(link => {
    const iconUrl = link.icon_url || getDefaultPlatformIcon(link.platform_name);
    if (iconUrl) {
      return `<a href="${link.url}" style="display: inline-block; margin-right: 12px; text-decoration: none;" title="${link.platform_name}">
        <img src="${iconUrl}" alt="${link.platform_name}" style="width: 24px; height: 24px; object-fit: contain;" />
      </a>`;
    } else {
      return `<a href="${link.url}" style="color: #2563eb; text-decoration: none; margin-right: 12px;">${link.platform_name}</a>`;
    }
  }).join('');

  return `<div style="margin-top: 10px;">${iconsHtml}</div>`;
}

function generateEmailSocialIconsHtml(socialLinks: SocialLink[]): string {
  const visibleLinks = socialLinks.filter(link => link.show_on_email);

  if (visibleLinks.length === 0) return '';

  const iconsHtml = visibleLinks.map(link => {
    const iconUrl = link.icon_url || getDefaultPlatformIcon(link.platform_name);
    if (iconUrl) {
      return `<a href="${link.url}" style="display: inline-block; margin-right: 12px; text-decoration: none;" title="${link.platform_name}">
        <img src="${iconUrl}" alt="${link.platform_name}" style="width: 24px; height: 24px; object-fit: contain; vertical-align: middle;" />
      </a>`;
    } else {
      return `<a href="${link.url}" style="color: #2563eb; text-decoration: none; margin-right: 15px;">${link.platform_name}</a>`;
    }
  }).join('');

  return `<div style="margin-top: 10px; text-align: center;">${iconsHtml}</div>`;
}

// Helper: check for absolute URL
function isAbsoluteUrl(value: string): boolean {
  return value.startsWith('http://') || value.startsWith('https://');
}

// Helper: for public buckets, build a public URL from a storage path
function getPublicStorageUrl(bucket: string, path: string): string {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
}

// Helper function to fetch and embed an image.
// Supports:
// - Absolute URLs (http/https)
// - Public storage paths from known public buckets (company-logos, social-icons)
async function embedImageFromUrl(pdfDoc: any, imageUrlOrPath: string): Promise<any | null> {
  try {
    const candidates = isAbsoluteUrl(imageUrlOrPath)
      ? [imageUrlOrPath]
      : [
          // Try common public buckets used by this app
          getPublicStorageUrl('company-logos', imageUrlOrPath),
          getPublicStorageUrl('social-icons', imageUrlOrPath),
        ];

    let lastError: unknown = null;

    for (const url of candidates) {
      try {
        console.log("Fetching image from:", url);
        const response = await fetch(url);
        if (!response.ok) {
          lastError = new Error(`HTTP ${response.status} ${response.statusText}`);
          continue;
        }

        const imageBuffer = await response.arrayBuffer();
        const imageBytes = new Uint8Array(imageBuffer);

        const isPng = url.toLowerCase().includes('.png') || (imageBytes[0] === 0x89 && imageBytes[1] === 0x50);
        return isPng ? await pdfDoc.embedPng(imageBytes) : await pdfDoc.embedJpg(imageBytes);
      } catch (e) {
        lastError = e;
        continue;
      }
    }

    console.error("Failed to fetch/embed image. source=", imageUrlOrPath, "error=", lastError);
    return null;
  } catch (error) {
    console.error("Error embedding image:", error);
    return null;
  }
}

// Helper function to embed base64 signature image
async function embedSignatureImage(pdfDoc: any, signatureData: string): Promise<any | null> {
  try {
    // Remove data URL prefix if present
    const base64Data = signatureData.replace(/^data:image\/\w+;base64,/, '');
    const imageBytes = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));
    
    // Signature images are typically PNG
    if (signatureData.includes('image/png')) {
      return await pdfDoc.embedPng(imageBytes);
    } else {
      return await pdfDoc.embedJpg(imageBytes);
    }
  } catch (error) {
    console.error("Error embedding signature:", error);
    return null;
  }
}

interface JobPhoto {
  id: string;
  photo_url: string;
  caption: string | null;
  photo_type: string;
}

// Generate PDF using pdf-lib
async function generatePDFDocument(
  type: "quote" | "invoice" | "job",
  document: any,
  company: any,
  customer: any,
  items: DocumentItem[],
  assignee?: any,
  signature?: any,
  jobPhotos?: JobPhoto[],
  pdfPreferences?: {
    pdf_show_notes: boolean;
    pdf_show_signature: boolean;
    pdf_show_job_photos: boolean;
    pdf_show_quote_photos: boolean;
    pdf_show_invoice_photos: boolean;
    pdf_terms_conditions: string | null;
  }
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Add a page
  const page = pdfDoc.addPage([612, 792]); // Letter size
  const { width, height } = page.getSize();
  
  const margin = 50;
  const rightColumnX = width - margin - 150;
  
  // Colors matching the sample invoice
  const primaryColor = rgb(0.16, 0.47, 0.71); // Blue color for headers
  const blackColor = rgb(0, 0, 0);
  const grayColor = rgb(0.35, 0.35, 0.35);
  const lightGrayColor = rgb(0.7, 0.7, 0.7);
  const tableHeaderBg = rgb(0.16, 0.47, 0.71); // Blue background
  const whiteColor = rgb(1, 1, 1);

  let y = height - 40;

  // Document title on the right (large)
  let title: string;
  let documentNumber: string;
  let numberLabel: string;
  
  if (type === "quote") {
    title = "Quote";
    documentNumber = document.quote_number;
    numberLabel = "Quote No:";
  } else if (type === "invoice") {
    title = "Invoice";
    documentNumber = document.invoice_number;
    numberLabel = "Invoice No:";
  } else {
    title = "Job Summary";
    documentNumber = document.job_number;
    numberLabel = "Job No:";
  }

  // Draw title on the right
  page.drawText(title, {
    x: width - margin - helveticaBold.widthOfTextAtSize(title, 28),
    y,
    size: 28,
    font: helveticaBold,
    color: blackColor,
  });
  y -= 18;

  // Document number on right
  const numberText = `${numberLabel} ${documentNumber.replace(/^[A-Z]-\d{4}-/, '')}`;
  page.drawText(numberText, {
    x: rightColumnX,
    y,
    size: 9,
    font: helvetica,
    color: grayColor,
  });
  y -= 12;

  // Format date helper
  const formatDate = (dateStr: string) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  };

  // Date on right
  page.drawText(`Date: ${formatDate(document.created_at)}`, {
    x: rightColumnX,
    y,
    size: 9,
    font: helvetica,
    color: grayColor,
  });
  y -= 12;

  // Due date / Valid until on right
  if (type === "invoice" && document.due_date) {
    page.drawText(`Due Date: ${formatDate(document.due_date)}`, {
      x: rightColumnX,
      y,
      size: 9,
      font: helvetica,
      color: grayColor,
    });
    y -= 12;
  } else if (type === "quote" && document.valid_until) {
    page.drawText(`Valid Until: ${formatDate(document.valid_until)}`, {
      x: rightColumnX,
      y,
      size: 9,
      font: helvetica,
      color: grayColor,
    });
    y -= 12;
  }

  // Left column - Company logo and info
  let leftY = height - 40;
  let logoHeight = 0;
  
  // Try to embed company logo
  if (company?.logo_url) {
    const logoImage = await embedImageFromUrl(pdfDoc, company.logo_url);
    if (logoImage) {
      const maxLogoWidth = 80;
      const maxLogoHeight = 50;
      const logoAspect = logoImage.width / logoImage.height;
      let drawWidth = maxLogoWidth;
      let drawHeight = drawWidth / logoAspect;
      
      if (drawHeight > maxLogoHeight) {
        drawHeight = maxLogoHeight;
        drawWidth = drawHeight * logoAspect;
      }
      
      page.drawImage(logoImage, {
        x: margin,
        y: leftY - drawHeight,
        width: drawWidth,
        height: drawHeight,
      });
      logoHeight = drawHeight + 8;
      leftY -= logoHeight;
    }
  }

  // Company name
  if (company?.name) {
    page.drawText(company.name, {
      x: margin,
      y: leftY,
      size: 14,
      font: helveticaBold,
      color: blackColor,
    });
    leftY -= 14;
  }

  // Company address
  if (company?.address) {
    page.drawText(company.address, {
      x: margin,
      y: leftY,
      size: 9,
      font: helvetica,
      color: grayColor,
    });
    leftY -= 11;
  }

  if (company?.city) {
    page.drawText(company.city, {
      x: margin,
      y: leftY,
      size: 9,
      font: helvetica,
      color: grayColor,
    });
    leftY -= 11;
  }

  const stateZip = [company?.state, company?.zip].filter(Boolean).join(' ');
  if (stateZip) {
    page.drawText(stateZip + " United States", {
      x: margin,
      y: leftY,
      size: 9,
      font: helvetica,
      color: grayColor,
    });
    leftY -= 11;
  }

  // Set y to the lower of left and right columns
  y = Math.min(leftY, y) - 15;

  // Divider line
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 1,
    color: rgb(0.8, 0.2, 0.2), // Red accent line like in sample
  });
  y -= 20;

  // Bill To and Service Address sections
  page.drawText("BILL TO:", {
    x: margin,
    y,
    size: 8,
    font: helvetica,
    color: lightGrayColor,
  });

  page.drawText("SERVICE ADDRESS:", {
    x: width / 2 + 20,
    y,
    size: 8,
    font: helvetica,
    color: lightGrayColor,
  });
  y -= 14;

  // Customer name (both columns)
  if (customer?.name) {
    page.drawText(customer.name, {
      x: margin,
      y,
      size: 10,
      font: helvetica,
      color: blackColor,
    });
    page.drawText(customer.name, {
      x: width / 2 + 20,
      y,
      size: 10,
      font: helvetica,
      color: blackColor,
    });
    y -= 12;
  }

  // Customer address (right column - service address)
  if (customer?.address) {
    page.drawText(customer.address, {
      x: width / 2 + 20,
      y,
      size: 9,
      font: helvetica,
      color: grayColor,
    });
    y -= 11;
  }

  if (customer?.city) {
    page.drawText(customer.city, {
      x: width / 2 + 20,
      y,
      size: 9,
      font: helvetica,
      color: grayColor,
    });
    y -= 11;
  }

  const customerStateZip = [customer?.state, customer?.zip].filter(Boolean).join(' ');
  if (customerStateZip) {
    page.drawText(customerStateZip + " United States", {
      x: width / 2 + 20,
      y,
      size: 9,
      font: helvetica,
      color: grayColor,
    });
    y -= 11;
  }

  y -= 20;

  // Items table with header
  const tableLeft = margin;
  const tableRight = width - margin;
  const colQty = tableRight - 130;
  const colPrice = tableRight - 80;
  const colTotal = tableRight - 30;
  const headerHeight = 20;

  // Table header background
  page.drawRectangle({
    x: tableLeft,
    y: y - headerHeight + 5,
    width: tableRight - tableLeft,
    height: headerHeight,
    color: tableHeaderBg,
  });

  // Table header text
  page.drawText("Items", {
    x: tableLeft + 5,
    y: y - 10,
    size: 9,
    font: helveticaBold,
    color: whiteColor,
  });
  page.drawText("Qty", {
    x: colQty,
    y: y - 10,
    size: 9,
    font: helveticaBold,
    color: whiteColor,
  });
  page.drawText("Unit Price", {
    x: colPrice - 15,
    y: y - 10,
    size: 9,
    font: helveticaBold,
    color: whiteColor,
  });
  page.drawText("Total", {
    x: colTotal - 10,
    y: y - 10,
    size: 9,
    font: helveticaBold,
    color: whiteColor,
  });

  y -= headerHeight + 4;

  // Items rows
  for (const item of items) {
    if (y < 180) {
      // Would need new page, but keeping it simple for now
      break;
    }

    // Item name
    const maxDescLength = 50;
    const itemName = item.description.length > maxDescLength 
      ? item.description.substring(0, maxDescLength) + '...' 
      : item.description;

    page.drawText(itemName, {
      x: tableLeft + 5,
      y,
      size: 9,
      font: helvetica,
      color: blackColor,
    });

    page.drawText(String(item.quantity), {
      x: colQty,
      y,
      size: 9,
      font: helvetica,
      color: blackColor,
    });

    page.drawText(`$${Number(item.unit_price).toFixed(2)}`, {
      x: colPrice - 15,
      y,
      size: 9,
      font: helvetica,
      color: blackColor,
    });

    page.drawText(`$${Number(item.total).toFixed(2)}`, {
      x: colTotal - 10,
      y,
      size: 9,
      font: helvetica,
      color: blackColor,
    });

    // Row separator line - draw below the text with proper spacing
    page.drawLine({
      start: { x: tableLeft, y: y - 5 },
      end: { x: tableRight, y: y - 5 },
      thickness: 0.5,
      color: rgb(0.9, 0.9, 0.9),
    });

    y -= 18;
  }

  y -= 20;

  // Totals section (right aligned)
  const totalsX = width - margin - 120;
  const valuesX = width - margin - 30;

  if (document.subtotal !== undefined) {
    page.drawText("Subtotal:", {
      x: totalsX,
      y,
      size: 9,
      font: helvetica,
      color: grayColor,
    });
    page.drawText(`$${Number(document.subtotal).toFixed(2)}`, {
      x: valuesX - helvetica.widthOfTextAtSize(`$${Number(document.subtotal).toFixed(2)}`, 9),
      y,
      size: 9,
      font: helvetica,
      color: blackColor,
    });
    y -= 14;
  }

  // Discount if applicable
  if (document.discount_value && document.discount_value > 0) {
    const discountAmount = document.discount_type === 'percentage' 
      ? (document.subtotal * document.discount_value / 100)
      : document.discount_value;
    page.drawText("Discount:", {
      x: totalsX,
      y,
      size: 9,
      font: helvetica,
      color: grayColor,
    });
    page.drawText(`-$${Number(discountAmount).toFixed(2)}`, {
      x: valuesX - helvetica.widthOfTextAtSize(`-$${Number(discountAmount).toFixed(2)}`, 9),
      y,
      size: 9,
      font: helvetica,
      color: blackColor,
    });
    y -= 14;
  }

  if (document.tax !== undefined) {
    page.drawText("Tax:", {
      x: totalsX,
      y,
      size: 9,
      font: helvetica,
      color: grayColor,
    });
    page.drawText(`$${Number(document.tax).toFixed(2)}`, {
      x: valuesX - helvetica.widthOfTextAtSize(`$${Number(document.tax).toFixed(2)}`, 9),
      y,
      size: 9,
      font: helvetica,
      color: blackColor,
    });
    y -= 14;
  }

  // Total (bold)
  page.drawText("Total:", {
    x: totalsX,
    y,
    size: 10,
    font: helveticaBold,
    color: blackColor,
  });
  page.drawText(`$${Number(document.total || 0).toFixed(2)}`, {
    x: valuesX - helveticaBold.widthOfTextAtSize(`$${Number(document.total || 0).toFixed(2)}`, 10),
    y,
    size: 10,
    font: helveticaBold,
    color: blackColor,
  });
  y -= 30;

  // Customer Signature section
  if (signature?.signature_data) {
    page.drawText("Customer Signature", {
      x: margin,
      y,
      size: 10,
      font: helveticaBold,
      color: blackColor,
    });
    y -= 10;

    // Try to embed signature image
    const signatureImage = await embedSignatureImage(pdfDoc, signature.signature_data);
    if (signatureImage) {
      const sigMaxWidth = 150;
      const sigMaxHeight = 60;
      const sigAspect = signatureImage.width / signatureImage.height;
      let sigWidth = sigMaxWidth;
      let sigHeight = sigWidth / sigAspect;
      
      if (sigHeight > sigMaxHeight) {
        sigHeight = sigMaxHeight;
        sigWidth = sigHeight * sigAspect;
      }

      page.drawImage(signatureImage, {
        x: margin,
        y: y - sigHeight,
        width: sigWidth,
        height: sigHeight,
      });
      y -= sigHeight + 10;
    }

    // Signer name and date
    if (signature.signer_name) {
      page.drawText(signature.signer_name, {
        x: margin,
        y,
        size: 9,
        font: helvetica,
        color: grayColor,
      });
      y -= 12;
    }

    if (signature.signed_at) {
      page.drawText(`Signed: ${formatDate(signature.signed_at)}`, {
        x: margin,
        y,
        size: 8,
        font: helvetica,
        color: lightGrayColor,
      });
      y -= 20;
    }
  }

  // Notes section
  if ((pdfPreferences?.pdf_show_notes !== false) && document.notes && y > 100) {
    page.drawText("Notes:", {
      x: margin,
      y,
      size: 10,
      font: helveticaBold,
      color: blackColor,
    });
    y -= 14;

    // Wrap notes text
    const maxLineLength = 90;
    const words = document.notes.split(' ');
    let line = '';
    for (const word of words) {
      if (y < 60) break;
      if ((line + word).length > maxLineLength) {
        page.drawText(line.trim(), {
          x: margin,
          y,
          size: 9,
          font: helvetica,
          color: grayColor,
        });
        y -= 11;
        line = word + ' ';
      } else {
        line += word + ' ';
      }
    }
    if (line.trim() && y >= 60) {
      page.drawText(line.trim(), {
        x: margin,
        y,
        size: 9,
        font: helvetica,
        color: grayColor,
      });
      y -= 20;
    }
  }

  // Photos section - check per-document-type preference
  const shouldShowPhotos = 
    (type === "job" && pdfPreferences?.pdf_show_job_photos !== false) ||
    (type === "quote" && pdfPreferences?.pdf_show_quote_photos === true) ||
    (type === "invoice" && pdfPreferences?.pdf_show_invoice_photos === true);

  if (shouldShowPhotos && jobPhotos && jobPhotos.length > 0 && y > 150) {
    // Group photos by type
    const beforePhotos = jobPhotos.filter(p => p.photo_type === 'before');
    const afterPhotos = jobPhotos.filter(p => p.photo_type === 'after');
    const otherPhotos = jobPhotos.filter(p => p.photo_type !== 'before' && p.photo_type !== 'after');

    const photoGroups = [
      { label: "Before Photos", photos: beforePhotos },
      { label: "After Photos", photos: afterPhotos },
      { label: "Other Photos", photos: otherPhotos },
    ].filter(group => group.photos.length > 0);

    for (const group of photoGroups) {
      if (y < 150) {
        const newPage = pdfDoc.addPage([612, 792]);
        y = 792 - 50;
      }

      // Draw group label
      const pages = pdfDoc.getPages();
      let currentPage = pages[pages.length - 1];
      
      currentPage.drawText(group.label + ":", {
        x: margin,
        y,
        size: 10,
        font: helveticaBold,
        color: blackColor,
      });
      y -= 18;

      const photoWidth = 120;
      const photoHeight = 90;
      const photosPerRow = 4;
      const photoSpacing = 10;
      let photoX = margin;
      let photoCount = 0;

      for (const photo of group.photos) {
        if (y < 120) {
          const newPage = pdfDoc.addPage([612, 792]);
          y = 792 - 50;
          photoX = margin;
          photoCount = 0;
        }

        try {
          const photoImage = await embedImageFromUrl(pdfDoc, photo.photo_url);
          if (photoImage) {
            const aspect = photoImage.width / photoImage.height;
            let drawWidth = photoWidth;
            let drawHeight = drawWidth / aspect;
            
            if (drawHeight > photoHeight) {
              drawHeight = photoHeight;
              drawWidth = drawHeight * aspect;
            }

            const pages = pdfDoc.getPages();
            currentPage = pages[pages.length - 1];
            
            currentPage.drawImage(photoImage, {
              x: photoX,
              y: y - drawHeight,
              width: drawWidth,
              height: drawHeight,
            });

            // Draw caption if exists
            if (photo.caption) {
              const captionMaxLen = 18;
              const captionText = photo.caption.length > captionMaxLen 
                ? photo.caption.substring(0, captionMaxLen) + '...' 
                : photo.caption;
              currentPage.drawText(captionText, {
                x: photoX,
                y: y - drawHeight - 10,
                size: 7,
                font: helvetica,
                color: grayColor,
              });
            }

            photoCount++;
            photoX += photoWidth + photoSpacing;

            if (photoCount >= photosPerRow) {
              photoX = margin;
              y -= photoHeight + 25;
              photoCount = 0;
            }
          }
        } catch (error) {
          console.error("Error embedding photo:", error);
        }
      }

      if (photoCount > 0) {
        y -= photoHeight + 25;
      }
    }
  }

  // Terms & Conditions section
  if (pdfPreferences?.pdf_terms_conditions && y > 80) {
    page.drawText("Terms & Conditions:", {
      x: margin,
      y,
      size: 10,
      font: helveticaBold,
      color: blackColor,
    });
    y -= 14;

    // Wrap terms text
    const maxLineLength = 90;
    const words = pdfPreferences.pdf_terms_conditions.split(' ');
    let line = '';
    for (const word of words) {
      if (y < 50) break;
      if ((line + word).length > maxLineLength) {
        page.drawText(line.trim(), {
          x: margin,
          y,
          size: 8,
          font: helvetica,
          color: grayColor,
        });
        y -= 10;
        line = word + ' ';
      } else {
        line += word + ' ';
      }
    }
    if (line.trim() && y >= 50) {
      page.drawText(line.trim(), {
        x: margin,
        y,
        size: 8,
        font: helvetica,
        color: grayColor,
      });
      y -= 15;
    }
  }

  // Footer
  const footerY = 30;
  const footerText = "© Powered by ZoPro";
  const footerWidth = helvetica.widthOfTextAtSize(footerText, 8);
  
  // Use the last page for footer
  const pages = pdfDoc.getPages();
  const lastPage = pages[pages.length - 1];
  lastPage.drawText(footerText, {
    x: (width - footerWidth) / 2,
    y: footerY,
    size: 8,
    font: helvetica,
    color: primaryColor,
  });

  return await pdfDoc.save();
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
  },
  socialLinks?: SocialLink[]
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

  // Generate social icons for the document type
  const socialIconsHtml = socialLinks ? generateSocialIconsHtml(socialLinks, type) : '';

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
        ${socialIconsHtml}
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

    // Fetch social links for this company
    const { data: socialLinks, error: socialLinksError } = await supabase
      .from("company_social_links")
      .select("platform_name, url, icon_url, show_on_invoice, show_on_quote, show_on_job, show_on_email")
      .eq("company_id", document.company_id)
      .order("display_order");

    if (socialLinksError) {
      console.error("Social links fetch error:", socialLinksError);
    }

    console.log(`Found ${socialLinks?.length || 0} social links`);

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

    // Fetch job photos (can be used for jobs, quotes with job_id, or invoices with job_id)
    let jobPhotos: { id: string; photo_url: string; caption: string | null; photo_type: string }[] = [];
    const jobIdForPhotos = type === "job" ? documentId : document.job_id;
    if (jobIdForPhotos) {
      const { data: photosData, error: photosError } = await supabase
        .from("job_photos")
        .select("id, photo_url, caption, photo_type")
        .eq("job_id", jobIdForPhotos)
        .order("display_order");

      if (!photosError && photosData) {
        jobPhotos = photosData;
        console.log(`Found ${jobPhotos.length} job photos`);

        // job-photos bucket is PRIVATE in this project, so photo_url is typically a storage path.
        // We must generate a signed URL so pdf-lib can fetch/embed the bytes.
        const signed = await Promise.all(
          jobPhotos.map(async (p) => {
            if (isAbsoluteUrl(p.photo_url)) return p;

            const { data: signedData, error: signedErr } = await supabase
              .storage
              .from('job-photos')
              .createSignedUrl(p.photo_url, 60 * 10); // 10 minutes

            if (signedErr || !signedData?.signedUrl) {
              console.error('Failed to create signed URL for photo', { photoId: p.id, path: p.photo_url, signedErr });
              return p;
            }

            return { ...p, photo_url: signedData.signedUrl };
          })
        );

        jobPhotos = signed;
      }
    }

    // Extract PDF preferences from company
    const pdfPreferences = {
      pdf_show_notes: company?.pdf_show_notes ?? true,
      pdf_show_signature: company?.pdf_show_signature ?? true,
      pdf_show_logo: company?.pdf_show_logo ?? true,
      pdf_show_line_item_details: company?.pdf_show_line_item_details ?? true,
      pdf_show_job_photos: company?.pdf_show_job_photos ?? true,
      pdf_show_quote_photos: company?.pdf_show_quote_photos ?? false,
      pdf_show_invoice_photos: company?.pdf_show_invoice_photos ?? false,
      pdf_terms_conditions: company?.pdf_terms_conditions ?? null,
      pdf_footer_text: company?.pdf_footer_text ?? null,
    };

    // Generate HTML
    const html = generateHTML(type, document, company, customer, items || [], assignee, signature, pdfPreferences, socialLinks || []);
    
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
      let customEmailBody: string;
      if (type === "quote") {
        subject = `Quote ${documentNumber} from ${company?.name || "Our Company"}`;
        customEmailBody = company?.email_quote_body || "Please find your quote attached. We appreciate the opportunity to serve you. This quote is valid for the period indicated.";
      } else if (type === "invoice") {
        subject = `Invoice ${documentNumber} from ${company?.name || "Our Company"}`;
        customEmailBody = company?.email_invoice_body || "Please find your invoice attached. We appreciate your business. Payment is due by the date indicated on the invoice.";
      } else {
        subject = `Job Summary ${documentNumber} from ${company?.name || "The Team"}`;
        customEmailBody = company?.email_job_body || "Please find your job summary attached. We appreciate your business and look forward to serving you.";
      }

      // Payment info for email
      const paymentMethodLabel = getPaymentMethodLabel(company?.default_payment_method);
      const paymentTerms = company?.payment_terms_days;
      const lateFee = company?.late_fee_percentage;

      // Generate email social icons
      const emailSocialIconsHtml = generateEmailSocialIconsHtml(socialLinks || []);

      // Generate actual PDF document
      console.log("Generating PDF document...");
      const pdfBytes = await generatePDFDocument(type, document, company, customer, items || [], assignee, signature, jobPhotos, pdfPreferences);
      
      // Convert PDF bytes to base64
      const pdfBase64 = btoa(String.fromCharCode(...pdfBytes));
      console.log(`PDF generated, size: ${pdfBytes.length} bytes`);

      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Hello ${customer?.name || ""},</h2>
          <p style="white-space: pre-wrap;">${customEmailBody}</p>
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
          <p style="margin-top: 20px; padding: 15px; background: #f0f9ff; border-radius: 8px; border: 1px solid #bae6fd;">
            📎 <strong>Attached:</strong> ${type === "quote" ? "Quote" : type === "invoice" ? "Invoice" : "Job Summary"} ${documentNumber} (PDF)
          </p>
          <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;" />
          <p>If you have any questions, please don't hesitate to contact us.</p>
          <p>Best regards,<br/>${company?.name || "The Team"}</p>
          ${company?.website ? `<p style="margin-top: 15px;"><a href="${company.website}" style="color: #2563eb; text-decoration: none;">${company.website}</a></p>` : ""}
          ${emailSocialIconsHtml}
        </div>
      `;

      console.log(`Sending email to ${recipientEmail} with PDF attachment`);

      const { data: emailData, error: emailError } = await resend.emails.send({
        from: "ZoPro Notifications <noreply@email.zopro.app>",
        to: [recipientEmail],
        reply_to: company?.email || undefined,
        subject,
        html: emailHtml,
        attachments: [
          {
            filename: `${documentNumber}.pdf`,
            content: pdfBase64,
          }
        ],
      });

      if (emailError) {
        console.error("Email send error:", emailError);
        throw new Error("Failed to send email: " + (emailError as any).message);
      }

      console.log("Email sent successfully with PDF attachment:", emailData);

      // Update document status to 'sent' if it's a draft (not for jobs)
      if (type !== "job" && document.status === "draft") {
        await supabase
          .from(tableName)
          .update({ status: "sent" })
          .eq("id", documentId);
      }

      console.log(`Email sent successfully to ${recipientEmail}`);

      return new Response(
        JSON.stringify({ success: true, message: "Email sent successfully with PDF attachment" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // For download action, generate actual PDF and return as base64
    console.log("Generating PDF for download...");
    const pdfBytes = await generatePDFDocument(type, document, company, customer, items || [], assignee, signature, jobPhotos, pdfPreferences);
    const pdfBase64 = btoa(String.fromCharCode(...pdfBytes));
    console.log(`PDF generated for download, size: ${pdfBytes.length} bytes`);

    return new Response(
      JSON.stringify({ success: true, pdfBase64, documentNumber }),
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