import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, MessageSquare, AlertCircle, Crown, RefreshCw } from 'lucide-react';
import { useSmsSettings } from '@/hooks/useSmsSettings';
import { Link } from 'react-router-dom';

export function SmsSettingsCard() {
  const { 
    settings, 
    planInfo, 
    usage, 
    isLoading, 
    isSmsAvailable, 
    updateSettings,
    refetchUsage 
  } = useSmsSettings();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefreshUsage = async () => {
    setIsRefreshing(true);
    await refetchUsage();
    setIsRefreshing(false);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // Calculate usage percentage
  const usagePercentage = usage && usage.messages_limit 
    ? Math.min((usage.messages_sent / usage.messages_limit) * 100, 100)
    : 0;

  const isLimitReached = usage && usage.messages_limit && usage.messages_sent >= usage.messages_limit;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            <CardTitle>SMS Notifications</CardTitle>
          </div>
          {isSmsAvailable ? (
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              Available
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
              <Crown className="w-3 h-3 mr-1" />
              Pro Feature
            </Badge>
          )}
        </div>
        <CardDescription>
          Send transactional SMS messages to customers
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Plan not allowed */}
        {!isSmsAvailable && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              SMS is not available on your current plan ({planInfo?.plan_name || 'Free'}).{' '}
              <Link to="/subscription" className="font-medium underline">
                Upgrade to Professional or Enterprise
              </Link>{' '}
              to enable SMS notifications.
            </AlertDescription>
          </Alert>
        )}

        {/* Usage Stats */}
        {isSmsAvailable && usage && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Monthly Usage</span>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 px-2"
                onClick={handleRefreshUsage}
                disabled={isRefreshing}
              >
                <RefreshCw className={`w-3 h-3 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
            <Progress value={usagePercentage} className="h-2" />
            <div className="flex justify-between text-sm">
              <span className="font-medium">
                {usage.messages_sent} sent
              </span>
              <span className="text-muted-foreground">
                {usage.messages_limit === null ? 'Unlimited' : `${usage.messages_limit} limit`}
              </span>
            </div>
            {isLimitReached && (
              <Alert variant="destructive" className="mt-2">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Monthly SMS limit reached. Resets at the start of next month.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Enable/Disable Toggle */}
        {isSmsAvailable && (
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="sms-enabled">Enable SMS</Label>
                <p className="text-sm text-muted-foreground">
                  Allow sending SMS messages from your company
                </p>
              </div>
              <Switch
                id="sms-enabled"
                checked={settings?.sms_enabled ?? false}
                onCheckedChange={(checked) => updateSettings.mutate({ sms_enabled: checked })}
                disabled={updateSettings.isPending}
              />
            </div>

            {settings?.sms_enabled && (
              <>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="auto-invoice-sms">Auto-send Invoice SMS</Label>
                    <p className="text-sm text-muted-foreground">
                      Send SMS when an invoice is emailed
                    </p>
                  </div>
                  <Switch
                    id="auto-invoice-sms"
                    checked={settings?.auto_send_invoice_sms ?? false}
                    onCheckedChange={(checked) => updateSettings.mutate({ auto_send_invoice_sms: checked })}
                    disabled={updateSettings.isPending}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="auto-portal-sms">Auto-send Portal Link SMS</Label>
                    <p className="text-sm text-muted-foreground">
                      Send SMS when customer portal link is shared
                    </p>
                  </div>
                  <Switch
                    id="auto-portal-sms"
                    checked={settings?.auto_send_portal_link_sms ?? false}
                    onCheckedChange={(checked) => updateSettings.mutate({ auto_send_portal_link_sms: checked })}
                    disabled={updateSettings.isPending}
                  />
                </div>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
