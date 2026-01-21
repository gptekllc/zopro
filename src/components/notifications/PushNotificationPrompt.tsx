import { useState, useEffect } from 'react';
import { Bell, BellOff, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useAuth } from '@/hooks/useAuth';

const PROMPT_DISMISSED_KEY = 'push-notification-prompt-dismissed';
const PROMPT_DELAY_MS = 3000; // Wait 3 seconds before showing prompt

export function PushNotificationPrompt() {
  const { user } = useAuth();
  const { isSupported, isSubscribed, permission, subscribe, isLoading } = usePushNotifications();
  const [showPrompt, setShowPrompt] = useState(false);
  const [isEnabling, setIsEnabling] = useState(false);

  useEffect(() => {
    // Only show prompt if:
    // 1. User is logged in
    // 2. Push is supported
    // 3. Not already subscribed
    // 4. Permission is 'default' (not yet asked)
    // 5. User hasn't dismissed the prompt before
    if (!user || !isSupported || isSubscribed || permission !== 'default') {
      setShowPrompt(false);
      return;
    }

    const dismissed = localStorage.getItem(PROMPT_DISMISSED_KEY);
    if (dismissed) {
      setShowPrompt(false);
      return;
    }

    // Delay showing the prompt to avoid overwhelming users on login
    const timer = setTimeout(() => {
      setShowPrompt(true);
    }, PROMPT_DELAY_MS);

    return () => clearTimeout(timer);
  }, [user, isSupported, isSubscribed, permission]);

  const handleEnable = async () => {
    setIsEnabling(true);
    try {
      await subscribe();
      setShowPrompt(false);
    } finally {
      setIsEnabling(false);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem(PROMPT_DISMISSED_KEY, 'true');
    setShowPrompt(false);
  };

  if (!showPrompt || isLoading) {
    return null;
  }

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 lg:left-auto lg:right-4 lg:bottom-4 lg:w-96">
      <Card className="shadow-lg border-primary/20 bg-card">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-full bg-primary/10 text-primary">
              <Bell className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm mb-1">Enable Push Notifications</h4>
              <p className="text-xs text-muted-foreground mb-3">
                Get instant alerts for new jobs, payments, and important updates even when the app is closed.
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleEnable}
                  disabled={isEnabling}
                  className="flex-1"
                >
                  {isEnabling ? 'Enabling...' : 'Enable'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleDismiss}
                  disabled={isEnabling}
                >
                  Not now
                </Button>
              </div>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 shrink-0"
              onClick={handleDismiss}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
