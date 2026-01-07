import { useState, useRef, ReactNode, TouchEvent, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft, X } from "lucide-react";

export interface SwipeAction {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  variant?: "default" | "destructive" | "warning" | "success";
}

interface SwipeableCardProps {
  children: ReactNode;
  leftActions?: SwipeAction[];
  rightActions?: SwipeAction[];
  className?: string;
  disabled?: boolean;
  showHint?: boolean;
  onHintDismiss?: () => void;
}

const variantStyles = {
  default: "bg-primary text-primary-foreground",
  destructive: "bg-destructive text-destructive-foreground",
  warning: "bg-amber-500 text-white",
  success: "bg-success text-white",
};

// Trigger haptic feedback if available
const triggerHaptic = (style: "light" | "medium" | "heavy" = "light") => {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    const duration = style === "light" ? 10 : style === "medium" ? 20 : 30;
    navigator.vibrate(duration);
  }
};

export function SwipeableCard({
  children,
  leftActions = [],
  rightActions = [],
  className,
  disabled = false,
  showHint = false,
  onHintDismiss,
}: SwipeableCardProps) {
  const [translateX, setTranslateX] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasTriggeredHapticRef = useRef(false);

  const ACTION_WIDTH = 64;
  const maxLeftSwipe = leftActions.length * ACTION_WIDTH;
  const maxRightSwipe = rightActions.length * ACTION_WIDTH;

  // Show tooltip hint on first render if showHint is true
  useEffect(() => {
    if (showHint && rightActions.length > 0) {
      const timer = setTimeout(() => {
        setShowTooltip(true);
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [showHint, rightActions.length]);

  const dismissTooltip = () => {
    setShowTooltip(false);
    onHintDismiss?.();
  };

  const handleTouchStart = (e: TouchEvent) => {
    if (disabled) return;
    // Dismiss tooltip on any touch
    if (showTooltip) {
      dismissTooltip();
    }
    setIsAnimating(false);
    startXRef.current = e.touches[0].clientX;
    currentXRef.current = translateX;
    hasTriggeredHapticRef.current = false;
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (disabled) return;
    const diff = e.touches[0].clientX - startXRef.current;
    let newTranslate = currentXRef.current + diff;

    // Trigger haptic when crossing threshold
    const threshold = ACTION_WIDTH / 2;
    if (!hasTriggeredHapticRef.current && Math.abs(newTranslate) > threshold) {
      triggerHaptic("light");
      hasTriggeredHapticRef.current = true;
    }

    // Clamp the translation
    if (newTranslate > maxLeftSwipe) {
      newTranslate = maxLeftSwipe + (newTranslate - maxLeftSwipe) * 0.2;
    } else if (newTranslate < -maxRightSwipe) {
      newTranslate = -maxRightSwipe + (newTranslate + maxRightSwipe) * 0.2;
    }

    setTranslateX(newTranslate);
  };

  const handleTouchEnd = () => {
    if (disabled) return;
    setIsAnimating(true);

    // Snap to position
    const threshold = ACTION_WIDTH / 2;

    if (translateX > threshold && leftActions.length > 0) {
      triggerHaptic("medium");
      setTranslateX(maxLeftSwipe);
    } else if (translateX < -threshold && rightActions.length > 0) {
      triggerHaptic("medium");
      setTranslateX(-maxRightSwipe);
    } else {
      setTranslateX(0);
    }
  };

  const handleActionClick = (action: SwipeAction) => {
    triggerHaptic("medium");
    setIsAnimating(true);
    setTranslateX(0);
    // Small delay to let the animation complete
    setTimeout(() => {
      action.onClick();
    }, 150);
  };

  const resetSwipe = () => {
    setIsAnimating(true);
    setTranslateX(0);
  };

  return (
    <div
      ref={containerRef}
      className={cn("relative overflow-hidden sm:overflow-visible", className)}
    >
      {/* Left Actions (revealed when swiping right) */}
      {leftActions.length > 0 && (
        <div className="absolute inset-y-0 left-0 flex sm:hidden">
          {leftActions.map((action, index) => (
            <button
              key={index}
              onClick={() => handleActionClick(action)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-4",
                variantStyles[action.variant || "default"]
              )}
              style={{ width: ACTION_WIDTH }}
            >
              {action.icon}
              <span className="text-[10px] font-medium">{action.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Right Actions (revealed when swiping left) */}
      {rightActions.length > 0 && (
        <div className="absolute inset-y-0 right-0 flex sm:hidden">
          {rightActions.map((action, index) => (
            <button
              key={index}
              onClick={() => handleActionClick(action)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 px-4",
                variantStyles[action.variant || "default"]
              )}
              style={{ width: ACTION_WIDTH }}
            >
              {action.icon}
              <span className="text-[10px] font-medium">{action.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Main Content */}
      <div
        className={cn(
          "relative bg-background",
          isAnimating && "transition-transform duration-200 ease-out"
        )}
        style={{ transform: `translateX(${translateX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={(e) => {
          if (showTooltip) {
            e.stopPropagation();
            dismissTooltip();
            return;
          }
          if (translateX !== 0) {
            e.stopPropagation();
            resetSwipe();
          }
          // Otherwise, let the click propagate to the card's onClick
        }}
      >
        {children}

        {/* Swipe Hint Tooltip */}
        {showTooltip && (
          <div 
            className="absolute inset-0 flex items-center justify-end bg-foreground/5 sm:hidden animate-fade-in"
          >
            <div className="mr-3 flex items-center gap-1 bg-foreground/90 text-background pl-3 pr-1.5 py-1.5 rounded-full text-xs font-medium shadow-lg">
              <ChevronLeft className="w-3.5 h-3.5 animate-[slide-hint_1s_ease-in-out_infinite]" />
              <span>Swipe left for actions</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  dismissTooltip();
                }}
                className="ml-1 p-0.5 rounded-full hover:bg-background/20 transition-colors"
                aria-label="Dismiss hint"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Hook to manage swipe hint state
export function useSwipeHint(storageKey: string) {
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    const hasSeenHint = localStorage.getItem(storageKey);
    if (!hasSeenHint) {
      setShowHint(true);
    }
  }, [storageKey]);

  const dismissHint = () => {
    localStorage.setItem(storageKey, "true");
    setShowHint(false);
  };

  return { showHint, dismissHint };
}
