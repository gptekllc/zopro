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
                <CardDescription>
                  {plan.price_monthly === 0 ? (
                    <span className="text-2xl font-bold text-foreground">Free</span>
                  ) : (
                    <>
                      <span className="text-2xl font-bold text-foreground">${plan.price_monthly}</span>
                      <span className="text-muted-foreground">/mo</span>
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
                        <>${plan.price_monthly}/mo</>
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
