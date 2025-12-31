import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Check, X, Loader2, UserPlus, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const COMPANY_ROLES = ['admin', 'manager', 'technician', 'customer'] as const;

const JoinRequestsManager = () => {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [selectedRole, setSelectedRole] = useState<string>('technician');

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['join-requests', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return [];
      const { data, error } = await (supabase as any)
        .from('join_requests')
        .select(`
          *,
          profiles:user_id(id, email, full_name)
        `)
        .eq('company_id', profile.company_id)
        .eq('status', 'pending')
        .order('requested_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.company_id,
  });

  const { data: company } = useQuery({
    queryKey: ['company', profile?.company_id],
    queryFn: async () => {
      if (!profile?.company_id) return null;
      const { data, error } = await (supabase as any)
        .from('companies')
        .select('*')
        .eq('id', profile.company_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.company_id,
  });

  const respondMutation = useMutation({
    mutationFn: async ({ requestId, status, role }: { requestId: string; status: 'approved' | 'rejected'; role?: string }) => {
      const request = requests.find((r: any) => r.id === requestId);
      if (!request) throw new Error('Request not found');

      // Update join request
      const { error: requestError } = await (supabase as any)
        .from('join_requests')
        .update({
          status,
          responded_at: new Date().toISOString(),
          responded_by: profile?.id,
          assigned_role: role || null,
        })
        .eq('id', requestId);

      if (requestError) throw requestError;

      if (status === 'approved' && role) {
        // Update user profile with company
        await (supabase as any)
          .from('profiles')
          .update({ company_id: profile?.company_id, role })
          .eq('id', request.user_id);

        // Add role to user_roles
        await (supabase as any)
          .from('user_roles')
          .insert({ user_id: request.user_id, role });

        // Create notification for user
        await (supabase as any)
          .from('notifications')
          .insert({
            user_id: request.user_id,
            type: 'join_approved',
            title: 'Request Approved!',
            message: `Your request to join ${company?.name} has been approved. You are now a ${role}.`,
            data: { companyId: profile?.company_id, role },
          });

        // Send email
        try {
          await supabase.functions.invoke('send-notification', {
            body: {
              type: 'join_request_approved',
              recipientEmail: request.profiles?.email,
              recipientName: request.profiles?.full_name,
              companyName: company?.name,
              assignedRole: role,
            },
          });
        } catch (e) { console.error('Email failed:', e); }
      } else if (status === 'rejected') {
        await (supabase as any)
          .from('notifications')
          .insert({
            user_id: request.user_id,
            type: 'join_rejected',
            title: 'Request Not Approved',
            message: `Your request to join ${company?.name} was not approved.`,
            data: { companyId: profile?.company_id },
          });

        try {
          await supabase.functions.invoke('send-notification', {
            body: {
              type: 'join_request_rejected',
              recipientEmail: request.profiles?.email,
              recipientName: request.profiles?.full_name,
              companyName: company?.name,
            },
          });
        } catch (e) { console.error('Email failed:', e); }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['join-requests'] });
      toast.success('Request processed successfully');
      setApproveDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error('Failed: ' + error.message);
    },
  });

  const handleApprove = (request: any) => {
    setSelectedRequest(request);
    setSelectedRole('technician');
    setApproveDialogOpen(true);
  };

  if (!profile?.company_id || (profile as any).role !== 'admin') {
    return null;
  }

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (requests.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Join Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-center py-4">No pending requests</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Join Requests
            <Badge variant="secondary">{requests.length}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {requests.map((request: any) => (
            <div key={request.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-medium">{request.profiles?.full_name || request.profiles?.email}</p>
                <p className="text-sm text-muted-foreground">{request.profiles?.email}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                  <Clock className="w-3 h-3" />
                  {format(new Date(request.requested_at), 'MMM d, yyyy')}
                </p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => respondMutation.mutate({ requestId: request.id, status: 'rejected' })}>
                  <X className="w-4 h-4" />
                </Button>
                <Button size="sm" onClick={() => handleApprove(request)}>
                  <Check className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={approveDialogOpen} onOpenChange={setApproveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve & Assign Role</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p>Approve <strong>{selectedRequest?.profiles?.full_name || selectedRequest?.profiles?.email}</strong> and assign them a role:</p>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={selectedRole} onValueChange={setSelectedRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMPANY_ROLES.map(role => (
                    <SelectItem key={role} value={role}>{role.charAt(0).toUpperCase() + role.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setApproveDialogOpen(false)}>Cancel</Button>
              <Button className="flex-1" onClick={() => respondMutation.mutate({ requestId: selectedRequest?.id, status: 'approved', role: selectedRole })} disabled={respondMutation.isPending}>
                {respondMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Approve
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default JoinRequestsManager;
