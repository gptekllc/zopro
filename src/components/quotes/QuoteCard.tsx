import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PenTool, UserCog } from "lucide-react";
import { format } from "date-fns";
import type { Quote } from "@/hooks/useQuotes";

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

  return (
    <Card
      className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
      onClick={onView}
    >
      <CardContent className="p-4 sm:p-5">
        {/* Mobile Layout */}
        <div className="flex flex-col gap-2 sm:hidden">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">{quote.quote_number}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                <span className="truncate">{customerName}</span>
                {customerEmail && (
                  <>
                    <span>•</span>
                    <span className="truncate">{customerEmail}</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                {creatorName && (
                  <span className="flex items-center gap-1">
                    <UserCog className="w-3 h-3" />
                    {creatorName}
                  </span>
                )}
                {quote.valid_until && (
                  <>
                    {creatorName && <span>•</span>}
                    <span className="shrink-0">Valid: {format(new Date(quote.valid_until), 'MMM d')}</span>
                  </>
                )}
              </div>
              {quote.notes && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{quote.notes}</p>
              )}
            </div>
            <span className="text-sm font-semibold text-primary shrink-0">
              ${Number(quote.total).toFixed(2)}
            </span>
          </div>

          <div className="flex items-center gap-1 flex-wrap">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${quoteStatusColors[quote.status] || "bg-muted"}`}>
              {quote.status === 'accepted' ? 'approved' : quote.status}
            </span>
            {signatureId && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success flex items-center gap-1">
                <PenTool className="w-3 h-3" />
                Signed
              </span>
            )}
          </div>
        </div>

        {/* Desktop Layout */}
        <div className="hidden sm:flex flex-col gap-2">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{quote.quote_number}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5 flex-wrap">
                <span className="truncate">{customerName}</span>
                {customerEmail && (
                  <>
                    <span>•</span>
                    <span className="truncate">{customerEmail}</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5 flex-wrap">
                {creatorName && (
                  <span className="flex items-center gap-1">
                    <UserCog className="w-3 h-3" />
                    {creatorName}
                  </span>
                )}
                {quote.valid_until && (
                  <>
                    {creatorName && <span>•</span>}
                    <span className="shrink-0">Valid until {format(new Date(quote.valid_until), 'MMM d, yyyy')}</span>
                  </>
                )}
              </div>
              {quote.notes && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{quote.notes}</p>
              )}
            </div>
            <span className="text-base font-semibold text-primary shrink-0">
              ${Number(quote.total).toFixed(2)}
            </span>
          </div>

          <div className="flex items-center gap-1 flex-wrap">
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${quoteStatusColors[quote.status] || "bg-muted"}`}>
              {quote.status === 'accepted' ? 'approved' : quote.status}
            </span>
            {signatureId && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success flex items-center gap-1">
                <PenTool className="w-3 h-3" />
                Signed
              </span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}