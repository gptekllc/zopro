import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, MessageSquare, AlertTriangle, Power, Search, Eye, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useAllSmsLogs, useAllSmsUsage, SmsLog } from '@/hooks/useSmsLogs';

const statusColors: Record<string, string> = {
  sent: 'bg-green-100 text-green-800 border-green-200',
  failed: 'bg-red-100 text-red-800 border-red-200',
  blocked: 'bg-amber-100 text-amber-800 border-amber-200',
};

export function SmsTab() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [selectedLog, setSelectedLog] = useState<SmsLog | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Fetch global SMS setting
  const { data: globalSetting, isLoading: loadingGlobal } = useQuery({
    queryKey: ['sms-global-setting'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'sms_global_enabled')
        .single();
      if (error) throw error;
      return data?.value === true || data?.value === 'true';
    },
  });

  // Fetch all companies with SMS settings
  const { data: companySmsData = [], isLoading: loadingCompanies } = useQuery({
    queryKey: ['all-company-sms-settings'],
    queryFn: async () => {
      const { data: companies, error: compError } = await supabase
        .from('companies')
        .select('id, name')
        .order('name');
      if (compError) throw compError;

      const { data: smsSettings, error: smsError } = await supabase
        .from('company_sms_settings')
        .select('*');
      if (smsError) throw smsError;

      const { data: subscriptions, error: subError } = await supabase
        .from('company_subscriptions')
        .select(`
          company_id,
          subscription_plans (
            name,
            sms_enabled,
            sms_monthly_limit
          )
        `)
        .in('status', ['active', 'trialing']);
      if (subError) throw subError;

      const { data: usageData, error: usageError } = await supabase
        .from('sms_usage')
        .select('*')
        .gte('period_start', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
      if (usageError) throw usageError;

      return companies.map(company => {
        const settings = smsSettings?.find(s => s.company_id === company.id);
        const sub = subscriptions?.find(s => s.company_id === company.id);
        const plan = sub?.subscription_plans as any;
        const usage = usageData?.find(u => u.company_id === company.id);

        return {
          id: company.id,
          name: company.name,
          sms_enabled: settings?.sms_enabled ?? false,
          plan_name: plan?.name || 'None',
          plan_sms_enabled: plan?.sms_enabled ?? false,
          messages_sent: usage?.messages_sent ?? 0,
          messages_limit: plan?.sms_monthly_limit,
        };
      });
    },
  });

  // Fetch SMS logs
  const { data: logs = [], isLoading: loadingLogs } = useAllSmsLogs({
    limit: 100,
    status: statusFilter !== 'all' ? statusFilter as any : undefined,
  });

  // Toggle global SMS
  const toggleGlobalSms = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase
        .from('app_settings')
        .upsert({ key: 'sms_global_enabled', value: enabled, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: (_, enabled) => {
      queryClient.invalidateQueries({ queryKey: ['sms-global-setting'] });
      toast.success(enabled ? 'SMS globally enabled' : 'SMS globally disabled (kill switch activated)');
    },
    onError: (error: any) => {
      toast.error('Failed to update: ' + error.message);
    },
  });

  // Toggle company SMS
  const toggleCompanySms = useMutation({
    mutationFn: async ({ companyId, enabled }: { companyId: string; enabled: boolean }) => {
      const { data: existing } = await supabase
        .from('company_sms_settings')
        .select('id')
        .eq('company_id', companyId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('company_sms_settings')
          .update({ sms_enabled: enabled, updated_at: new Date().toISOString() })
          .eq('company_id', companyId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('company_sms_settings')
          .insert({ company_id: companyId, sms_enabled: enabled });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-company-sms-settings'] });
      toast.success('Company SMS settings updated');
    },
    onError: (error: any) => {
      toast.error('Failed to update: ' + error.message);
    },
  });

  const filteredCompanies = companySmsData.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  // Calculate totals
  const totalSent = companySmsData.reduce((sum, c) => sum + c.messages_sent, 0);
  const companiesWithSms = companySmsData.filter(c => c.sms_enabled).length;

  return (
    <div className="space-y-6">
      {/* Global Kill Switch */}
      <Card className={!globalSetting ? 'border-red-300 bg-red-50' : ''}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Power className={`w-5 h-5 ${globalSetting ? 'text-green-600' : 'text-red-600'}`} />
              <CardTitle>Global SMS Control</CardTitle>
            </div>
            <div className="flex items-center gap-2">
              <Label htmlFor="global-sms" className="text-sm">
                {globalSetting ? 'Active' : 'Disabled'}
              </Label>
              <Switch
                id="global-sms"
                checked={globalSetting ?? true}
                onCheckedChange={(checked) => toggleGlobalSms.mutate(checked)}
                disabled={loadingGlobal || toggleGlobalSms.isPending}
              />
            </div>
          </div>
          <CardDescription>
            Emergency kill switch to disable all SMS sending platform-wide
          </CardDescription>
        </CardHeader>
        {!globalSetting && (
          <CardContent>
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>SMS is currently disabled platform-wide.</strong> No companies can send SMS messages until this is re-enabled.
              </AlertDescription>
            </Alert>
          </CardContent>
        )}
      </Card>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total SMS This Month</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totalSent}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Companies with SMS Enabled</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{companiesWithSms} / {companySmsData.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Recent Failures</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-red-600">
              {logs.filter(l => l.status === 'failed').length}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Company SMS Settings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              <CardTitle>Company SMS Settings</CardTitle>
            </div>
            <div className="relative w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search companies..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loadingCompanies ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead>Plan SMS</TableHead>
                    <TableHead>Company SMS</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead>Toggle</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCompanies.map((company) => (
                    <TableRow key={company.id}>
                      <TableCell className="font-medium">{company.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{company.plan_name}</Badge>
                      </TableCell>
                      <TableCell>
                        {company.plan_sms_enabled ? (
                          <Badge className="bg-green-100 text-green-800">Allowed</Badge>
                        ) : (
                          <Badge variant="secondary">Not in plan</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {company.sms_enabled ? (
                          <Badge className="bg-green-100 text-green-800">Enabled</Badge>
                        ) : (
                          <Badge variant="secondary">Disabled</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {company.messages_sent} / {company.messages_limit === null ? '∞' : company.messages_limit}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={company.sms_enabled}
                          onCheckedChange={(checked) => toggleCompanySms.mutate({ companyId: company.id, enabled: checked })}
                          disabled={!company.plan_sms_enabled || toggleCompanySms.isPending}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent SMS Logs */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              <CardTitle>Recent SMS Logs</CardTitle>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Filter status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loadingLogs ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No SMS logs found
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Error</TableHead>
                    <TableHead className="text-right">View</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.slice(0, 50).map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(log.created_at), 'MMM d, h:mm a')}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{log.message_type}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {log.recipient_phone}
                      </TableCell>
                      <TableCell>
                        <Badge className={statusColors[log.status]}>
                          {log.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm">
                        {log.error_message || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => setSelectedLog(log)}>
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

      {/* Log Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>SMS Log Details</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <span className="text-muted-foreground">Date</span>
                  <p className="font-medium">{format(new Date(selectedLog.created_at), 'PPpp')}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Status</span>
                  <p><Badge className={statusColors[selectedLog.status]}>{selectedLog.status}</Badge></p>
                </div>
                <div>
                  <span className="text-muted-foreground">Phone</span>
                  <p className="font-mono">{selectedLog.recipient_phone}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Type</span>
                  <p className="font-medium">{selectedLog.message_type}</p>
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Message</span>
                <div className="mt-1 p-3 bg-muted rounded-md">{selectedLog.message_body}</div>
              </div>
              {selectedLog.error_message && (
                <div>
                  <span className="text-muted-foreground">Error</span>
                  <div className="mt-1 p-3 bg-red-50 border border-red-200 rounded-md text-red-700">
                    <p className="font-medium">{selectedLog.error_code}</p>
                    <p>{selectedLog.error_message}</p>
                  </div>
                </div>
              )}
              {selectedLog.twilio_sid && (
                <div>
                  <span className="text-muted-foreground">Twilio SID</span>
                  <p className="font-mono">{selectedLog.twilio_sid}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
