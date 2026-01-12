import { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { cn } from '@/lib/utils';

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showOnlineMessage, setShowOnlineMessage] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      setShowOnlineMessage(true);
      // Hide the "back online" message after 3 seconds
      setTimeout(() => setShowOnlineMessage(false), 3000);
    };
    
    const handleOffline = () => {
      setIsOffline(true);
      setShowOnlineMessage(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline && !showOnlineMessage) return null;

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-[100] text-white text-center py-2 text-sm flex items-center justify-center gap-2 transition-all duration-300",
        isOffline ? "bg-amber-500" : "bg-green-500"
      )}
      style={{
        paddingTop: 'calc(var(--safe-area-top) + 0.5rem)',
      }}
    >
      {isOffline ? (
        <>
          <WifiOff className="w-4 h-4" />
          <span>You're offline. Some features may be limited.</span>
        </>
      ) : (
        <>
          <Wifi className="w-4 h-4" />
          <span>You're back online!</span>
        </>
      )}
    </div>
  );
}
