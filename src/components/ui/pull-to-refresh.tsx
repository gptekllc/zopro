import { useState, useRef, useCallback, ReactNode, useEffect } from 'react';
import { Loader2, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Skeleton } from '@/components/ui/skeleton';

interface PullToRefreshProps {
  onRefresh: () => Promise<void>;
  children: ReactNode;
  className?: string;
  renderSkeleton?: () => ReactNode;
}

export function PullToRefresh({ onRefresh, children, className, renderSkeleton }: PullToRefreshProps) {
  const isMobile = useIsMobile();
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const currentY = useRef(0);
  const hasVibrated = useRef(false);

  const PULL_THRESHOLD = 80;
  const MAX_PULL = 120;

  // Haptic feedback when threshold is reached
  useEffect(() => {
    if (pullDistance >= PULL_THRESHOLD && !hasVibrated.current && !isRefreshing) {
      hasVibrated.current = true;
      // Trigger haptic feedback if supported
      if ('vibrate' in navigator) {
        navigator.vibrate(10); // Short 10ms vibration
      }
    }
    if (pullDistance < PULL_THRESHOLD) {
      hasVibrated.current = false;
    }
  }, [pullDistance, isRefreshing]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isRefreshing) return;
    
    const container = containerRef.current;
    if (!container) return;
    
    // Only enable pull-to-refresh when scrolled to top (use window scroll)
    if (window.scrollY > 0) return;
    
    startY.current = e.touches[0].clientY;
    setIsPulling(true);
  }, [isRefreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling || isRefreshing) return;
    
    if (window.scrollY > 0) {
      setPullDistance(0);
      return;
    }

    currentY.current = e.touches[0].clientY;
    const diff = currentY.current - startY.current;
    
    if (diff > 0) {
      // Apply resistance to make it feel natural
      const resistance = 0.5;
      const distance = Math.min(diff * resistance, MAX_PULL);
      setPullDistance(distance);
    }
  }, [isPulling, isRefreshing]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling) return;
    
    setIsPulling(false);
    
    if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
      setIsRefreshing(true);
      setPullDistance(PULL_THRESHOLD / 2); // Keep indicator visible during refresh
      
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [isPulling, pullDistance, isRefreshing, onRefresh]);

  const progress = Math.min(pullDistance / PULL_THRESHOLD, 1);
  const showIndicator = pullDistance > 10 || isRefreshing;

  // If not mobile/tablet, just render children without pull-to-refresh
  if (!isMobile) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      ref={containerRef}
      className={cn("relative", className)}
      style={{ overscrollBehaviorY: 'contain', touchAction: 'pan-y' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <div
        className={cn(
          "absolute left-0 right-0 flex justify-center items-center transition-opacity duration-200 z-10 pointer-events-none",
          showIndicator ? "opacity-100" : "opacity-0"
        )}
        style={{
          top: 0,
          height: `${Math.max(pullDistance, isRefreshing ? 40 : 0)}px`,
        }}
      >
        <div className={cn(
          "flex items-center justify-center w-10 h-10 rounded-full bg-background border shadow-sm transition-transform",
          isRefreshing ? "scale-100" : ""
        )}
        style={{
          transform: `rotate(${progress * 180}deg) scale(${0.5 + progress * 0.5})`,
        }}
        >
          {isRefreshing ? (
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          ) : (
            <ArrowDown className={cn(
              "w-5 h-5 transition-colors",
              progress >= 1 ? "text-primary" : "text-muted-foreground"
            )} />
          )}
        </div>
      </div>

      {/* Content - show skeleton during refresh if provided */}
      <div
        style={{
          transform: `translateY(${pullDistance}px)`,
          transition: isPulling ? 'none' : 'transform 0.2s ease-out',
        }}
      >
        {isRefreshing && renderSkeleton ? renderSkeleton() : children}
      </div>
    </div>
  );
}

// Reusable skeleton components for common views
export function ListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-4 border rounded-lg">
          <Skeleton className="w-10 h-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 p-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-4 border rounded-lg space-y-3">
          <Skeleton className="h-5 w-1/2" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      ))}
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6 p-4">
      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-4 border rounded-lg space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-8 w-2/3" />
          </div>
        ))}
      </div>
      {/* Charts */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    </div>
  );
}
