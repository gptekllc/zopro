import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CreditCard, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  ArrowLeft,
  Calendar, 
  Users, 
  Briefcase,
  ExternalLink,
  Sparkles,
  AlertTriangle,
  HardDrive
} from 'lucide-react';
import PageContainer from '@/components/layout/PageContainer';
import { PlanComparisonTable } from '@/components/subscription/PlanComparisonTable';
import { useSubscriptionPlans, useCurrentSubscription, useSubscriptionActions } from '@/hooks/useSubscription';
import { useUsageLimits } from '@/hooks/useUsageLimits';
import { useStorageUsage, formatBytes } from '@/hooks/useStorageUsage';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function Subscription() {
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  const { data: plans, isLoading: plansLoading } = useSubscriptionPlans();
  const { data: subscription, isLoading: subscriptionLoading } = useCurrentSubscription();
  const { startCheckout, openCustomerPortal } = useSubscriptionActions();
  const { currentUsers, maxUsers, currentJobsThisMonth, maxJobsPerMonth } = useUsageLimits();
  const { totalBytesUsed, limitBytes, percentageUsed, isNearLimit, isCritical } = useStorageUsage();

  // Handle success/cancel from Stripe
  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      toast.success('Subscription updated successfully!');
      queryClient.invalidateQueries({ queryKey: ['company-subscription'] });
      queryClient.invalidateQueries({ queryKey: ['plan-features'] });
    } else if (searchParams.get('canceled') === 'true') {
      toast.info('Checkout was canceled');
    }
  }, [searchParams, queryClient]);

  const handleSelectPlan = async (planId: string) => {
    const plan = plans?.find(p => p.id === planId);
    if (!plan || plan.price_monthly === 0) {
      toast.info('Please contact support to downgrade to the free plan');
      return;
    }

    // For now, we need to create Stripe prices first
    // This is a placeholder - in production, you'd map plan IDs to Stripe price IDs
    toast.info('Please contact sales to upgrade your plan. Stripe integration coming soon!');
  };

  const handleManageSubscription = async () => {
    setPortalLoading(true);
    try {
      await openCustomerPortal();
    } catch (error: any) {
      toast.error(error.message || 'Failed to open customer portal');
    } finally {
      setPortalLoading(false);
    }
  };

  const isLoading = plansLoading || subscriptionLoading;
  const currentPlan = subscription?.subscription_plans;

  return (
    <PageContainer className="space-y-6 max-w-6xl mx-auto">
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link to="/company?tab=billing">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Settings
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Subscription & Billing</h1>
          <p className="text-muted-foreground mt-1">
            Manage your subscription plan and billing settings
          </p>
        </div>
      </div>

      {/* Current Plan Overview */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Current Plan
            </CardTitle>
            <CardDescription>Your active subscription details</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-8 w-32" />
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-4 w-40" />
              </div>
            ) : subscription && currentPlan ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold">{currentPlan.display_name}</span>
                  <Badge variant={subscription.status === 'active' ? 'default' : 'secondary'}>
                    {subscription.status === 'trialing' ? 'Trial' : subscription.status}
                  </Badge>
                  {subscription.cancel_at_period_end && (
                    <Badge variant="destructive">Canceling</Badge>
                  )}
                </div>

                {currentPlan.price_monthly !== null && currentPlan.price_monthly > 0 && (
                  <p className="text-muted-foreground">
                    <span className="text-xl font-semibold text-foreground">
                      ${currentPlan.price_monthly}
                    </span>
                    /month
                  </p>
                )}

                {subscription.current_period_end && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    {subscription.cancel_at_period_end ? (
                      <span>Access until {format(new Date(subscription.current_period_end), 'MMM d, yyyy')}</span>
                    ) : (
                      <span>Renews on {format(new Date(subscription.current_period_end), 'MMM d, yyyy')}</span>
                    )}
                  </div>
                )}

                {subscription.trial_ends_at && subscription.status === 'trialing' && (
                  <Alert>
                    <AlertTriangle className="w-4 h-4" />
                    <AlertDescription>
                      Trial ends on {format(new Date(subscription.trial_ends_at), 'MMM d, yyyy')}
                    </AlertDescription>
                  </Alert>
                )}

                <Button 
                  variant="outline" 
                  onClick={handleManageSubscription}
                  disabled={portalLoading}
                  className="gap-2"
                >
                  {portalLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ExternalLink className="w-4 h-4" />
                  )}
                  Manage Billing
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl font-bold">Free</span>
                  <Badge variant="secondary">No subscription</Badge>
                </div>
                <p className="text-muted-foreground">
                  Upgrade to unlock more features and higher limits.
                </p>
                <Button className="gap-2" onClick={() => document.getElementById('plans')?.scrollIntoView({ behavior: 'smooth' })}>
                  <Sparkles className="w-4 h-4" />
                  View Plans
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Usage Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="w-5 h-5" />
              Current Usage
            </CardTitle>
            <CardDescription>Your usage this billing period</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <Users className="w-4 h-4" />
                      Team Members
                    </span>
                    <span className="font-bold">
                      {currentUsers} / {maxUsers === null ? '∞' : maxUsers}
                    </span>
                  </div>
                  {maxUsers !== null && (
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all"
                        style={{ width: `${Math.min((currentUsers / maxUsers) * 100, 100)}%` }}
                      />
                    </div>
                  )}
                </div>

                <div className="p-4 rounded-lg bg-muted/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <Briefcase className="w-4 h-4" />
                      Jobs This Month
                    </span>
                    <span className="font-bold">
                      {currentJobsThisMonth} / {maxJobsPerMonth === null ? '∞' : maxJobsPerMonth}
                    </span>
                  </div>
                  {maxJobsPerMonth !== null && (
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all"
                        style={{ width: `${Math.min((currentJobsThisMonth / maxJobsPerMonth) * 100, 100)}%` }}
                      />
                    </div>
                  )}
                </div>

                <div className={`p-4 rounded-lg space-y-2 ${isCritical ? 'bg-destructive/10' : isNearLimit ? 'bg-yellow-500/10' : 'bg-muted/50'}`}>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <HardDrive className={`w-4 h-4 ${isCritical ? 'text-destructive' : isNearLimit ? 'text-yellow-600' : ''}`} />
                      Storage
                    </span>
                    <span className={`font-bold ${isCritical ? 'text-destructive' : isNearLimit ? 'text-yellow-600' : ''}`}>
                      {formatBytes(totalBytesUsed)} / {limitBytes === null ? '∞' : formatBytes(limitBytes)}
                    </span>
                  </div>
                  {limitBytes !== null && (
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all ${isCritical ? 'bg-destructive' : isNearLimit ? 'bg-yellow-500' : 'bg-primary'}`}
                        style={{ width: `${Math.min(percentageUsed, 100)}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Plan Comparison */}
      <Card id="plans">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5" />
            Compare Plans
          </CardTitle>
          <CardDescription>
            Choose the plan that best fits your business needs
          </CardDescription>
        </CardHeader>
        <CardContent>
          {plansLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-64 w-full" />
            </div>
          ) : plans && plans.length > 0 ? (
            <PlanComparisonTable
              plans={plans}
              currentPlanId={currentPlan?.id}
              onSelectPlan={handleSelectPlan}
              loading={!!checkoutLoading}
            />
          ) : (
            <p className="text-muted-foreground text-center py-8">
              No subscription plans available
            </p>
          )}
        </CardContent>
      </Card>
    </PageContainer>
  );
}
