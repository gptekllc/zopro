import { useEffect } from 'react';

export function useNavigationBlocker(shouldBlock: boolean) {
  // Protect against browser-level navigation (tab close, refresh, back button)
  useEffect(() => {
    if (!shouldBlock) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [shouldBlock]);

  // Set a global flag for in-app navigation guards (checked by MobileBottomNav & AppLayout)
  useEffect(() => {
    (window as any).__hasUnsavedChanges = shouldBlock;
    return () => { (window as any).__hasUnsavedChanges = false; };
  }, [shouldBlock]);
}
