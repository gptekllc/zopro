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
import { 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Eye,
  Mail,
  FileText,
  Briefcase,
  DollarSign,
  Send,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { useEmailLogs, useEmailStats, EmailLog } from '@/hooks/useEmailLogs';
import { supabase } from '@/integrations/supabase/client';

const EMAIL_TYPES = [
  'invoice',
  'quote',
  'job',
  'reminder',
  'payment_confirmation',
  'payment_failed',
  'signature_request',
  'notification',
  'report',
];

export function EmailLogsTab() {
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null);

  const { data: logs = [], isLoading: logsLoading, refetch } = useEmailLogs({
    emailType: typeFilter !== 'all' ? typeFilter : undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    limit: 100,
  });

  const { data: stats } = useEmailStats();

  // Real-time subscription for new email logs
  useEffect(() => {
    const channel = supabase
      .channel('email-logs-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'email_logs' },
        (payload) => {
          queryClient.invalidateQueries({ queryKey: ['email-logs'] });
          queryClient.invalidateQueries({ queryKey: ['email-stats'] });
          const newLog = payload.new as EmailLog;
          toast.info(`Email sent: ${newLog.subject}`, {
            description: `To: ${newLog.recipient_email}`,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const handleViewDetails = (log: EmailLog) => {
    setSelectedLog(log);
    setDetailsDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20"><Send className="w-3 h-3 mr-1" />Sent</Badge>;
      case 'delivered':
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20"><CheckCircle2 className="w-3 h-3 mr-1" />Delivered</Badge>;
      case 'failed':
        return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Failed</Badge>;
      case 'bounced':
        return <Badge variant="destructive"><AlertTriangle className="w-3 h-3 mr-1" />Bounced</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeIcon = (emailType: string) => {
    switch (emailType) {
      case 'invoice':
      case 'reminder':
        return <FileText className="w-4 h-4" />;
      case 'quote':
        return <FileText className="w-4 h-4" />;
      case 'job':
        return <Briefcase className="w-4 h-4" />;
      case 'payment_confirmation':
      case 'payment_failed':
        return <DollarSign className="w-4 h-4" />;
      default:
        return <Mail className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total (24h)</CardDescription>
            <CardTitle className="text-2xl">{stats?.total || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Sent</CardDescription>
            <CardTitle className="text-2xl text-blue-500">{stats?.sent || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Delivered</CardDescription>
            <CardTitle className="text-2xl text-green-500">{stats?.delivered || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Failed</CardDescription>
            <CardTitle className="text-2xl text-destructive">{(stats?.failed || 0) + (stats?.bounced || 0)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Email Logs Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle>Email Delivery Logs</CardTitle>
              <CardDescription>Track all sent emails and their delivery status</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {EMAIL_TYPES.map((type) => (
                    <SelectItem key={type} value={type} className="capitalize">
                      {type.replace('_', ' ')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[130px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="delivered">Delivered</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="bounced">Bounced</SelectItem>
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
              <Mail className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No email logs recorded yet</p>
              <p className="text-sm mt-1">Emails will appear here as they are sent</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead>Status</TableHead>
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
                          {getTypeIcon(log.email_type)}
                          <span className="capitalize text-sm">{log.email_type.replace('_', ' ')}</span>
                        </div>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm">
                        {log.recipient_email}
                      </TableCell>
                      <TableCell className="max-w-[250px] truncate text-sm">
                        {log.subject}
                      </TableCell>
                      <TableCell>{getStatusBadge(log.status)}</TableCell>
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

      {/* Email Details Dialog */}
      <Dialog open={detailsDialogOpen} onOpenChange={setDetailsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Email Details</DialogTitle>
            <DialogDescription>
              {selectedLog?.resend_id && `Resend ID: ${selectedLog.resend_id}`}
            </DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Type</span>
                  <p className="font-medium capitalize">{selectedLog.email_type.replace('_', ' ')}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Status</span>
                  <div className="mt-1">{getStatusBadge(selectedLog.status)}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Recipient</span>
                  <p className="font-medium">{selectedLog.recipient_email}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Sender</span>
                  <p className="font-medium">{selectedLog.sender_email}</p>
                </div>
                <div className="col-span-2">
                  <span className="text-muted-foreground">Subject</span>
                  <p className="font-medium">{selectedLog.subject}</p>
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

              {selectedLog.metadata && (
                <div>
                  <p className="text-sm font-medium mb-2">Metadata</p>
                  <ScrollArea className="h-[150px] rounded-md border bg-muted p-3">
                    <pre className="text-xs whitespace-pre-wrap">
                      {JSON.stringify(selectedLog.metadata, null, 2)}
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
