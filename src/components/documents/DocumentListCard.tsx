import { Card, CardContent } from "@/components/ui/card";
import { SwipeableCard, SwipeAction } from "@/components/ui/swipeable-card";
import { ReactNode } from "react";

interface DocumentListCardProps {
  onClick?: () => void;
  isArchived?: boolean;
  // Row 1: Document info on the left, total + optional actions on the right
  documentNumber: string;
  title?: string;
  customerName: string;
  customerEmail?: string | null;
  total?: number;
  // Row 2: Metadata (creator, dates, etc.)
  metadataRow?: ReactNode;
  // Notes
  notes?: string | null;
  // Row 3: Tags on the left, actions on the right
  tagsRow: ReactNode;
  actionsMenu?: ReactNode;
  // Desktop only: show icon
  icon?: ReactNode;
  // Swipe actions for mobile
  swipeLeftActions?: SwipeAction[];
  swipeRightActions?: SwipeAction[];
}

export function DocumentListCard({
  onClick,
  isArchived = false,
  documentNumber,
  title,
  customerName,
  customerEmail,
  total,
  metadataRow,
  notes,
  tagsRow,
  actionsMenu,
  icon,
  swipeLeftActions = [],
  swipeRightActions = [],
}: DocumentListCardProps) {
  const hasSwipeActions = swipeLeftActions.length > 0 || swipeRightActions.length > 0;

  const cardContent = (
    <Card
      className={`overflow-hidden hover:shadow-md transition-shadow cursor-pointer ${isArchived ? 'opacity-60 border-dashed' : ''}`}
      onClick={onClick}
    >
      <CardContent className="p-4 sm:p-5">
        {/* Mobile Layout */}
        <div className="flex flex-col gap-2 sm:hidden">
          {/* Row 1: Document Info + Total */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">{documentNumber}</span>
                {title && (
                  <>
                    <span className="text-muted-foreground">•</span>
                    <span className="font-medium text-sm truncate">{title}</span>
                  </>
                )}
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
            </div>
            {total !== undefined && total > 0 && (
              <span className="text-sm font-semibold text-primary shrink-0">
                ${total.toFixed(2)}
              </span>
            )}
          </div>

          {/* Row 2: Metadata */}
          {metadataRow && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
              {metadataRow}
            </div>
          )}

          {/* Notes */}
          {notes && (
            <p className="text-xs text-muted-foreground line-clamp-1">{notes}</p>
          )}

          {/* Row 3: Tags + Actions */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 flex-wrap" onClick={(e) => e.stopPropagation()}>
              {tagsRow}
            </div>
            {actionsMenu && (
              <div onClick={(e) => e.stopPropagation()} className="shrink-0">
                {actionsMenu}
              </div>
            )}
          </div>
        </div>

        {/* Desktop Layout */}
        <div className="hidden sm:flex sm:flex-col gap-2">
          {/* Row 1: Document Info + Total + Actions */}
          <div className="flex items-start justify-between gap-4">
            {/* Left: Icon + Document Info */}
            <div className="flex items-start gap-4 min-w-0 flex-1">
              {icon}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold">{documentNumber}</h3>
                  {title && (
                    <>
                      <span className="text-muted-foreground">•</span>
                      <span className="font-medium truncate">{title}</span>
                    </>
                  )}
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
              </div>
            </div>

            {/* Right: Total + Actions */}
            <div className="flex items-center gap-2 shrink-0">
              {total !== undefined && total > 0 && (
                <span className="text-base font-semibold text-primary">
                  ${total.toFixed(2)}
                </span>
              )}
              {actionsMenu && (
                <div onClick={(e) => e.stopPropagation()}>
                  {actionsMenu}
                </div>
              )}
            </div>
          </div>

          {/* Row 2: Metadata */}
          {metadataRow && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
              {metadataRow}
            </div>
          )}

          {/* Notes */}
          {notes && (
            <p className="text-sm text-muted-foreground line-clamp-1">{notes}</p>
          )}

          {/* Row 3: Tags */}
          <div className="flex items-center gap-1 flex-wrap" onClick={(e) => e.stopPropagation()}>
            {tagsRow}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (hasSwipeActions) {
    return (
      <SwipeableCard
        leftActions={swipeLeftActions}
        rightActions={swipeRightActions}
      >
        {cardContent}
      </SwipeableCard>
    );
  }

  return cardContent;
}
