import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
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
  Square
} from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { useWebhookLogs, useWebhookStats, WebhookLog } from '@/hooks/useWebhookLogs';
import { supabase } from '@/integrations/supabase/client';

const SUPABASE_PROJECT_ID = 'emscfiinctuysscrarlg';
const STRIPE_WEBHOOK_URL = `https://${SUPABASE_PROJECT_ID}.supabase.co/functions/v1/stripe-webhook`;

const STRIPE_EVENT_TYPES = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'payment_intent.payment_failed',
  'invoice.payment_failed',
];

export function WebhooksTab() {
  const queryClient = useQueryClient();
  const [providerFilter, setProviderFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState('stripe');
  const [selectedEventType, setSelectedEventType] = useState('checkout.session.completed');
  const [isTesting, setIsTesting] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<WebhookLog | null>(null);

  const { data: logs = [], isLoading: logsLoading, refetch } = useWebhookLogs({
    provider: providerFilter !== 'all' ? providerFilter : undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    limit: 100,
  });

  const { data: stats } = useWebhookStats();

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

  const getProviderIcon = (provider: string) => {
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
        {/* Stripe Card */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary" />
                <CardTitle className="text-lg">Stripe</CardTitle>
              </div>
              <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Connected</Badge>
            </div>
            <CardDescription>Payment processing webhooks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Webhook URL</p>
              <div className="flex items-center gap-2">
                <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate">
                  {STRIPE_WEBHOOK_URL}
                </code>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-7 w-7 shrink-0"
                  onClick={() => copyToClipboard(STRIPE_WEBHOOK_URL)}
                >
                  <Copy className="w-3 h-3" />
                </Button>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Events (24h)</span>
              <span className="font-medium">{stats?.byProvider?.stripe || 0}</span>
            </div>
            {stats?.lastEventAt && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Last Event</span>
                <span className="text-xs">{formatDistanceToNow(new Date(stats.lastEventAt), { addSuffix: true })}</span>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1"
                onClick={() => {
                  setSelectedProvider('stripe');
                  setTestDialogOpen(true);
                }}
              >
                <Play className="w-3 h-3 mr-1" />
                Test
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1"
                asChild
              >
                <a 
                  href="https://dashboard.stripe.com/webhooks" 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="w-3 h-3 mr-1" />
                  Dashboard
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* PayPal Card (Coming Soon) */}
        <Card className="opacity-60">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Wallet className="w-5 h-5" />
                <CardTitle className="text-lg">PayPal</CardTitle>
              </div>
              <Badge variant="secondary">Coming Soon</Badge>
            </div>
            <CardDescription>PayPal payment webhooks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              PayPal integration will allow your customers to pay with their PayPal accounts.
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
              asChild
            >
              <a 
                href="https://developer.paypal.com/docs/api/webhooks/v1/" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                View Docs
              </a>
            </Button>
          </CardContent>
        </Card>

        {/* Square Card (Coming Soon) */}
        <Card className="opacity-60">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Square className="w-5 h-5" />
                <CardTitle className="text-lg">Square</CardTitle>
              </div>
              <Badge variant="secondary">Coming Soon</Badge>
            </div>
            <CardDescription>Square payment webhooks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Square integration for companies that prefer Square's payment processing.
            </p>
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full"
              asChild
            >
              <a 
                href="https://developer.squareup.com/docs/webhooks/overview" 
                target="_blank" 
                rel="noopener noreferrer"
              >
                <ExternalLink className="w-3 h-3 mr-1" />
                View Docs
              </a>
            </Button>
          </CardContent>
        </Card>
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
                    <TableHead className="w-[60px]"></TableHead>
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
                          {getProviderIcon(log.provider)}
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
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7"
                          onClick={() => handleViewDetails(log)}
                        >
                          <Eye className="w-3 h-3" />
                        </Button>
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
