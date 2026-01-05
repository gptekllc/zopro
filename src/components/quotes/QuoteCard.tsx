import { PenTool, UserCog } from "lucide-react";
import { format } from "date-fns";
import type { Quote } from "@/hooks/useQuotes";
import { DocumentListCard } from "@/components/documents/DocumentListCard";

const quoteStatusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-primary/10 text-primary",
  accepted: "bg-success/10 text-success",
  rejected: "bg-destructive/10 text-destructive",
  expired: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
};

interface QuoteCardProps {
  quote: Quote;
  onView: () => void;
}

export function QuoteCard({ quote, onView }: QuoteCardProps) {
  const customerName = quote.customer?.name || "Unknown";
  const customerEmail = quote.customer?.email || null;
  const creatorName = (quote as any).creator?.full_name || null;
  const signatureId = quote.signature_id;

  const metadataRow = (
    <>
      {creatorName && (
        <span className="flex items-center gap-1">
          <UserCog className="w-3 h-3" />
          {creatorName}
        </span>
      )}
      {quote.valid_until && (
        <>
          {creatorName && <span>•</span>}
          <span className="shrink-0">
            <span className="sm:hidden">Valid: {format(new Date(quote.valid_until), 'MMM d')}</span>
            <span className="hidden sm:inline">Valid until {format(new Date(quote.valid_until), 'MMM d, yyyy')}</span>
          </span>
        </>
      )}
    </>
  );

  const tagsRow = (
    <>
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${quoteStatusColors[quote.status] || "bg-muted"}`}>
        {quote.status === 'accepted' ? 'approved' : quote.status}
      </span>
      {signatureId && (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success flex items-center gap-1">
          <PenTool className="w-3 h-3" />
          Signed
        </span>
      )}
    </>
  );

  return (
    <DocumentListCard
      onClick={onView}
      documentNumber={quote.quote_number}
      customerName={customerName}
      customerEmail={customerEmail}
      total={Number(quote.total)}
      metadataRow={metadataRow}
      notes={quote.notes}
      tagsRow={tagsRow}
    />
  );
}
