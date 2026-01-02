import { Button } from "@/components/ui/button";
import { DocumentListCard } from "@/components/shared/DocumentListCard";
import type { Quote } from "@/hooks/useQuotes";

const quoteStatusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  accepted: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  expired: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
};

interface QuoteCardProps {
  quote: Quote;
  onView: () => void;
}

export function QuoteCard({ quote, onView }: QuoteCardProps) {
  const totalFormatted = `$${Number(quote.total).toFixed(2)}`;

  return (
    <DocumentListCard
      documentNumber={quote.quote_number}
      status={quote.status}
      statusColorClass={quoteStatusColors[quote.status] || "bg-muted"}
      totalFormatted={totalFormatted}
      itemCount={quote.items?.length || 0}
      notes={quote.notes}
      onClick={onView}
      actionButton={
        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation();
            onView();
          }}
          className="w-full sm:w-auto"
        >
          View
        </Button>
      }
    />
  );
}
