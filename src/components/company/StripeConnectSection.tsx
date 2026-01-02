import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Company, useUpdateCompany } from '@/hooks/useCompany';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  CreditCard, 
  ExternalLink, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Building2,
  ArrowRight,
  Banknote
} from 'lucide-react';
import { toast } from 'sonner';

interface StripeConnectSectionProps {
  company: Company;
}

const StripeConnectSection = ({ company }: StripeConnectSectionProps) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isLoadingDashboard, setIsLoadingDashboard] = useState(false);
  const queryClient = useQueryClient();
  const updateCompany = useUpdateCompany();

  const hasStripeAccount = !!company.stripe_account_id;
  const isOnboardingComplete = company.stripe_onboarding_complete ?? false;
  const chargesEnabled = company.stripe_charges_enabled ?? false;
  const payoutsEnabled = company.stripe_payouts_enabled ?? false;
  const stripePaymentsEnabled = company.stripe_payments_enabled ?? true;

  const getConnectionStatus = () => {
    if (!hasStripeAccount) {
      return { status: 'not_connected', label: 'Not Connected', variant: 'secondary' as const };
    }
    if (isOnboardingComplete && chargesEnabled) {
      return { status: 'connected', label: 'Connected', variant: 'default' as const };
    }
    return { status: 'pending', label: 'Setup Incomplete', variant: 'outline' as const };
  };

  const connectionStatus = getConnectionStatus();

  const handleConnectStripe = async () => {
    setIsConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-stripe-connect-account');
      
      if (error) throw new Error(error.message);
      if (!data?.url) throw new Error('No onboarding URL returned');

      // Invalidate company query before redirect
      await queryClient.invalidateQueries({ queryKey: ['company'] });
      
      // Open Stripe onboarding in new tab
      window.open(data.url, '_blank');
      toast.success('Opening Stripe onboarding...');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start Stripe onboarding';
      toast.error(message);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleOpenDashboard = async () => {
    setIsLoadingDashboard(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-connect-dashboard');
      
      if (error) throw new Error(error.message);
      if (!data?.url) throw new Error('No dashboard URL returned');

      window.open(data.url, '_blank');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to open Stripe dashboard';
      toast.error(message);
    } finally {
      setIsLoadingDashboard(false);
    }
  };

  const handleToggleStripePayments = (enabled: boolean) => {
    updateCompany.mutate({
      id: company.id,
      stripe_payments_enabled: enabled,
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              <CardTitle>Stripe Payments</CardTitle>
            </div>
            <Badge variant={connectionStatus.variant}>
              {connectionStatus.label}
            </Badge>
          </div>
          <CardDescription>
            Connect your Stripe account to receive invoice payments directly to your bank account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!hasStripeAccount && (
            <>
              <Alert>
                <Building2 className="h-4 w-4" />
                <AlertDescription>
                  Connect your Stripe account to accept online payments. Customers will be able to pay invoices 
                  with credit cards and bank transfers, with funds deposited directly to your bank account.
                </AlertDescription>
              </Alert>
              
              <Button onClick={handleConnectStripe} disabled={isConnecting} className="gap-2">
                {isConnecting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
                Connect with Stripe
              </Button>
            </>
          )}

          {hasStripeAccount && !isOnboardingComplete && (
            <>
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Your Stripe account setup is incomplete. Please complete the onboarding process to start 
                  accepting payments.
                </AlertDescription>
              </Alert>
              
              <Button onClick={handleConnectStripe} disabled={isConnecting} className="gap-2">
                {isConnecting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowRight className="w-4 h-4" />
                )}
                Continue Setup
              </Button>
            </>
          )}

          {hasStripeAccount && isOnboardingComplete && (
            <>
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2">
                      {chargesEnabled ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-amber-500" />
                      )}
                      <span className="text-sm">
                        Card Payments: {chargesEnabled ? 'Enabled' : 'Pending'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {payoutsEnabled ? (
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-amber-500" />
                      )}
                      <span className="text-sm">
                        Bank Payouts: {payoutsEnabled ? 'Enabled' : 'Pending'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button 
                  onClick={handleOpenDashboard} 
                  disabled={isLoadingDashboard}
                  variant="outline"
                  className="gap-2"
                >
                  {isLoadingDashboard ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ExternalLink className="w-4 h-4" />
                  )}
                  Manage Stripe Account
                </Button>
              </div>
              
              <p className="text-sm text-muted-foreground">
                Manage your bank account, view payouts, and update your Stripe settings in the Stripe Dashboard.
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Online Payments Toggle - only show when Stripe is connected */}
      {hasStripeAccount && isOnboardingComplete && chargesEnabled && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Banknote className="w-5 h-5" />
              <CardTitle>Payment Options</CardTitle>
            </div>
            <CardDescription>
              Control how customers can pay their invoices
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
              <div className="space-y-1">
                <Label htmlFor="stripe-payments-toggle" className="text-base font-medium">
                  Accept Online Card Payments
                </Label>
                <p className="text-sm text-muted-foreground">
                  {stripePaymentsEnabled
                    ? 'Customers can pay invoices online with credit/debit cards'
                    : 'Customers will see offline payment instructions (cash, check, bank transfer)'}
                </p>
              </div>
              <Switch
                id="stripe-payments-toggle"
                checked={stripePaymentsEnabled}
                onCheckedChange={handleToggleStripePayments}
                disabled={updateCompany.isPending}
              />
            </div>
            
            {!stripePaymentsEnabled && (
              <Alert>
                <Banknote className="h-4 w-4" />
                <AlertDescription>
                  Online payments are disabled. Customers will see instructions for paying via {company.default_payment_method === 'check' ? 'check' : company.default_payment_method === 'cash' ? 'cash' : company.default_payment_method === 'bank_transfer' ? 'bank transfer' : 'your preferred payment method'}.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default StripeConnectSection;
