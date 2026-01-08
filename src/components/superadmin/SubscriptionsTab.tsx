import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Edit, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format, addMonths, addDays } from 'date-fns';

interface SubscriptionPlan {
  id: string;
  name: string;
  display_name: string;
  price_monthly: number;
  price_yearly?: number;
  max_users?: number | null;
  max_jobs_per_month?: number | null;
  features?: Record<string, boolean>;
  is_active?: boolean;
}

interface Company {
  id: string;
  name: string;
}

interface CompanySubscription {
  id: string;
  company_id: string;
  plan_id: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  trial_ends_at: string | null;
  created_at: string;
  subscription_plans?: SubscriptionPlan;
  companies?: { name: string };
}

interface SubscriptionsTabProps {
  companies: Company[];
}

export function SubscriptionsTab({ companies }: SubscriptionsTabProps) {
  const queryClient = useQueryClient();
  const [manageDialogOpen, setManageDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState<CompanySubscription | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('active');
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [trialDays, setTrialDays] = useState('14');

  // Fetch subscriptions
  const { data: subscriptions = [], isLoading } = useQuery({
    queryKey: ['all-subscriptions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_subscriptions')
        .select(`
          *,
          subscription_plans (id, name, display_name, price_monthly),
          companies (name)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as CompanySubscription[];
    },
  });

  // Fetch plans
  const { data: plans = [] } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .order('price_monthly');
      if (error) throw error;
      return data as SubscriptionPlan[];
    },
  });

  // Create subscription mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      const now = new Date();
      const periodEnd = addMonths(now, 1);
      const trialEnd = parseInt(trialDays) > 0 ? addDays(now, parseInt(trialDays)) : null;

      const { error } = await supabase
        .from('company_subscriptions')
        .insert({
          company_id: selectedCompanyId,
          plan_id: selectedPlanId,
          status: trialEnd ? 'trialing' : 'active',
          current_period_start: now.toISOString(),
          current_period_end: periodEnd.toISOString(),
          trial_ends_at: trialEnd?.toISOString() || null,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-subscriptions'] });
      toast.success('Subscription created');
      setCreateDialogOpen(false);
      setSelectedCompanyId('');
      setSelectedPlanId('');
      setTrialDays('14');
    },
    onError: (error: any) => {
      toast.error('Failed: ' + error.message);
    },
  });

  // Update subscription mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedSubscription) return;
      
      const updates: any = {
        plan_id: selectedPlanId,
        status: selectedStatus,
        updated_at: new Date().toISOString(),
      };

      // If changing to active, extend period
      if (selectedStatus === 'active' && selectedSubscription.status !== 'active') {
        updates.current_period_start = new Date().toISOString();
        updates.current_period_end = addMonths(new Date(), 1).toISOString();
      }

      const { error } = await supabase
        .from('company_subscriptions')
        .update(updates)
        .eq('id', selectedSubscription.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-subscriptions'] });
      toast.success('Subscription updated');
      setManageDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error('Failed: ' + error.message);
    },
  });

  const handleManage = (sub: CompanySubscription) => {
    setSelectedSubscription(sub);
    setSelectedPlanId(sub.plan_id);
    setSelectedStatus(sub.status);
    setManageDialogOpen(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500">Active</Badge>;
      case 'trialing':
        return <Badge variant="secondary">Trial</Badge>;
      case 'past_due':
        return <Badge variant="destructive">Past Due</Badge>;
      case 'cancelled':
        return <Badge variant="outline">Cancelled</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  // Companies without subscriptions
  const companiesWithoutSub = companies.filter(c => 
    !subscriptions.some(s => s.company_id === c.id)
  );

  return (
    <div className="space-y-6">
      {/* Plans Overview */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Subscription Plans</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {plans.filter(p => p.is_active !== false).map(plan => (
              <Card key={plan.id} className="border-2">
                <CardContent className="pt-4">
                  <h3 className="font-bold text-lg">{plan.display_name}</h3>
                  <p className="text-2xl font-bold mt-2">
                    ${plan.price_monthly}<span className="text-sm font-normal text-muted-foreground">/mo</span>
                  </p>
                  <div className="mt-3 text-sm text-muted-foreground space-y-1">
                    <p>Users: {plan.max_users ?? 'Unlimited'}</p>
                    <p>Jobs: {plan.max_jobs_per_month ?? 'Unlimited'}/mo</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* All Subscriptions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Company Subscriptions</CardTitle>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="w-4 h-4" />
                Add Subscription
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Subscription</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Company</Label>
                  <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select company" />
                    </SelectTrigger>
                    <SelectContent>
                      {companiesWithoutSub.map(company => (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {companiesWithoutSub.length === 0 && (
                    <p className="text-sm text-muted-foreground">All companies have subscriptions</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Plan</Label>
                  <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select plan" />
                    </SelectTrigger>
                    <SelectContent>
                      {plans.filter(p => p.is_active !== false).map(plan => (
                        <SelectItem key={plan.id} value={plan.id}>
                          {plan.display_name} (${plan.price_monthly}/mo)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Trial Days (0 for no trial)</Label>
                  <Input
                    type="number"
                    value={trialDays}
                    onChange={(e) => setTrialDays(e.target.value)}
                    min={0}
                    max={90}
                  />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setCreateDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button 
                    className="flex-1" 
                    onClick={() => createMutation.mutate()}
                    disabled={createMutation.isPending || !selectedCompanyId || !selectedPlanId}
                  >
                    {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Create
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
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
                  <TableHead>Company</TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Period End</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead className="w-24">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subscriptions.map(sub => (
                  <TableRow key={sub.id}>
                    <TableCell className="font-medium">
                      {sub.companies?.name || 'Unknown'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {sub.subscription_plans?.display_name || 'Unknown'}
                      </Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(sub.status)}</TableCell>
                    <TableCell>
                      {sub.current_period_end 
                        ? format(new Date(sub.current_period_end), 'MMM d, yyyy')
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {format(new Date(sub.created_at), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleManage(sub)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {subscriptions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No subscriptions found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Manage Subscription Dialog */}
      <Dialog open={manageDialogOpen} onOpenChange={setManageDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Manage Subscription</DialogTitle>
          </DialogHeader>
          {selectedSubscription && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Company</p>
                <p className="font-medium">{selectedSubscription.companies?.name}</p>
              </div>
              <div className="space-y-2">
                <Label>Plan</Label>
                <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {plans.filter(p => p.is_active !== false).map(plan => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.display_name} (${plan.price_monthly}/mo)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="trialing">Trialing</SelectItem>
                    <SelectItem value="past_due">Past Due</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setManageDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  className="flex-1" 
                  onClick={() => updateMutation.mutate()}
                  disabled={updateMutation.isPending}
                >
                  {updateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Update
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
