import { useState, useRef, ReactNode, TouchEvent } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface SwipeableDetailViewProps<T> {
  items: T[];
  currentIndex: number;
  onNavigate: (index: number) => void;
  renderItem: (item: T, index: number) => ReactNode;
  getItemId: (item: T) => string;
  className?: string;
  showIndicators?: boolean;
}

export function SwipeableDetailView<T>({
  items,
  currentIndex,
  onNavigate,
  renderItem,
  getItemId,
  className,
  showIndicators = true,
}: SwipeableDetailViewProps<T>) {
  const isMobile = useIsMobile();
  const [translateX, setTranslateX] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const isHorizontalSwipeRef = useRef<boolean | null>(null);

  const SWIPE_THRESHOLD = 80;

  const handleTouchStart = (e: TouchEvent) => {
    setIsAnimating(false);
    startXRef.current = e.touches[0].clientX;
    startYRef.current = e.touches[0].clientY;
    isHorizontalSwipeRef.current = null;
  };

  const handleTouchMove = (e: TouchEvent) => {
    const diffX = e.touches[0].clientX - startXRef.current;
    const diffY = e.touches[0].clientY - startYRef.current;

    // Determine swipe direction on first significant movement
    if (isHorizontalSwipeRef.current === null && (Math.abs(diffX) > 10 || Math.abs(diffY) > 10)) {
      isHorizontalSwipeRef.current = Math.abs(diffX) > Math.abs(diffY);
    }

    // Only handle horizontal swipes
    if (!isHorizontalSwipeRef.current) return;

    // Restrict swipe if at boundaries
    if ((diffX > 0 && currentIndex === 0) || (diffX < 0 && currentIndex === items.length - 1)) {
      setTranslateX(diffX * 0.2); // Resistance at edges
    } else {
      setTranslateX(diffX);
    }
  };

  const handleTouchEnd = () => {
    if (!isHorizontalSwipeRef.current) return;

    setIsAnimating(true);

    if (translateX > SWIPE_THRESHOLD && currentIndex > 0) {
      // Swipe right - go to previous
      navigator.vibrate?.(10);
      onNavigate(currentIndex - 1);
    } else if (translateX < -SWIPE_THRESHOLD && currentIndex < items.length - 1) {
      // Swipe left - go to next
      navigator.vibrate?.(10);
      onNavigate(currentIndex + 1);
    }

    setTranslateX(0);
  };

  const hasPrevious = currentIndex > 0;
  const hasNext = currentIndex < items.length - 1;

  if (!items.length || currentIndex < 0 || currentIndex >= items.length) {
    return null;
  }

  if (!isMobile) {
    // Desktop: Show navigation arrows
    return (
      <div className={cn('relative', className)}>
        {hasPrevious && (
          <button
            onClick={() => onNavigate(currentIndex - 1)}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-12 p-2 rounded-full bg-background border shadow-md hover:bg-accent z-10"
            aria-label="Previous item"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        {renderItem(items[currentIndex], currentIndex)}

        {hasNext && (
          <button
            onClick={() => onNavigate(currentIndex + 1)}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-12 p-2 rounded-full bg-background border shadow-md hover:bg-accent z-10"
            aria-label="Next item"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}

        {/* Position indicator */}
        {showIndicators && items.length > 1 && (
          <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-muted-foreground">
            {currentIndex + 1} of {items.length}
          </div>
        )}
      </div>
    );
  }

  // Mobile: Swipe navigation
  return (
    <div
      className={cn('relative overflow-hidden touch-pan-y', className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div
        className={cn('transition-transform', isAnimating && 'duration-200 ease-out')}
        style={{ transform: `translateX(${translateX}px)` }}
      >
        {renderItem(items[currentIndex], currentIndex)}
      </div>

      {/* Swipe indicators (dots) */}
      {showIndicators && items.length > 1 && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10">
          {items.length <= 10 ? (
            items.map((item, index) => (
              <div
                key={getItemId(item)}
                className={cn(
                  'w-2 h-2 rounded-full transition-all duration-200',
                  index === currentIndex
                    ? 'bg-primary w-4'
                    : 'bg-muted-foreground/30'
                )}
              />
            ))
          ) : (
            <span className="text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded-full">
              {currentIndex + 1} / {items.length}
            </span>
          )}
        </div>
      )}

      {/* Edge hints during swipe */}
      {translateX > 20 && hasPrevious && (
        <div className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground opacity-60">
          <ChevronLeft className="w-6 h-6 animate-pulse" />
        </div>
      )}
      {translateX < -20 && hasNext && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground opacity-60">
          <ChevronRight className="w-6 h-6 animate-pulse" />
        </div>
      )}
    </div>
  );
}
