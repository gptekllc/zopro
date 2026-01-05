import { useState, useRef, ReactNode, TouchEvent } from "react";
import { cn } from "@/lib/utils";

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
}

const variantStyles = {
  default: "bg-primary text-primary-foreground",
  destructive: "bg-destructive text-destructive-foreground",
  warning: "bg-amber-500 text-white",
  success: "bg-success text-white",
};

export function SwipeableCard({
  children,
  leftActions = [],
  rightActions = [],
  className,
  disabled = false,
}: SwipeableCardProps) {
  const [translateX, setTranslateX] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const startXRef = useRef(0);
  const currentXRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const ACTION_WIDTH = 64;
  const maxLeftSwipe = leftActions.length * ACTION_WIDTH;
  const maxRightSwipe = rightActions.length * ACTION_WIDTH;

  const handleTouchStart = (e: TouchEvent) => {
    if (disabled) return;
    setIsAnimating(false);
    startXRef.current = e.touches[0].clientX;
    currentXRef.current = translateX;
  };

  const handleTouchMove = (e: TouchEvent) => {
    if (disabled) return;
    const diff = e.touches[0].clientX - startXRef.current;
    let newTranslate = currentXRef.current + diff;

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
      setTranslateX(maxLeftSwipe);
    } else if (translateX < -threshold && rightActions.length > 0) {
      setTranslateX(-maxRightSwipe);
    } else {
      setTranslateX(0);
    }
  };

  const handleActionClick = (action: SwipeAction) => {
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
        onClick={translateX !== 0 ? resetSwipe : undefined}
      >
        {children}
      </div>
    </div>
  );
}
