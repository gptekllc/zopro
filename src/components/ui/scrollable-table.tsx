import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface ScrollableTableProps {
  children: React.ReactNode;
  className?: string;
}

export function ScrollableTable({ children, className }: ScrollableTableProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(false);

  const checkScroll = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
  }, []);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    checkScroll();
    el.addEventListener('scroll', checkScroll, { passive: true });
    
    const resizeObserver = new ResizeObserver(checkScroll);
    resizeObserver.observe(el);

    return () => {
      el.removeEventListener('scroll', checkScroll);
      resizeObserver.disconnect();
    };
  }, [checkScroll]);

  const scrollTo = (direction: 'left' | 'right') => {
    const el = scrollRef.current;
    if (!el) return;
    
    const scrollAmount = el.clientWidth * 0.75;
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  };

  return (
    <div className="relative group">
      {/* Left scroll indicator */}
      <div
        className={cn(
          "absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none transition-opacity duration-200 md:hidden",
          canScrollLeft ? "opacity-100" : "opacity-0"
        )}
      />
      <button
        onClick={() => scrollTo('left')}
        className={cn(
          "absolute left-1 top-1/2 -translate-y-1/2 z-20 p-1.5 rounded-full bg-background/90 border shadow-sm transition-opacity duration-200 md:hidden",
          canScrollLeft ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        aria-label="Scroll left"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {/* Right scroll indicator */}
      <div
        className={cn(
          "absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none transition-opacity duration-200 md:hidden",
          canScrollRight ? "opacity-100" : "opacity-0"
        )}
      />
      <button
        onClick={() => scrollTo('right')}
        className={cn(
          "absolute right-1 top-1/2 -translate-y-1/2 z-20 p-1.5 rounded-full bg-background/90 border shadow-sm transition-opacity duration-200 md:hidden",
          canScrollRight ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        aria-label="Scroll right"
      >
        <ChevronRight className="w-4 h-4" />
      </button>

      {/* Scrollable container */}
      <div
        ref={scrollRef}
        className={cn("overflow-x-auto", className)}
      >
        {children}
      </div>
    </div>
  );
}
