import { Check, X, Infinity } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { FEATURE_FLAGS, FeatureFlag } from '@/hooks/useFeatureFlags';
import { cn } from '@/lib/utils';

interface Plan {
  id: string;
  name: string;
  display_name: string;
  price_monthly: number | null;
  price_yearly: number | null;
  max_users: number | null;
  max_jobs_per_month: number | null;
  max_storage_gb?: number | null;
  storage_limit_bytes?: number | null;
  features: Record<string, boolean> | null;
}

interface PlanComparisonTableProps {
  plans: Plan[];
  currentPlanId?: string;
  onSelectPlan?: (planId: string) => void;
  loading?: boolean;
  compact?: boolean;
}

const FEATURE_ORDER: FeatureFlag[] = [
  'jobs',
  'quotes',
  'invoices',
  'time_clock',
  'reports',
  'team_members',
  'customer_portal',
  'email_templates',
  'stripe_payments',
  'photo_uploads',
  'signatures',
  'api_access',
  'white_label',
  'custom_domain',
];

export function PlanComparisonTable({ 
  plans, 
  currentPlanId, 
  onSelectPlan, 
  loading,
  compact = false,
}: PlanComparisonTableProps) {
  const hasFeature = (plan: Plan, feature: FeatureFlag): boolean => {
    if (!plan.features) return false;
    return plan.features[feature] === true;
  };

  const formatStorage = (plan: Plan): string => {
    // Prefer bytes (authoritative, supports decimals), fall back to max_storage_gb.
    if (plan.storage_limit_bytes === null || plan.storage_limit_bytes === undefined) {
      if (plan.max_storage_gb === null || plan.max_storage_gb === undefined) return 'Unlimited';
      // Treat GB as decimal here too (1 GB = 1000 MB)
      return plan.max_storage_gb < 1
        ? `${Math.round(plan.max_storage_gb * 1000)} MB`
        : `${plan.max_storage_gb} GB`;
    }

    const gb = plan.storage_limit_bytes / 1_000_000_000;
    if (gb < 1) return `${Math.round(plan.storage_limit_bytes / 1_000_000)} MB`;

    const rounded = Math.round(gb * 100) / 100;
    return `${Number.isInteger(rounded) ? Math.trunc(rounded) : rounded} GB`;
  };

  if (compact) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {plans.map((plan) => {
          const isCurrent = plan.id === currentPlanId;
          const isPopular = plan.name === 'professional';

          return (
            <Card 
              key={plan.id}
              className={cn(
                "relative flex flex-col transition-all",
                isCurrent && "ring-2 ring-primary",
                isPopular && !isCurrent && "ring-2 ring-accent"
              )}
            >
              {isPopular && !isCurrent && (
                <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-accent text-accent-foreground">
                  Most Popular
                </Badge>
              )}
              {isCurrent && (
                <Badge className="absolute -top-2 left-1/2 -translate-x-1/2">
                  Current Plan
                </Badge>
              )}
              
              <CardHeader className="text-center pb-2">
                <CardTitle className="text-lg">{plan.display_name}</CardTitle>
                <CardDescription className="space-y-1">
                  {plan.price_monthly === 0 ? (
                    <span className="text-2xl font-bold text-foreground">Free</span>
                  ) : (
                    <>
                      <div>
                        <span className="text-2xl font-bold text-foreground">${plan.price_monthly}</span>
                        <span className="text-muted-foreground">/mo</span>
                      </div>
                      {plan.price_yearly && plan.price_yearly > 0 && (
                        <div className="text-xs">
                          <span className="text-muted-foreground">or </span>
                          <span className="font-semibold text-foreground">${Math.round(plan.price_yearly / 12)}</span>
                          <span className="text-muted-foreground">/mo yearly</span>
                          <Badge variant="secondary" className="ml-1 text-[10px] px-1 py-0">
                            Save {Math.round((1 - plan.price_yearly / (plan.price_monthly * 12)) * 100)}%
                          </Badge>
                        </div>
                      )}
                    </>
                  )}
                </CardDescription>
              </CardHeader>

              <CardContent className="flex-1 pt-0">
                <ul className="space-y-1.5 text-sm">
                  <li className="flex items-center gap-2">
                    <span className="text-muted-foreground">Users:</span>
                    <span className="font-medium">
                      {plan.max_users === null ? 'Unlimited' : plan.max_users}
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-muted-foreground">Jobs/mo:</span>
                    <span className="font-medium">
                      {plan.max_jobs_per_month === null ? 'Unlimited' : plan.max_jobs_per_month}
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-muted-foreground">Storage:</span>
                    <span className="font-medium">
                      {formatStorage(plan)}
                    </span>
                  </li>
                </ul>
              </CardContent>

              {onSelectPlan && (
                <CardFooter>
                  <Button
                    className="w-full"
                    variant={isCurrent ? "outline" : isPopular ? "default" : "secondary"}
                    disabled={isCurrent || loading}
                    onClick={() => onSelectPlan(plan.id)}
                  >
                    {isCurrent ? 'Current Plan' : 'Select'}
                  </Button>
                </CardFooter>
              )}
            </Card>
          );
        })}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="text-left p-4 border-b bg-muted/50">Features</th>
            {plans.map((plan) => {
              const isCurrent = plan.id === currentPlanId;
              const isPopular = plan.name === 'professional';
              
              return (
                <th 
                  key={plan.id} 
                  className={cn(
                    "text-center p-4 border-b min-w-[140px]",
                    isCurrent && "bg-primary/10",
                    isPopular && !isCurrent && "bg-accent/10"
                  )}
                >
                  <div className="space-y-1">
                    {isPopular && !isCurrent && (
                      <Badge className="bg-accent text-accent-foreground text-xs">Popular</Badge>
                    )}
                    {isCurrent && (
                      <Badge className="text-xs">Current</Badge>
                    )}
                    <div className="font-bold text-base">{plan.display_name}</div>
                    <div className="text-muted-foreground text-sm">
                      {plan.price_monthly === 0 ? (
                        'Free'
                      ) : (
                        <div className="space-y-0.5">
                          <div>${plan.price_monthly}/mo</div>
                          {plan.price_yearly && plan.price_yearly > 0 && (
                            <div className="text-xs">
                              <span>${Math.round(plan.price_yearly / 12)}/mo yearly </span>
                              <Badge variant="secondary" className="text-[10px] px-1 py-0">
                                -{Math.round((1 - plan.price_yearly / (plan.price_monthly * 12)) * 100)}%
                              </Badge>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {/* Limits */}
          <tr className="border-b">
            <td className="p-4 font-medium">Team Members</td>
            {plans.map((plan) => (
              <td key={plan.id} className="text-center p-4">
                {plan.max_users === null ? (
                  <Infinity className="w-4 h-4 mx-auto text-success" />
                ) : (
                  <span className="font-medium">{plan.max_users}</span>
                )}
              </td>
            ))}
          </tr>
          <tr className="border-b">
            <td className="p-4 font-medium">Jobs per Month</td>
            {plans.map((plan) => (
              <td key={plan.id} className="text-center p-4">
                {plan.max_jobs_per_month === null ? (
                  <Infinity className="w-4 h-4 mx-auto text-success" />
                ) : (
                  <span className="font-medium">{plan.max_jobs_per_month}</span>
                )}
              </td>
            ))}
          </tr>
          <tr className="border-b">
            <td className="p-4 font-medium">Storage</td>
            {plans.map((plan) => (
              <td key={plan.id} className="text-center p-4">
                {plan.storage_limit_bytes === null ? (
                  <Infinity className="w-4 h-4 mx-auto text-success" />
                ) : (
                  <span className="font-medium">{formatStorage(plan)}</span>
                )}
              </td>
            ))}
          </tr>

          {/* Features */}
          {FEATURE_ORDER.map((feature) => (
            <tr key={feature} className="border-b">
              <td className="p-4 capitalize">
                {feature.replace(/_/g, ' ')}
              </td>
              {plans.map((plan) => (
                <td key={plan.id} className="text-center p-4">
                  {hasFeature(plan, feature) ? (
                    <Check className="w-5 h-5 text-success mx-auto" />
                  ) : (
                    <X className="w-5 h-5 text-muted-foreground/40 mx-auto" />
                  )}
                </td>
              ))}
            </tr>
          ))}

          {/* Action Row */}
          {onSelectPlan && (
            <tr>
              <td className="p-4"></td>
              {plans.map((plan) => {
                const isCurrent = plan.id === currentPlanId;
                const isPopular = plan.name === 'professional';
                
                return (
                  <td key={plan.id} className="text-center p-4">
                    <Button
                      variant={isCurrent ? "outline" : isPopular ? "default" : "secondary"}
                      disabled={isCurrent || loading}
                      onClick={() => onSelectPlan(plan.id)}
                      className="w-full"
                    >
                      {isCurrent ? 'Current Plan' : 'Select Plan'}
                    </Button>
                  </td>
                );
              })}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
