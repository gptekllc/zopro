import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

type DocumentListCardProps = {
  /** e.g. invoice number, quote number */
  documentNumber: string;
  /** Status text */
  status: string;
  /** CSS classes for status badge */
  statusColorClass: string;
  /** Total amount formatted as string e.g. "$123.45" */
  totalFormatted: string;
  /** Item count for the document */
  itemCount?: number;
  /** Optional notes to truncate */
  notes?: string | null;
  /** Click handler for entire card */
  onClick: () => void;
  /** Optional action button (right side) */
  actionButton?: React.ReactNode;
  /** Optional extra badges/elements after status */
  extraBadges?: React.ReactNode;
  /** Optional secondary info line (customer name, due date, etc.) */
  secondaryInfo?: React.ReactNode;
};

export function DocumentListCard({
  documentNumber,
  status,
  statusColorClass,
  totalFormatted,
  itemCount,
  notes,
  onClick,
  actionButton,
  extraBadges,
  secondaryInfo,
}: DocumentListCardProps) {
  return (
    <div
      className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 p-3 border rounded-lg bg-card hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{documentNumber}</span>
          <Badge
            className={`${statusColorClass} text-xs`}
            variant="secondary"
          >
            {status}
          </Badge>
          {extraBadges}
        </div>
        <div className="flex items-center gap-2 sm:gap-3 mt-1 text-xs sm:text-sm text-muted-foreground flex-wrap">
          <span>{totalFormatted}</span>
          {itemCount !== undefined && (
            <>
              <span className="hidden sm:inline">•</span>
              <span>{itemCount} item{itemCount !== 1 ? "s" : ""}</span>
            </>
          )}
          {secondaryInfo}
          {notes && (
            <>
              <span className="hidden sm:inline">•</span>
              <span className="truncate max-w-[150px] sm:max-w-[200px] hidden sm:inline">
                {notes}
              </span>
            </>
          )}
        </div>
      </div>
      {actionButton}
    </div>
  );
}
