import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Quote } from '@/hooks/useQuotes';

const quoteStatusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  sent: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  accepted: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  expired: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
};

interface QuoteCardProps {
  quote: Quote;
  onView: () => void;
}

export function QuoteCard({ quote, onView }: QuoteCardProps) {
  return (
    <div className="flex items-center justify-between p-3 border rounded-lg bg-card">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{quote.quote_number}</span>
          <Badge className={quoteStatusColors[quote.status] || 'bg-muted'} variant="secondary">
            {quote.status}
          </Badge>
        </div>
        <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
          <span>${quote.total.toFixed(2)}</span>
          <span>•</span>
          <span>{quote.items?.length || 0} items</span>
          {quote.notes && (
            <>
              <span>•</span>
              <span className="truncate max-w-[200px]">{quote.notes}</span>
            </>
          )}
        </div>
      </div>
      <Button variant="ghost" size="sm" onClick={onView}>
        View
      </Button>
    </div>
  );
}
