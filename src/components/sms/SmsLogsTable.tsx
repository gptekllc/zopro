import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, MessageSquare, Eye, Filter } from 'lucide-react';
import { useSmsLogs, SmsLog } from '@/hooks/useSmsLogs';
import { format } from 'date-fns';

const statusColors: Record<string, string> = {
  sent: 'bg-green-100 text-green-800 border-green-200',
  failed: 'bg-red-100 text-red-800 border-red-200',
  blocked: 'bg-amber-100 text-amber-800 border-amber-200',
};

const messageTypeLabels: Record<string, string> = {
  invoice: 'Invoice',
  portal_link: 'Portal Link',
  technician_eta: 'Tech ETA',
};

export function SmsLogsTable() {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [selectedLog, setSelectedLog] = useState<SmsLog | null>(null);

  const { data: logs = [], isLoading } = useSmsLogs({
    limit: 50,
    status: statusFilter !== 'all' ? statusFilter as any : undefined,
    messageType: typeFilter !== 'all' ? typeFilter as any : undefined,
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              <CardTitle>SMS History</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-muted-foreground" />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="sent">Sent</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                  <SelectItem value="blocked">Blocked</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="invoice">Invoice</SelectItem>
                  <SelectItem value="portal_link">Portal Link</SelectItem>
                  <SelectItem value="technician_eta">Tech ETA</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <CardDescription>
            View all SMS messages sent from your company
          </CardDescription>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No SMS messages yet</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Recipient</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(log.created_at), 'MMM d, h:mm a')}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {messageTypeLabels[log.message_type] || log.message_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {log.recipient_phone}
                      </TableCell>
                      <TableCell>
                        {log.customer?.name || '-'}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[log.status]}>
                          {log.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedLog(log)}
                        >
                          <Eye className="w-4 h-4" />
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

      {/* Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>SMS Details</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Date</span>
                  <p className="font-medium">
                    {format(new Date(selectedLog.created_at), 'PPpp')}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Status</span>
                  <p>
                    <Badge className={statusColors[selectedLog.status]}>
                      {selectedLog.status}
                    </Badge>
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Type</span>
                  <p className="font-medium">
                    {messageTypeLabels[selectedLog.message_type] || selectedLog.message_type}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Recipient</span>
                  <p className="font-mono">{selectedLog.recipient_phone}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Customer</span>
                  <p className="font-medium">{selectedLog.customer?.name || '-'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Sent By</span>
                  <p className="font-medium">
                    {selectedLog.sender?.full_name || selectedLog.sender?.email || '-'}
                  </p>
                </div>
              </div>

              <div>
                <span className="text-sm text-muted-foreground">Message</span>
                <div className="mt-1 p-3 bg-muted rounded-md text-sm">
                  {selectedLog.message_body}
                </div>
              </div>

              {selectedLog.twilio_sid && (
                <div>
                  <span className="text-sm text-muted-foreground">Twilio SID</span>
                  <p className="font-mono text-sm">{selectedLog.twilio_sid}</p>
                </div>
              )}

              {selectedLog.error_message && (
                <div>
                  <span className="text-sm text-muted-foreground">Error</span>
                  <div className="mt-1 p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
                    <p className="font-medium">{selectedLog.error_code}</p>
                    <p>{selectedLog.error_message}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
