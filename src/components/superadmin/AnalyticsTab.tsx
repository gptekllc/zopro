import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { format, subMonths, startOfMonth, endOfMonth, eachMonthOfInterval, parseISO } from 'date-fns';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

interface Company {
  id: string;
  name: string;
  created_at: string;
}

interface Profile {
  id: string;
  created_at: string;
  company_id: string | null;
}

interface AnalyticsTabProps {
  companies: Company[];
  profiles: Profile[];
}

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
  created_at: string;
  subscription_plans?: SubscriptionPlan;
}

export function AnalyticsTab({ companies, profiles }: AnalyticsTabProps) {
  // Fetch subscriptions for MRR calculation
  const { data: subscriptions = [], isLoading } = useQuery({
    queryKey: ['all-subscriptions-analytics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_subscriptions')
        .select(`
          *,
          subscription_plans (id, name, display_name, price_monthly)
        `)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as CompanySubscription[];
    },
  });

  // Calculate growth data for the last 12 months
  const growthData = useMemo(() => {
    const now = new Date();
    const twelveMonthsAgo = subMonths(now, 11);
    const months = eachMonthOfInterval({
      start: startOfMonth(twelveMonthsAgo),
      end: endOfMonth(now),
    });

    return months.map(month => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);

      // Count companies created up to this month
      const totalCompanies = companies.filter(c => 
        parseISO(c.created_at) <= monthEnd
      ).length;

      // Count new companies in this month
      const newCompanies = companies.filter(c => {
        const created = parseISO(c.created_at);
        return created >= monthStart && created <= monthEnd;
      }).length;

      // Count users created up to this month
      const totalUsers = profiles.filter(p => 
        parseISO(p.created_at) <= monthEnd
      ).length;

      // Count new users in this month
      const newUsers = profiles.filter(p => {
        const created = parseISO(p.created_at);
        return created >= monthStart && created <= monthEnd;
      }).length;

      return {
        month: format(month, 'MMM yyyy'),
        shortMonth: format(month, 'MMM'),
        totalCompanies,
        newCompanies,
        totalUsers,
        newUsers,
      };
    });
  }, [companies, profiles]);

  // Calculate MRR over time
  const revenueData = useMemo(() => {
    const now = new Date();
    const twelveMonthsAgo = subMonths(now, 11);
    const months = eachMonthOfInterval({
      start: startOfMonth(twelveMonthsAgo),
      end: endOfMonth(now),
    });

    return months.map(month => {
      const monthEnd = endOfMonth(month);

      // Calculate MRR: sum of active subscriptions' monthly prices up to this month
      const mrr = subscriptions
        .filter(s => {
          const created = parseISO(s.created_at);
          return created <= monthEnd && s.status === 'active' && s.subscription_plans;
        })
        .reduce((sum, s) => sum + (s.subscription_plans?.price_monthly || 0), 0);

      // Count active subscriptions
      const activeSubscriptions = subscriptions.filter(s => {
        const created = parseISO(s.created_at);
        return created <= monthEnd && s.status === 'active';
      }).length;

      return {
        month: format(month, 'MMM yyyy'),
        shortMonth: format(month, 'MMM'),
        mrr,
        activeSubscriptions,
      };
    });
  }, [subscriptions]);

  // Calculate subscription distribution
  const subscriptionDistribution = useMemo(() => {
    const distribution: Record<string, number> = {};
    
    subscriptions
      .filter(s => s.status === 'active')
      .forEach(s => {
        const planName = s.subscription_plans?.display_name || 'Unknown';
        distribution[planName] = (distribution[planName] || 0) + 1;
      });

    return Object.entries(distribution).map(([name, count]) => ({
      name,
      count,
    }));
  }, [subscriptions]);

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Company & User Growth */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Company Growth (12 months)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={growthData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="shortMonth" 
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis 
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="totalCompanies"
                  name="Total Companies"
                  stroke="hsl(var(--primary))"
                  fill="hsl(var(--primary) / 0.2)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">User Growth (12 months)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={growthData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="shortMonth" 
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis 
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="totalUsers"
                  name="Total Users"
                  stroke="hsl(142, 76%, 36%)"
                  fill="hsl(142, 76%, 36%, 0.2)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* New Signups Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">New Signups per Month</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={growthData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="shortMonth" 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Legend />
              <Bar 
                dataKey="newCompanies" 
                name="New Companies" 
                fill="hsl(var(--primary))" 
                radius={[4, 4, 0, 0]}
              />
              <Bar 
                dataKey="newUsers" 
                name="New Users" 
                fill="hsl(142, 76%, 36%)" 
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Revenue Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Monthly Recurring Revenue (MRR)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="shortMonth" 
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis 
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  tickFormatter={(value) => `$${value}`}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                  formatter={(value: number) => [`$${value}`, 'MRR']}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="mrr"
                  name="MRR"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Active Subscriptions</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="shortMonth" 
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis 
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="activeSubscriptions"
                  name="Active Subscriptions"
                  stroke="hsl(262, 83%, 58%)"
                  fill="hsl(262, 83%, 58%, 0.2)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Subscription Distribution */}
      {subscriptionDistribution.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Subscription Distribution by Plan</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={subscriptionDistribution} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  type="number"
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis 
                  type="category"
                  dataKey="name"
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  width={100}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Bar 
                  dataKey="count" 
                  name="Companies" 
                  fill="hsl(var(--primary))" 
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
