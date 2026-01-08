import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, History } from 'lucide-react';
import { format } from 'date-fns';

interface AuditLogEntry {
  id: string;
  admin_id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  details: Record<string, any>;
  ip_address: string | null;
  created_at: string;
}

interface Profile {
  id: string;
  email: string;
  full_name: string | null;
}

interface AuditLogTabProps {
  profiles: Profile[];
}

export function AuditLogTab({ profiles }: AuditLogTabProps) {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['super-admin-audit-log'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('super_admin_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as AuditLogEntry[];
    },
  });

  const getAdminName = (adminId: string) => {
    const profile = profiles.find(p => p.id === adminId);
    return profile?.full_name || profile?.email || 'Unknown';
  };

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'password_reset':
        return <Badge variant="secondary">Password Reset</Badge>;
      case 'mfa_reset':
        return <Badge variant="destructive">MFA Reset</Badge>;
      case 'manual_onboarding':
        return <Badge className="bg-green-500">Onboarding</Badge>;
      case 'role_change':
        return <Badge variant="outline">Role Change</Badge>;
      case 'subscription_update':
        return <Badge variant="secondary">Subscription</Badge>;
      default:
        return <Badge variant="outline">{action}</Badge>;
    }
  };

  const formatDetails = (details: Record<string, any>) => {
    if (!details || Object.keys(details).length === 0) return '-';
    return Object.entries(details)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Super Admin Activity Log
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map(log => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap">
                    {format(new Date(log.created_at), 'MMM d, HH:mm')}
                  </TableCell>
                  <TableCell className="font-medium">
                    {getAdminName(log.admin_id)}
                  </TableCell>
                  <TableCell>{getActionBadge(log.action)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{log.target_type}</Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                    {formatDetails(log.details)}
                  </TableCell>
                </TableRow>
              ))}
              {logs.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No activity logged yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
