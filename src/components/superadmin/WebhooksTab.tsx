import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  RefreshCw, 
  ExternalLink, 
  Copy, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Loader2,
  Play,
  Eye,
  CreditCard,
  Wallet,
  Square,
  RotateCcw,
  Zap,
  TestTube
} from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { useWebhookLogs, useWebhookStats, WebhookLog } from '@/hooks/useWebhookLogs';
import { usePaymentProviders, PaymentProvider } from '@/hooks/usePaymentProviders';
import { supabase } from '@/integrations/supabase/client';

const SUPABASE_PROJECT_ID = 'emscfiinctuysscrarlg';

const getWebhookUrl = (providerKey: string) => {
  return `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/${providerKey}-webhook`;
};

const STRIPE_EVENT_TYPES = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'payment_intent.payment_failed',
  'invoice.payment_failed',
];

const getProviderIcon = (providerKey: string) => {
  switch (providerKey) {
    case 'stripe':
      return <CreditCard className="w-5 h-5 text-primary" />;
    case 'paypal':
      return <Wallet className="w-5 h-5" />;
    case 'square':
      return <Square className="w-5 h-5" />;
    default:
      return <CreditCard className="w-5 h-5" />;
  }
};

interface ProviderCardProps {
  provider: PaymentProvider;
  stats: any;
  onCopyUrl: (url: string) => void;
  onTestEvent: () => void;
  onTestPayment: () => void;
  onToggleEnabled: (enabled: boolean) => void;
  onToggleComingSoon: (comingSoon: boolean) => void;
  isUpdating: boolean;
}

function ProviderCard({
  provider,
  stats,
  onCopyUrl,
  onTestEvent,
  onTestPayment,
  onToggleEnabled,
  onToggleComingSoon,
  isUpdating,
}: ProviderCardProps) {
  const webhookUrl = getWebhookUrl(provider.provider_key);
  const eventCount = stats?.byProvider?.[provider.provider_key] || 0;
  const isActive = provider.is_enabled && !provider.is_coming_soon;

  return (
    <Card className={provider.is_coming_soon && !provider.is_enabled ? 'opacity-60' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getProviderIcon(provider.provider_key)}
            <CardTitle className="text-lg">{provider.name.replace(' Payments', '')}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {provider.is_coming_soon ? (
              <Badge variant="secondary">Coming Soon</Badge>
            ) : provider.is_enabled ? (
              <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Enabled</Badge>
            ) : (
              <Badge variant="outline">Disabled</Badge>
            )}
          </div>
        </div>
        <CardDescription>{provider.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Admin Controls */}
        <div className="space-y-2 border-b pb-3">
          <div className="flex items-center justify-between">
            <Label htmlFor={`coming-soon-${provider.id}`} className="text-xs text-muted-foreground">
              Mark as Coming Soon
            </Label>
            <Switch
              id={`coming-soon-${provider.id}`}
              checked={provider.is_coming_soon}
              onCheckedChange={onToggleComingSoon}
              disabled={isUpdating}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor={`enabled-${provider.id}`} className="text-xs text-muted-foreground">
              Enable for Companies
            </Label>
            <Switch
              id={`enabled-${provider.id}`}
              checked={provider.is_enabled}
              onCheckedChange={onToggleEnabled}
              disabled={isUpdating || provider.is_coming_soon}
            />
          </div>
        </div>

        {isActive && (
          <>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Webhook URL</p>
              <div className="flex items-center gap-2">
                <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">
                  {webhookUrl}
                </code>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-7 w-7 shrink-0"
                  onClick={() => onCopyUrl(webhookUrl)}
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Events (24h)</span>
              <span className="font-medium">{eventCount}</span>
            </div>
            {stats?.lastEventAt && provider.provider_key === 'stripe' && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Last Event</span>
                <span className="text-xs">{formatDistanceToNow(new Date(stats.lastEventAt), { addSuffix: true })}</span>
              </div>
            )}
            <div className="flex flex-col gap-2 pt-2">
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex-1"
                  onClick={onTestEvent}
                >
                  <Play className="w-3 h-3 mr-1" />
                  Test Event
                </Button>
                {provider.docs_url && (
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex-1"
                    asChild
                  >
                    <a 
                      href={provider.docs_url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="w-3 h-3 mr-1" />
                      Dashboard
                    </a>
                  </Button>
                )}
              </div>
              {provider.provider_key === 'stripe' && (
                <Button 
                  size="sm" 
                  className="w-full"
                  onClick={onTestPayment}
                >
                  <TestTube className="w-3 h-3 mr-1" />
                  Test Payment Flow
                </Button>
              )}
            </div>
          </>
        )}

        {!isActive && provider.docs_url && (
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full"
            asChild
          >
            <a 
              href={provider.docs_url} 
              target="_blank" 
              rel="noopener noreferrer"
            >
              <ExternalLink className="w-3 h-3 mr-1" />
              View Docs
            </a>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

export function WebhooksTab() {
  const queryClient = useQueryClient();
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testPaymentDialogOpen, setTestPaymentDialogOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState('stripe');
  const [selectedEventType, setSelectedEventType] = useState('checkout.session.completed');
  const [isTesting, setIsTesting] = useState(false);
  const [isTestingPayment, setIsTestingPayment] = useState(false);
  const [retryingEventId, setRetryingEventId] = useState<string | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<WebhookLog | null>(null);

  const { providers, updateProvider, isUpdating } = usePaymentProviders();

  const { data: logs = [], isLoading: logsLoading, refetch } = useWebhookLogs({
    provider: providerFilter !== 'all' ? providerFilter : undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    limit: 100,
  });

  const { data: stats } = useWebhookStats();

  const getProviderByKey = (key: string) => providers.find(p => p.provider_key === key);

  // Real-time subscription for new webhook events
  useEffect(() => {
    const channel = supabase
      .channel('webhook-logs-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'webhook_event_logs' },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['webhook-logs'] });
          queryClient.invalidateQueries({ queryKey: ['webhook-stats'] });
          const newLog = payload.new as WebhookLog;
          toast.info(`New webhook: ${newLog.event_type}`, {
            description: `Provider: ${newLog.provider} • Status: ${newLog.status}`,
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'webhook_event_logs' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['webhook-logs'] });
          queryClient.invalidateQueries({ queryKey: ['webhook-stats'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const handleTestWebhook = async () => {
    setIsTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('test-webhook', {
        body: {
          provider: selectedProvider,
          eventType: selectedEventType,
        },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success('Test webhook sent successfully');
        refetch();
      } else {
        toast.error(data?.error || 'Test webhook failed');
      }
    } catch (error) {
      toast.error('Failed to send test webhook');
    } finally {
      setIsTesting(false);
      setTestDialogOpen(false);
    }
  };

  const handleTestPaymentFlow = async () => {
    setIsTestingPayment(true);
    try {
      const { data, error } = await supabase.functions.invoke('test-payment-flow', {
        body: { testAmount: 100 }, // $1.00
      });

      if (error) throw error;

      if (data?.url) {
        toast.success('Test checkout session created! Opening Stripe...');
        window.open(data.url, '_blank');
      } else if (data?.error) {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to create test payment');
    } finally {
      setIsTestingPayment(false);
      setTestPaymentDialogOpen(false);
    }
  };

  const handleRetryWebhook = async (eventId: string) => {
    setRetryingEventId(eventId);
    try {
      const { data, error } = await supabase.functions.invoke('retry-webhook', {
        body: { eventId },
      });

      if (error) throw error;

      if (data?.success) {
        toast.success('Webhook retry successful');
        refetch();
      } else if (data?.error) {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to retry webhook');
    } finally {
      setRetryingEventId(null);
    }
  };

  const handleViewDetails = (log: WebhookLog) => {
    setSelectedLog(log);
    setDetailsDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'processed':
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20"><CheckCircle2 className="w-3 h-3 mr-1" />Processed</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      case 'processing':
        return <Badge variant="secondary"><Loader2 className="w-3 h-3 mr-1 animate-spin" />Processing</Badge>;
      case 'received':
        return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" />Received</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTableProviderIcon = (provider: string) => {
    switch (provider) {
      case 'stripe':
        return <CreditCard className="w-4 h-4" />;
      case 'paypal':
        return <Wallet className="w-4 h-4" />;
      case 'square':
        return <Square className="w-4 h-4" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Provider Configuration Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {providers.map((provider) => (
          <ProviderCard
            key={provider.id}
            provider={provider}
            stats={stats}
            onCopyUrl={copyToClipboard}
            onTestEvent={() => {
              setSelectedProvider(provider.provider_key);
              setTestDialogOpen(true);
            }}
            onTestPayment={() => setTestPaymentDialogOpen(true)}
            onToggleEnabled={(enabled) => updateProvider({ id: provider.id, updates: { is_enabled: enabled } })}
            onToggleComingSoon={(comingSoon) => updateProvider({ id: provider.id, updates: { is_coming_soon: comingSoon } })}
            isUpdating={isUpdating}
          />
        ))}
      </div>

      {/* Webhook Event Logs */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle>Webhook Event Logs</CardTitle>
              <CardDescription>Real-time view of incoming webhook events</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={providerFilter} onValueChange={setProviderFilter}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Providers</SelectItem>
                  <SelectItem value="stripe">Stripe</SelectItem>
                  <SelectItem value="paypal">PayPal</SelectItem>
                  <SelectItem value="square">Square</SelectItem>
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="processed">Processed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="received">Received</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={() => refetch()}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No webhook events recorded yet</p>
              <p className="text-sm mt-1">Events will appear here as they are received</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Event Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Time</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs text-muted-foreground">
                        {format(new Date(log.created_at), 'MMM d, HH:mm:ss')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          {getTableProviderIcon(log.provider)}
                          <span className="capitalize">{log.provider}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                          {log.event_type}
                        </code>
                      </TableCell>
                      <TableCell>{getStatusBadge(log.status)}</TableCell>
                      <TableCell className="text-right text-sm text-muted-foreground">
                        {log.processing_time_ms ? `${log.processing_time_ms}ms` : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7"
                            onClick={() => handleViewDetails(log)}
                          >
                            <Eye className="w-3 h-3" />
                          </Button>
                          {log.status === 'failed' && (
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-7 w-7 text-amber-500 hover:text-amber-600"
                              onClick={() => handleRetryWebhook(log.id)}
                              disabled={retryingEventId === log.id}
                            >
                              {retryingEventId === log.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <RotateCcw className="w-3 h-3" />
                              )}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test Webhook Dialog */}
      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Test Webhook</DialogTitle>
            <DialogDescription>
              Send a test event to verify your webhook endpoint is working correctly.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Provider</label>
              <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="stripe">Stripe</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Event Type</label>
              <Select value={selectedEventType} onValueChange={setSelectedEventType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STRIPE_EVENT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleTestWebhook} disabled={isTesting}>
              {isTesting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Send Test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Payment Flow Dialog */}
      <Dialog open={testPaymentDialogOpen} onOpenChange={setTestPaymentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TestTube className="w-5 h-5" />
              Test Payment Flow
            </DialogTitle>
            <DialogDescription>
              Create a test Stripe Checkout session to verify the complete payment and webhook flow.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
              <p className="font-medium text-sm">This will:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Create a $1.00 test checkout session</li>
                <li>• Open Stripe Checkout in a new tab</li>
                <li>• Process the webhook when payment completes</li>
                <li>• Verify email notifications are sent</li>
              </ul>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-300">
                <strong>Tip:</strong> Use test card <code className="bg-blue-100 dark:bg-blue-800 px-1 rounded">4242 4242 4242 4242</code> with any future date and CVC.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestPaymentDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleTestPaymentFlow} disabled={isTestingPayment}>
              {isTestingPayment && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Start Test Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Event Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Event Details</DialogTitle>
            <DialogDescription>
              {selectedLog?.event_id && `Event ID: ${selectedLog.event_id}`}
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Provider</span>
                  <p className="font-medium capitalize">{selectedLog.provider}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Status</span>
                  <div className="mt-1">{getStatusBadge(selectedLog.status)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Event Type</span>
                  <p className="font-medium">{selectedLog.event_type}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Processing Time</span>
                  <p className="font-medium">{selectedLog.processing_time_ms ? `${selectedLog.processing_time_ms}ms` : 'N/A'}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">Timestamp</span>
                  <p className="font-medium">{format(new Date(selectedLog.created_at), 'PPpp')}</p>
                </div>
              </div>

              {selectedLog.error_message && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-md">
                  <p className="text-sm font-medium text-destructive">Error Message</p>
                  <p className="text-sm mt-1">{selectedLog.error_message}</p>
                </div>
              )}

              {selectedLog.payload && (
                <div>
                  <p className="text-sm font-medium mb-2">Payload</p>
                  <ScrollArea className="h-[200px] rounded-md border bg-muted p-3">
                    <pre className="text-xs whitespace-pre-wrap">
                      {JSON.stringify(selectedLog.payload, null, 2)}
                    </pre>
                  </ScrollArea>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
