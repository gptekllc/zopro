import { useRef, useCallback } from "react";

export function useScrollRestoration() {
  const scrollPositionRef = useRef<number>(0);

  const saveScrollPosition = useCallback(() => {
    scrollPositionRef.current = window.scrollY;
  }, []);

  const restoreScrollPosition = useCallback(() => {
    requestAnimationFrame(() => {
      window.scrollTo(0, scrollPositionRef.current);
    });
  }, []);

  return { saveScrollPosition, restoreScrollPosition };
}
