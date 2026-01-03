import { useEffect, useRef, useCallback, useState } from 'react';

interface UseInfiniteScrollOptions {
  /** Number of items to show initially and load more */
  pageSize?: number;
  /** Threshold in pixels from bottom to trigger load more */
  threshold?: number;
}

export function useInfiniteScroll<T>(
  items: T[],
  options: UseInfiniteScrollOptions = {}
) {
  const { pageSize = 20, threshold = 200 } = options;
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Reset visible count when items change significantly (e.g., filter change)
  useEffect(() => {
    setVisibleCount(pageSize);
  }, [items.length > 0 ? items[0] : null, pageSize]);

  const loadMore = useCallback(() => {
    setVisibleCount(prev => Math.min(prev + pageSize, items.length));
  }, [items.length, pageSize]);

  const loadAll = useCallback(() => {
    setVisibleCount(items.length);
  }, [items.length]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && visibleCount < items.length) {
          loadMore();
        }
      },
      { rootMargin: `${threshold}px` }
    );

    const currentRef = loadMoreRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) {
        observer.unobserve(currentRef);
      }
    };
  }, [visibleCount, items.length, loadMore, threshold]);

  const visibleItems = items.slice(0, visibleCount);
  const hasMore = visibleCount < items.length;

  return {
    visibleItems,
    hasMore,
    loadMoreRef,
    loadMore,
    loadAll,
    totalCount: items.length,
    visibleCount,
  };
}
