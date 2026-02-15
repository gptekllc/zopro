import { Bell, BellOff, Loader2, Smartphone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { isDespiaNative, isDespiaIOS, isDespiaAndroid } from '@/lib/despia';

export function PushNotificationToggle() {
  const { isSupported, isSubscribed, isLoading, permission, subscribe, unsubscribe } = usePushNotifications();

  // Native Despia runtime — push is managed by OS/OneSignal, no toggle needed
  if (isDespiaNative()) {
    const platform = isDespiaIOS() ? 'iOS' : isDespiaAndroid() ? 'Android' : 'Mobile';
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Native Push Notifications
          </CardTitle>
          <CardDescription>
            Push notifications are active on this {platform} device via OneSignal.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Notifications are managed at the operating system level. To adjust notification settings, go to your device's <strong>Settings → Notifications</strong>.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellOff className="h-5 w-5" />
            Push Notifications
          </CardTitle>
          <CardDescription>
            Push notifications are not supported in this browser.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const handleToggle = async () => {
    if (isSubscribed) {
      await unsubscribe();
    } else {
      await subscribe();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Push Notifications
        </CardTitle>
        <CardDescription>
          Get notified about important events like payments, quote approvals, and more.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <Label htmlFor="push-notifications">Enable push notifications</Label>
            <p className="text-sm text-muted-foreground">
              {permission === 'denied' 
                ? 'Notifications are blocked. Please enable them in your browser settings.'
                : isSubscribed 
                  ? "You'll receive notifications on this device."
                  : "You won't receive push notifications."}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            <Switch
              id="push-notifications"
              checked={isSubscribed}
              onCheckedChange={handleToggle}
              disabled={isLoading || permission === 'denied'}
            />
          </div>
        </div>
        
        {permission === 'denied' && (
          <div className="mt-4 p-3 bg-destructive/10 rounded-md">
            <p className="text-sm text-destructive">
              To enable notifications, click the lock icon in your browser's address bar and allow notifications for this site.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
