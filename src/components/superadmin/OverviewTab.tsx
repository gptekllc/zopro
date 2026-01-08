import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Users, CreditCard, TrendingUp, AlertTriangle, Clock } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';

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

      {/* Recent Activity */}
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
    </div>
  );
}
