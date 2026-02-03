import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Edit, Loader2, DollarSign, Users, Briefcase, HardDrive, Check, X, Percent, Calendar, ExternalLink, CreditCard, AlertCircle, CheckCircle2, RefreshCw, CalendarIcon } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { toast } from 'sonner';
import { format, addMonths, addDays } from 'date-fns';
import { formatBytes } from '@/hooks/useStorageUsage';

interface SubscriptionPlan {
  id: string;
  name: string;
  display_name: string;
  price_monthly: number;
  price_yearly: number;
  max_users: number | null;
  max_jobs_per_month: number | null;
  max_photos_per_document: number | null;
  storage_limit_bytes: number | null;
  storage_addon_price_per_gb: number | null;
  features: Record<string, boolean>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  stripe_product_id: string | null;
  stripe_price_id_monthly: string | null;
  stripe_price_id_yearly: string | null;
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
  subscription_plans?: Partial<SubscriptionPlan>;
  companies?: { name: string };
}

interface SubscriptionsTabProps {
  companies: Company[];
}

const AVAILABLE_FEATURES = [
  { key: 'jobs', label: 'Jobs' },
  { key: 'quotes', label: 'Quotes' },
  { key: 'invoices', label: 'Invoices' },
  { key: 'basic_invoicing', label: 'Basic Invoicing' },
  { key: 'customer_portal', label: 'Customer Portal' },
  { key: 'team_members', label: 'Team Members' },
  { key: 'reports', label: 'Reports' },
  { key: 'signatures', label: 'Signatures' },
  { key: 'photo_uploads', label: 'Photo Uploads' },
  { key: 'stripe_payments', label: 'Stripe Payments' },
  { key: 'email_templates', label: 'Email Templates' },
  { key: 'scheduling', label: 'Scheduling' },
  { key: 'time_clock', label: 'Time Clock' },
  { key: 'api_access', label: 'API Access' },
  { key: 'white_label', label: 'White Label' },
  { key: 'priority_support', label: 'Priority Support' },
];

export function SubscriptionsTab({ companies }: SubscriptionsTabProps) {
  const queryClient = useQueryClient();
  const [manageDialogOpen, setManageDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editPlanDialogOpen, setEditPlanDialogOpen] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState<CompanySubscription | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('active');
  const [selectedCompanyId, setSelectedCompanyId] = useState('');
  const [trialDays, setTrialDays] = useState('14');
  const [pricingView, setPricingView] = useState<'monthly' | 'yearly'>('monthly');
  const [isSyncingStripe, setIsSyncingStripe] = useState(false);
  const [selectedPeriodEnd, setSelectedPeriodEnd] = useState<Date | undefined>(undefined);
  const [selectedBillingInterval, setSelectedBillingInterval] = useState<'monthly' | 'yearly'>('monthly');
  
  // Track original prices to detect changes
  const [originalPrices, setOriginalPrices] = useState<{
    monthly: number;
    yearly: number;
  } | null>(null);

  // Plan edit form state
  const [editForm, setEditForm] = useState({
    display_name: '',
    price_monthly: 0,
    price_yearly: 0,
    max_users: null as number | null,
    max_jobs_per_month: null as number | null,
    max_photos_per_document: null as number | null,
    storage_limit_gb: 0,
    storage_addon_price_per_gb: null as number | null,
    features: {} as Record<string, boolean>,
    is_active: true,
    stripe_product_id: '',
    stripe_price_id_monthly: '',
    stripe_price_id_yearly: '',
  });

  // Fetch subscriptions
  const { data: subscriptions = [], isLoading } = useQuery({
    queryKey: ['all-subscriptions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_subscriptions')
        .select(`
          *,
          subscription_plans (id, name, display_name, price_monthly, price_yearly),
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

  // Update plan mutation with Stripe sync
  const updatePlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      // Treat "GB" as decimal gigabytes (1 GB = 1000 MB) so 0.250 GB displays as 250 MB.
      const storageBytes = Math.round(editForm.storage_limit_gb * 1000 * 1000 * 1000);
      
      let finalMonthlyPriceId = editForm.stripe_price_id_monthly || null;
      let finalYearlyPriceId = editForm.stripe_price_id_yearly || null;
      
      // Check if prices changed and we have a Stripe product ID
      const pricesChanged = originalPrices && (
        originalPrices.monthly !== editForm.price_monthly ||
        originalPrices.yearly !== editForm.price_yearly
      );
      
      if (pricesChanged && editForm.stripe_product_id) {
        setIsSyncingStripe(true);
        try {
          // Determine which prices changed
          const monthlyChanged = originalPrices.monthly !== editForm.price_monthly;
          const yearlyChanged = originalPrices.yearly !== editForm.price_yearly;
          
          const { data, error } = await supabase.functions.invoke('update-stripe-plan-price', {
            body: {
              stripe_product_id: editForm.stripe_product_id,
              new_price_monthly: monthlyChanged ? editForm.price_monthly : undefined,
              new_price_yearly: yearlyChanged ? editForm.price_yearly : undefined,
              old_price_id_monthly: monthlyChanged ? editForm.stripe_price_id_monthly : undefined,
              old_price_id_yearly: yearlyChanged ? editForm.stripe_price_id_yearly : undefined,
            },
          });
          
          if (error) throw error;
          if (data?.error) throw new Error(data.error);
          
          // Update price IDs with new ones from Stripe
          if (data?.new_price_id_monthly) {
            finalMonthlyPriceId = data.new_price_id_monthly;
          }
          if (data?.new_price_id_yearly) {
            finalYearlyPriceId = data.new_price_id_yearly;
          }
          
          toast.success('Stripe prices synced successfully');
        } catch (stripeError: any) {
          toast.error('Failed to sync with Stripe: ' + stripeError.message);
          throw stripeError;
        } finally {
          setIsSyncingStripe(false);
        }
      }
      
      const { error } = await supabase
        .from('subscription_plans')
        .update({
          display_name: editForm.display_name,
          price_monthly: editForm.price_monthly,
          price_yearly: editForm.price_yearly,
          max_users: editForm.max_users,
          max_jobs_per_month: editForm.max_jobs_per_month,
          max_photos_per_document: editForm.max_photos_per_document,
          storage_limit_bytes: storageBytes,
          storage_addon_price_per_gb: editForm.storage_addon_price_per_gb,
          features: editForm.features,
          is_active: editForm.is_active,
          stripe_product_id: editForm.stripe_product_id || null,
          stripe_price_id_monthly: finalMonthlyPriceId,
          stripe_price_id_yearly: finalYearlyPriceId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', planId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subscription-plans'] });
      queryClient.invalidateQueries({ queryKey: ['all-subscriptions'] });
      toast.success('Plan updated successfully');
      setEditPlanDialogOpen(false);
      setOriginalPrices(null);
    },
    onError: (error: any) => {
      toast.error('Failed to update plan: ' + error.message);
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

      // Always update period end if set
      if (selectedPeriodEnd) {
        updates.current_period_end = selectedPeriodEnd.toISOString();
      }

      // If transitioning to active, set period start and calculate period end based on billing interval
      if (selectedStatus === 'active' && selectedSubscription.status !== 'active') {
        updates.current_period_start = new Date().toISOString();
        // Only set period end from interval if not manually overridden
        if (!selectedPeriodEnd) {
          updates.current_period_end = selectedBillingInterval === 'yearly' 
            ? addMonths(new Date(), 12).toISOString()
            : addMonths(new Date(), 1).toISOString();
        }
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

  const handleEditPlan = (plan: SubscriptionPlan) => {
    setSelectedPlan(plan);
    setEditForm({
      display_name: plan.display_name,
      price_monthly: plan.price_monthly,
      price_yearly: plan.price_yearly || 0,
      max_users: plan.max_users,
      max_jobs_per_month: plan.max_jobs_per_month,
      max_photos_per_document: plan.max_photos_per_document,
      storage_limit_gb: (plan.storage_limit_bytes || 0) / (1024 * 1024 * 1024),
      storage_addon_price_per_gb: plan.storage_addon_price_per_gb,
      features: plan.features || {},
      is_active: plan.is_active !== false,
      stripe_product_id: plan.stripe_product_id || '',
      stripe_price_id_monthly: plan.stripe_price_id_monthly || '',
      stripe_price_id_yearly: plan.stripe_price_id_yearly || '',
    });
    // Track original prices for change detection
    setOriginalPrices({
      monthly: plan.price_monthly,
      yearly: plan.price_yearly || 0,
    });
    setEditPlanDialogOpen(true);
  };
  
  // Check if prices have changed from original
  const pricesHaveChanged = originalPrices && editForm.stripe_product_id && (
    originalPrices.monthly !== editForm.price_monthly ||
    originalPrices.yearly !== editForm.price_yearly
  );

  const handleManage = (sub: CompanySubscription) => {
    setSelectedSubscription(sub);
    setSelectedPlanId(sub.plan_id);
    setSelectedStatus(sub.status);
    setSelectedPeriodEnd(sub.current_period_end ? new Date(sub.current_period_end) : undefined);
    setSelectedBillingInterval('monthly');
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

  const calculateYearlyDiscount = (monthly: number, yearly: number) => {
    if (!monthly || !yearly) return 0;
    const fullYearlyPrice = monthly * 12;
    return Math.round(((fullYearlyPrice - yearly) / fullYearlyPrice) * 100);
  };

  const companiesWithoutSub = companies.filter(c => 
    !subscriptions.some(s => s.company_id === c.id)
  );

  return (
    <div className="space-y-6">
      {/* Plans Overview with Edit Capability */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Subscription Plans
              </CardTitle>
              <CardDescription>
                Configure pricing, limits, and features for each plan
              </CardDescription>
            </div>
            <Tabs value={pricingView} onValueChange={(v) => setPricingView(v as 'monthly' | 'yearly')}>
              <TabsList>
                <TabsTrigger value="monthly">Monthly</TabsTrigger>
                <TabsTrigger value="yearly">Yearly</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {plans.map(plan => {
              const discount = calculateYearlyDiscount(plan.price_monthly, plan.price_yearly);
              const displayPrice = pricingView === 'monthly' 
                ? plan.price_monthly 
                : Math.round(plan.price_yearly / 12);
              
              return (
                <Card 
                  key={plan.id} 
                  className={`border-2 relative ${!plan.is_active ? 'opacity-50' : ''}`}
                >
                  {!plan.is_active && (
                    <Badge variant="destructive" className="absolute top-2 right-2">
                      Inactive
                    </Badge>
                  )}
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <h3 className="font-bold text-lg">{plan.display_name}</h3>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEditPlan(plan)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                    
                    <div className="mt-2">
                      <p className="text-2xl font-bold">
                        ${displayPrice}
                        <span className="text-sm font-normal text-muted-foreground">/mo</span>
                      </p>
                      {pricingView === 'yearly' && discount > 0 && (
                        <Badge variant="secondary" className="mt-1">
                          <Percent className="w-3 h-3 mr-1" />
                          {discount}% off yearly
                        </Badge>
                      )}
                      {pricingView === 'yearly' && (
                        <p className="text-xs text-muted-foreground mt-1">
                          ${plan.price_yearly}/year billed annually
                        </p>
                      )}
                    </div>
                    
                    <div className="mt-4 space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span>{plan.max_users ?? 'Unlimited'} users</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Briefcase className="w-4 h-4 text-muted-foreground" />
                        <span>{plan.max_jobs_per_month ?? 'Unlimited'} jobs/mo</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
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

      {/* Edit Plan Dialog */}
      <Dialog open={editPlanDialogOpen} onOpenChange={setEditPlanDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="w-5 h-5" />
              Edit Plan: {selectedPlan?.display_name}
            </DialogTitle>
            <DialogDescription>
              Changes will apply to all companies on this plan after publishing
            </DialogDescription>
          </DialogHeader>

          {selectedPlan && (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Display Name</Label>
                  <Input
                    value={editForm.display_name}
                    onChange={(e) => setEditForm({ ...editForm, display_name: e.target.value })}
                  />
                </div>
                <div className="flex items-center gap-3 pt-6">
                  <Switch
                    checked={editForm.is_active}
                    onCheckedChange={(checked) => setEditForm({ ...editForm, is_active: checked })}
                  />
                  <Label>Plan is active</Label>
                </div>
              </div>

              {/* Pricing */}
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Pricing
                </h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Monthly Price ($)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={editForm.price_monthly}
                      onChange={(e) => setEditForm({ ...editForm, price_monthly: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Yearly Price ($)</Label>
                    <Input
                      type="number"
                      min={0}
                      value={editForm.price_yearly}
                      onChange={(e) => setEditForm({ ...editForm, price_yearly: parseFloat(e.target.value) || 0 })}
                    />
                    {editForm.price_monthly > 0 && editForm.price_yearly > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {calculateYearlyDiscount(editForm.price_monthly, editForm.price_yearly)}% discount vs monthly
                      </p>
                    )}
                  </div>
                </div>
                {editForm.price_monthly > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2"
                    onClick={() => {
                      const yearlyWithDiscount = Math.round(editForm.price_monthly * 12 * 0.8);
                      setEditForm({ ...editForm, price_yearly: yearlyWithDiscount });
                    }}
                  >
                    <Percent className="w-3 h-3 mr-1" />
                    Set 20% yearly discount
                  </Button>
                )}
                
                {/* Stripe sync warning */}
                {pricesHaveChanged && (
                  <Alert className="mt-3 border-amber-500/50 bg-amber-500/10">
                    <RefreshCw className="h-4 w-4 text-amber-500" />
                    <AlertDescription className="text-sm text-amber-700 dark:text-amber-400">
                      Price changes will automatically create new prices in Stripe and archive the old ones.
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Stripe Configuration */}
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <CreditCard className="w-4 h-4" />
                  Stripe Configuration
                  <a 
                    href="https://dashboard.stripe.com/products" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-foreground ml-auto flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Open Stripe
                  </a>
                </h4>
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label>Stripe Product ID</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="prod_..."
                        value={editForm.stripe_product_id}
                        onChange={(e) => setEditForm({ ...editForm, stripe_product_id: e.target.value })}
                      />
                      {editForm.stripe_product_id ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                      ) : (
                        <AlertCircle className="w-5 h-5 text-yellow-500 shrink-0" />
                      )}
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Monthly Price ID</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="price_..."
                          value={editForm.stripe_price_id_monthly}
                          onChange={(e) => setEditForm({ ...editForm, stripe_price_id_monthly: e.target.value })}
                        />
                        {editForm.stripe_price_id_monthly ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-yellow-500 shrink-0" />
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Yearly Price ID</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="price_..."
                          value={editForm.stripe_price_id_yearly}
                          onChange={(e) => setEditForm({ ...editForm, stripe_price_id_yearly: e.target.value })}
                        />
                        {editForm.stripe_price_id_yearly ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                        ) : (
                          <AlertCircle className="w-5 h-5 text-yellow-500 shrink-0" />
                        )}
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Configure Stripe price IDs to enable online checkout for this plan.
                  </p>
                </div>
              </div>

              {/* Limits */}
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Usage Limits
                </h4>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="space-y-2">
                    <Label>Max Users</Label>
                    <Input
                      type="number"
                      min={0}
                      placeholder="Unlimited"
                      value={editForm.max_users ?? ''}
                      onChange={(e) => setEditForm({ 
                        ...editForm, 
                        max_users: e.target.value ? parseInt(e.target.value) : null 
                      })}
                    />
                    <p className="text-xs text-muted-foreground">Leave empty for unlimited</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Jobs per Month</Label>
                    <Input
                      type="number"
                      min={0}
                      placeholder="Unlimited"
                      value={editForm.max_jobs_per_month ?? ''}
                      onChange={(e) => setEditForm({ 
                        ...editForm, 
                        max_jobs_per_month: e.target.value ? parseInt(e.target.value) : null 
                      })}
                    />
                    <p className="text-xs text-muted-foreground">Leave empty for unlimited</p>
                  </div>
                  <div className="space-y-2">
                    <Label>Photos per Document</Label>
                    <Input
                      type="number"
                      min={0}
                      placeholder="Unlimited"
                      value={editForm.max_photos_per_document ?? ''}
                      onChange={(e) => setEditForm({ 
                        ...editForm, 
                        max_photos_per_document: e.target.value ? parseInt(e.target.value) : null 
                      })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Storage (GB)</Label>
                    <Input
                      type="number"
                      min={0}
                      step={0.5}
                      value={editForm.storage_limit_gb}
                      onChange={(e) => setEditForm({ 
                        ...editForm, 
                        storage_limit_gb: parseFloat(e.target.value) || 0 
                      })}
                    />
                  </div>
                </div>
              </div>

              {/* Features */}
              <div>
                <h4 className="font-semibold mb-3 flex items-center gap-2">
                  <Check className="w-4 h-4" />
                  Included Features
                </h4>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {AVAILABLE_FEATURES.map(feature => (
                    <div key={feature.key} className="flex items-center gap-2">
                      <Switch
                        checked={editForm.features[feature.key] || false}
                        onCheckedChange={(checked) => setEditForm({
                          ...editForm,
                          features: { ...editForm.features, [feature.key]: checked }
                        })}
                      />
                      <Label className="font-normal">{feature.label}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setEditPlanDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={() => updatePlanMutation.mutate(selectedPlan.id)}
                  disabled={updatePlanMutation.isPending || isSyncingStripe}
                >
                  {(updatePlanMutation.isPending || isSyncingStripe) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {isSyncingStripe ? 'Syncing with Stripe...' : pricesHaveChanged ? 'Save & Sync to Stripe' : 'Save Changes'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

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
              
              {/* Billing Interval - show when changing to active */}
              {selectedStatus === 'active' && selectedSubscription.status !== 'active' && (
                <div className="space-y-2">
                  <Label>Billing Interval</Label>
                  <Select 
                    value={selectedBillingInterval} 
                    onValueChange={(v) => setSelectedBillingInterval(v as 'monthly' | 'yearly')}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="yearly">Yearly</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Period end will be set to {selectedBillingInterval === 'yearly' ? '12 months' : '1 month'} from now
                  </p>
                </div>
              )}
              
              {/* Period End Date */}
              <div className="space-y-2">
                <Label>Period End Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {selectedPeriodEnd ? format(selectedPeriodEnd, 'PPP') : 'Select date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={selectedPeriodEnd}
                      onSelect={setSelectedPeriodEnd}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <p className="text-xs text-muted-foreground">
                  Override the automatic period end calculation
                </p>
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
