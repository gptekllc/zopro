import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Building2, Users, CreditCard, TrendingUp, AlertTriangle, Clock, Plus, Pencil, Check, Tag, Bug, Loader2 } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { useSoftwareVersions, useCurrentVersion, useCreateVersion, useUpdateVersion, useSetCurrentVersion, SoftwareVersion } from '@/hooks/useSoftwareVersion';

interface SubscriptionPlan {
  id: string;
  name: string;
  display_name: string;
  price_monthly: number;
}

interface CompanySubscription {
  id: string;
  company_id: string;
  plan_id: string;
  status: string;
  current_period_end: string | null;
  trial_ends_at: string | null;
  created_at: string;
  subscription_plans?: SubscriptionPlan;
  companies?: { name: string };
}

interface Company {
  id: string;
  name: string;
  created_at: string;
}

interface Profile {
  id: string;
  company_id: string | null;
  created_at: string;
}

interface OverviewTabProps {
  companies: Company[];
  profiles: Profile[];
}

export function OverviewTab({ companies, profiles }: OverviewTabProps) {
  const [versionDialogOpen, setVersionDialogOpen] = useState(false);
  const [editingVersion, setEditingVersion] = useState<SoftwareVersion | null>(null);
  const [versionForm, setVersionForm] = useState({
    version: '',
    title: '',
    features: '',
    bug_fixes: '',
    notes: '',
    is_current: false,
  });

  const { data: softwareVersions = [], isLoading: versionsLoading } = useSoftwareVersions();
  const { data: currentVersion } = useCurrentVersion();
  const createVersion = useCreateVersion();
  const updateVersion = useUpdateVersion();
  const setCurrentVersion = useSetCurrentVersion();

  // Fetch subscriptions with plan details
  const { data: subscriptions = [] } = useQuery({
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

  // Fetch subscription plans
  const { data: plans = [] } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('subscription_plans')
        .select('*')
        .eq('is_active', true)
        .order('price_monthly');
      if (error) throw error;
      return data as SubscriptionPlan[];
    },
  });

  // Calculate stats
  const totalCompanies = companies.length;
  const totalUsers = profiles.length;
  const activeSubscriptions = subscriptions.filter(s => s.status === 'active').length;
  const trialSubscriptions = subscriptions.filter(s => s.status === 'trialing').length;
  const pastDueSubscriptions = subscriptions.filter(s => s.status === 'past_due').length;
  
  // Calculate MRR
  const mrr = subscriptions
    .filter(s => s.status === 'active' && s.subscription_plans)
    .reduce((sum, s) => sum + (s.subscription_plans?.price_monthly || 0), 0);

  // Get companies expiring in 7 days
  const expiringCompanies = subscriptions.filter(s => {
    if (!s.current_period_end) return false;
    const daysUntilExpiry = differenceInDays(new Date(s.current_period_end), new Date());
    return daysUntilExpiry >= 0 && daysUntilExpiry <= 7;
  });

  // Recent signups (last 7 days)
  const recentSignups = companies.filter(c => {
    const daysSinceCreation = differenceInDays(new Date(), new Date(c.created_at));
    return daysSinceCreation <= 7;
  });

  // Companies without subscription
  const companiesWithoutSub = companies.filter(c => 
    !subscriptions.some(s => s.company_id === c.id)
  );

  const resetVersionForm = () => {
    setVersionForm({
      version: '',
      title: '',
      features: '',
      bug_fixes: '',
      notes: '',
      is_current: false,
    });
    setEditingVersion(null);
  };

  const handleEditVersion = (version: SoftwareVersion) => {
    setEditingVersion(version);
    setVersionForm({
      version: version.version,
      title: version.title || '',
      features: version.features?.join('\n') || '',
      bug_fixes: version.bug_fixes?.join('\n') || '',
      notes: version.notes || '',
      is_current: version.is_current,
    });
    setVersionDialogOpen(true);
  };

  const handleSaveVersion = async () => {
    const features = versionForm.features.split('\n').filter(f => f.trim());
    const bug_fixes = versionForm.bug_fixes.split('\n').filter(f => f.trim());

    if (editingVersion) {
      await updateVersion.mutateAsync({
        id: editingVersion.id,
        version: versionForm.version,
        title: versionForm.title || null,
        features,
        bug_fixes,
        notes: versionForm.notes || null,
        is_current: versionForm.is_current,
      });
    } else {
      await createVersion.mutateAsync({
        version: versionForm.version,
        title: versionForm.title || undefined,
        features,
        bug_fixes,
        notes: versionForm.notes || undefined,
        is_current: versionForm.is_current,
      });
    }
    setVersionDialogOpen(false);
    resetVersionForm();
  };

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Companies</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCompanies}</div>
            <p className="text-xs text-muted-foreground">
              +{recentSignups.length} this week
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsers}</div>
            <p className="text-xs text-muted-foreground">
              Across all tenants
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeSubscriptions}</div>
            <p className="text-xs text-muted-foreground">
              {trialSubscriptions} on trial
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${mrr.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              MRR from active subs
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Alerts Row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {pastDueSubscriptions > 0 && (
          <Card className="border-destructive">
            <CardHeader className="flex flex-row items-center gap-2 pb-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <CardTitle className="text-sm font-medium text-destructive">Past Due</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{pastDueSubscriptions}</div>
              <p className="text-xs text-muted-foreground">Subscriptions need attention</p>
            </CardContent>
          </Card>
        )}
        
        {expiringCompanies.length > 0 && (
          <Card className="border-amber-500">
            <CardHeader className="flex flex-row items-center gap-2 pb-2">
              <Clock className="h-4 w-4 text-amber-500" />
              <CardTitle className="text-sm font-medium text-amber-600">Expiring Soon</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl font-bold">{expiringCompanies.length}</div>
              <p className="text-xs text-muted-foreground">In the next 7 days</p>
            </CardContent>
          </Card>
        )}
        
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">No Subscription</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold">{companiesWithoutSub.length}</div>
            <p className="text-xs text-muted-foreground">Companies without a plan</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity & Software Version */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Signups</CardTitle>
          </CardHeader>
          <CardContent>
            {recentSignups.length > 0 ? (
              <div className="space-y-3">
                {recentSignups.slice(0, 5).map(company => (
                  <div key={company.id} className="flex items-center justify-between">
                    <span className="font-medium">{company.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {format(new Date(company.created_at), 'MMM d')}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No new signups this week</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Subscription Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {plans.map(plan => {
                const count = subscriptions.filter(s => 
                  s.plan_id === plan.id && s.status === 'active'
                ).length;
                return (
                  <div key={plan.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{plan.display_name}</span>
                      <Badge variant="secondary">${plan.price_monthly}/mo</Badge>
                    </div>
                    <span className="text-sm font-medium">{count}</span>
                  </div>
                );
              })}
              <div className="flex items-center justify-between pt-2 border-t">
                <span className="font-medium">No Plan</span>
                <span className="text-sm font-medium">{companiesWithoutSub.length}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Software Version Management */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Tag className="w-4 h-4" />
              Software Version Management
            </CardTitle>
            {currentVersion && (
              <p className="text-sm text-muted-foreground mt-1">
                Current: <span className="font-mono font-semibold text-primary">{currentVersion.version}</span>
                {currentVersion.title && <span className="ml-2">- {currentVersion.title}</span>}
              </p>
            )}
          </div>
          <Dialog open={versionDialogOpen} onOpenChange={(open) => {
            setVersionDialogOpen(open);
            if (!open) resetVersionForm();
          }}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="w-4 h-4" />
                New Version
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingVersion ? 'Edit Version' : 'Create New Version'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Version Number *</Label>
                    <Input
                      value={versionForm.version}
                      onChange={(e) => setVersionForm({ ...versionForm, version: e.target.value })}
                      placeholder="1.0.1"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input
                      value={versionForm.title}
                      onChange={(e) => setVersionForm({ ...versionForm, title: e.target.value })}
                      placeholder="Bug Fix Release"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Features (one per line)</Label>
                  <Textarea
                    value={versionForm.features}
                    onChange={(e) => setVersionForm({ ...versionForm, features: e.target.value })}
                    placeholder="New dashboard widget&#10;Improved performance&#10;Dark mode support"
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Bug Fixes (one per line)</Label>
                  <Textarea
                    value={versionForm.bug_fixes}
                    onChange={(e) => setVersionForm({ ...versionForm, bug_fixes: e.target.value })}
                    placeholder="Fixed login issue&#10;Resolved PDF export bug"
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea
                    value={versionForm.notes}
                    onChange={(e) => setVersionForm({ ...versionForm, notes: e.target.value })}
                    placeholder="Additional release notes..."
                    rows={2}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_current"
                    checked={versionForm.is_current}
                    onChange={(e) => setVersionForm({ ...versionForm, is_current: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  <Label htmlFor="is_current" className="cursor-pointer">Set as current version</Label>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setVersionDialogOpen(false)}>Cancel</Button>
                  <Button 
                    onClick={handleSaveVersion} 
                    disabled={!versionForm.version || createVersion.isPending || updateVersion.isPending}
                  >
                    {(createVersion.isPending || updateVersion.isPending) && (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    )}
                    {editingVersion ? 'Save Changes' : 'Create Version'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {versionsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : softwareVersions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No versions found</p>
          ) : (
            <Accordion type="single" collapsible className="w-full">
              {softwareVersions.map((version) => (
                <AccordionItem key={version.id} value={version.id}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3 text-left">
                      <span className="font-mono font-semibold">{version.version}</span>
                      {version.title && <span className="text-muted-foreground">- {version.title}</span>}
                      {version.is_current && (
                        <Badge variant="default" className="ml-2">Current</Badge>
                      )}
                      <span className="text-xs text-muted-foreground ml-auto mr-4">
                        {format(new Date(version.release_date), 'MMM d, yyyy')}
                      </span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4 pt-2">
                      {version.features && version.features.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                            <Tag className="w-3 h-3" />
                            Features
                          </h4>
                          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                            {version.features.map((feature, i) => (
                              <li key={i}>{feature}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {version.bug_fixes && version.bug_fixes.length > 0 && (
                        <div>
                          <h4 className="text-sm font-semibold flex items-center gap-2 mb-2">
                            <Bug className="w-3 h-3" />
                            Bug Fixes
                          </h4>
                          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                            {version.bug_fixes.map((fix, i) => (
                              <li key={i}>{fix}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {version.notes && (
                        <div>
                          <h4 className="text-sm font-semibold mb-2">Notes</h4>
                          <p className="text-sm text-muted-foreground">{version.notes}</p>
                        </div>
                      )}
                      <div className="flex gap-2 pt-2 border-t">
                        <Button 
                          size="sm" 
                          variant="outline" 
                          onClick={() => handleEditVersion(version)}
                          className="gap-1"
                        >
                          <Pencil className="w-3 h-3" />
                          Edit
                        </Button>
                        {!version.is_current && (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => setCurrentVersion.mutate(version.id)}
                            disabled={setCurrentVersion.isPending}
                            className="gap-1"
                          >
                            <Check className="w-3 h-3" />
                            Set as Current
                          </Button>
                        )}
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
