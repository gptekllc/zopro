import { ReactNode, useState } from 'react';
import { useFeatureFlags, FeatureFlag, FEATURE_FLAGS } from '@/hooks/useFeatureFlags';
import { useSubscriptionPlans, useCurrentSubscription } from '@/hooks/useSubscription';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lock, Sparkles, ArrowRight, ChevronDown, ChevronUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PlanComparisonTable } from '@/components/subscription/PlanComparisonTable';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface FeatureGateProps {
  feature: FeatureFlag;
  children: ReactNode;
  /** Show nothing instead of upgrade prompt when feature is disabled */
  hideWhenDisabled?: boolean;
  /** Custom fallback component */
  fallback?: ReactNode;
  /** Minimal mode - just shows a small lock icon inline */
  minimal?: boolean;
}

export function FeatureGate({ 
  feature, 
  children, 
  hideWhenDisabled = false,
  fallback,
  minimal = false,
}: FeatureGateProps) {
  const { isFeatureEnabled, isLoading } = useFeatureFlags();
  const { data: plans } = useSubscriptionPlans();
  const { data: subscription } = useCurrentSubscription();
  const [showComparison, setShowComparison] = useState(false);
  
  // While loading, show children (optimistic)
  if (isLoading) {
    return <>{children}</>;
  }
  
  const enabled = isFeatureEnabled(feature);
  
  if (enabled) {
    return <>{children}</>;
  }
  
  // Feature is disabled
  if (hideWhenDisabled) {
    return null;
  }
  
  if (fallback) {
    return <>{fallback}</>;
  }
  
  if (minimal) {
    return (
      <div className="inline-flex items-center gap-1.5 text-muted-foreground text-sm">
        <Lock className="w-3.5 h-3.5" />
        <span>Upgrade to unlock</span>
      </div>
    );
  }
  
  const featureName = feature.replace(/_/g, ' ');
  const featureDescription = FEATURE_FLAGS[feature];
  const currentPlanId = subscription?.subscription_plans?.id;
  
  return (
    <Card className="border-dashed border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
      <CardHeader className="text-center pb-2">
        <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
          <Lock className="w-6 h-6 text-primary" />
        </div>
        <CardTitle className="capitalize text-lg">
          {featureName}
        </CardTitle>
        <CardDescription>
          {featureDescription}
        </CardDescription>
      </CardHeader>
      <CardContent className="text-center space-y-4">
        <p className="text-sm text-muted-foreground">
          This feature is not available on your current plan. Upgrade to unlock access.
        </p>
        <div className="flex flex-col sm:flex-row gap-2 justify-center">
          <Button asChild className="gap-2">
            <Link to="/subscription">
              <Sparkles className="w-4 h-4" />
              Upgrade Plan
              <ArrowRight className="w-4 h-4" />
            </Link>
          </Button>
        </div>

        {/* Plan Comparison Toggle */}
        {plans && plans.length > 0 && (
          <Collapsible open={showComparison} onOpenChange={setShowComparison}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground">
                Compare Plans
                {showComparison ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-4">
              <PlanComparisonTable
                plans={plans}
                currentPlanId={currentPlanId}
                compact
              />
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}

/** Hook to check if feature is enabled - for conditional logic */
export function useFeatureGate(feature: FeatureFlag): boolean {
  const { isFeatureEnabled } = useFeatureFlags();
  return isFeatureEnabled(feature);
}
