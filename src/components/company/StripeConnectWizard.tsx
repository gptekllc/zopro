import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { 
  CheckCircle2, 
  Circle, 
  CreditCard, 
  ExternalLink, 
  Loader2, 
  AlertCircle,
  Building2,
  Mail,
  Phone,
  MapPin,
  ArrowRight,
  RefreshCw,
  Shield,
  DollarSign,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface StripeConnectWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    stripe_account_id: string | null;
    stripe_onboarding_complete: boolean | null;
    stripe_charges_enabled: boolean | null;
    stripe_payouts_enabled: boolean | null;
    platform_fee_percentage: number | null;
  };
  onComplete: () => void;
}

type WizardStep = 'intro' | 'requirements' | 'create' | 'onboarding' | 'verification' | 'success';

interface Requirement {
  key: string;
  label: string;
  icon: typeof Mail;
  met: boolean;
}

export function StripeConnectWizard({ open, onOpenChange, company, onComplete }: StripeConnectWizardProps) {
  const [currentStep, setCurrentStep] = useState<WizardStep>('intro');
  const [isLoading, setIsLoading] = useState(false);
  const [onboardingUrl, setOnboardingUrl] = useState<string | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  // Determine initial step based on company's Stripe status
  useEffect(() => {
    if (open) {
      if (company.stripe_onboarding_complete && company.stripe_charges_enabled) {
        setCurrentStep('success');
      } else if (company.stripe_account_id) {
        setCurrentStep('onboarding');
      } else {
        setCurrentStep('intro');
      }
    }
  }, [open, company]);

  const requirements: Requirement[] = [
    { key: 'email', label: 'Company email address', icon: Mail, met: !!company.email },
    { key: 'phone', label: 'Business phone number', icon: Phone, met: !!company.phone },
    { key: 'address', label: 'Business address', icon: MapPin, met: !!(company.address && company.city && company.state && company.zip) },
  ];

  const allRequirementsMet = requirements.every(r => r.met);

  const getStepNumber = (step: WizardStep): number => {
    const steps: WizardStep[] = ['intro', 'requirements', 'create', 'onboarding', 'verification', 'success'];
    return steps.indexOf(step) + 1;
  };

  const getProgress = (): number => {
    const stepProgress: Record<WizardStep, number> = {
      intro: 0,
      requirements: 20,
      create: 40,
      onboarding: 60,
      verification: 80,
      success: 100,
    };
    return stepProgress[currentStep];
  };

  const handleCreateAccount = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-stripe-connect-account', {
        body: { companyId: company.id },
      });

      if (error) throw error;

      if (data?.url) {
        setOnboardingUrl(data.url);
        setCurrentStep('onboarding');
        toast.success('Stripe account created! Complete the onboarding to start accepting payments.');
      } else if (data?.error) {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to create Stripe account');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGetOnboardingLink = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('stripe-connect-refresh', {
        body: { companyId: company.id },
      });

      if (error) throw error;

      if (data?.url) {
        setOnboardingUrl(data.url);
        window.open(data.url, '_blank');
      } else if (data?.error) {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to get onboarding link');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckStatus = async () => {
    setIsPolling(true);
    try {
      // Refresh company data
      onComplete();
      
      // Wait a moment for the data to refresh
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      if (company.stripe_onboarding_complete && company.stripe_charges_enabled) {
        setCurrentStep('success');
        toast.success('Stripe Connect setup complete!');
      } else {
        toast.info('Onboarding not yet complete. Please finish the Stripe setup process.');
      }
    } catch (error: any) {
      toast.error('Failed to check status');
    } finally {
      setIsPolling(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 'intro':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <CreditCard className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">Accept Online Payments</h3>
              <p className="text-muted-foreground mt-2">
                Connect your Stripe account to accept credit card payments directly from customers.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <DollarSign className="w-5 h-5 text-green-500 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Direct deposits</p>
                  <p className="text-xs text-muted-foreground">Payments go directly to your bank account</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <Shield className="w-5 h-5 text-blue-500 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Secure payments</p>
                  <p className="text-xs text-muted-foreground">PCI-compliant processing by Stripe</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg">
                <CreditCard className="w-5 h-5 text-purple-500 mt-0.5" />
                <div>
                  <p className="font-medium text-sm">Multiple payment methods</p>
                  <p className="text-xs text-muted-foreground">Accept cards, bank transfers, and more</p>
                </div>
              </div>
            </div>

            <Button className="w-full" onClick={() => setCurrentStep('requirements')}>
              Get Started
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        );

      case 'requirements':
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold">Requirements Check</h3>
              <p className="text-muted-foreground text-sm mt-1">
                Please ensure your company profile is complete before connecting Stripe.
              </p>
            </div>

            <div className="space-y-3">
              {requirements.map((req) => (
                <div 
                  key={req.key}
                  className={`flex items-center gap-3 p-3 rounded-lg border ${
                    req.met ? 'bg-green-50 dark:bg-green-900/20 border-green-200' : 'bg-muted/50 border-border'
                  }`}
                >
                  {req.met ? (
                    <CheckCircle2 className="w-5 h-5 text-green-500" />
                  ) : (
                    <Circle className="w-5 h-5 text-muted-foreground" />
                  )}
                  <req.icon className="w-4 h-4 text-muted-foreground" />
                  <span className={req.met ? 'text-green-700 dark:text-green-300' : 'text-muted-foreground'}>
                    {req.label}
                  </span>
                </div>
              ))}
            </div>

            {!allRequirementsMet && (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5" />
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Please update your company profile with the missing information before continuing.
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setCurrentStep('intro')}>
                Back
              </Button>
              <Button 
                className="flex-1" 
                onClick={() => setCurrentStep('create')}
                disabled={!allRequirementsMet}
              >
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        );

      case 'create':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <Building2 className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold">Create Stripe Account</h3>
              <p className="text-muted-foreground mt-2">
                We'll create a Stripe Connect account for <strong>{company.name}</strong> and redirect you to complete the setup.
              </p>
            </div>

            <div className="p-4 bg-muted/50 rounded-lg space-y-2">
              <p className="text-sm font-medium">What you'll need:</p>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Business or personal bank account details</li>
                <li>• Tax identification number (SSN or EIN)</li>
                <li>• Valid government ID for identity verification</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setCurrentStep('requirements')}>
                Back
              </Button>
              <Button 
                className="flex-1" 
                onClick={handleCreateAccount}
                disabled={isLoading}
              >
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Create Account & Start Onboarding
              </Button>
            </div>
          </div>
        );

      case 'onboarding':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4">
                <ExternalLink className="w-8 h-8 text-blue-500" />
              </div>
              <h3 className="text-lg font-semibold">Complete Stripe Onboarding</h3>
              <p className="text-muted-foreground mt-2">
                Click the button below to open Stripe's secure onboarding form. Complete all required steps to enable payments.
              </p>
            </div>

            <div className="space-y-3">
              <Button 
                className="w-full" 
                onClick={() => onboardingUrl && window.open(onboardingUrl, '_blank')}
                disabled={!onboardingUrl}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Open Stripe Onboarding
              </Button>
              
              <Button 
                variant="outline" 
                className="w-full"
                onClick={handleGetOnboardingLink}
                disabled={isLoading}
              >
                {isLoading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                Get New Onboarding Link
              </Button>
            </div>

            <div className="border-t pt-4">
              <p className="text-sm text-muted-foreground mb-3">
                After completing the Stripe onboarding, click below to verify:
              </p>
              <Button 
                variant="secondary" 
                className="w-full"
                onClick={handleCheckStatus}
                disabled={isPolling}
              >
                {isPolling ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                I've Completed Onboarding - Check Status
              </Button>
            </div>
          </div>
        );

      case 'success':
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
              <h3 className="text-lg font-semibold">Stripe Connect Active!</h3>
              <p className="text-muted-foreground mt-2">
                Your Stripe account is fully set up and ready to accept payments.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-sm">Charges Enabled</span>
                <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Active
                </Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <span className="text-sm">Payouts Enabled</span>
                <Badge className={company.stripe_payouts_enabled 
                  ? "bg-green-500/10 text-green-500 border-green-500/20" 
                  : "bg-amber-500/10 text-amber-500 border-amber-500/20"
                }>
                  {company.stripe_payouts_enabled ? (
                    <><CheckCircle2 className="w-3 h-3 mr-1" />Active</>
                  ) : (
                    <><AlertCircle className="w-3 h-3 mr-1" />Pending</>
                  )}
                </Badge>
              </div>
              {company.platform_fee_percentage && (
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <span className="text-sm">Platform Fee</span>
                  <span className="text-sm font-medium">{company.platform_fee_percentage}%</span>
                </div>
              )}
            </div>

            <div className="flex gap-3">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => window.open('https://dashboard.stripe.com', '_blank')}
              >
                <ExternalLink className="w-4 h-4 mr-2" />
                Stripe Dashboard
              </Button>
              <Button 
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                Done
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Stripe Connect Setup
            </DialogTitle>
            {currentStep !== 'intro' && currentStep !== 'success' && (
              <Badge variant="outline">
                Step {getStepNumber(currentStep)} of 5
              </Badge>
            )}
          </div>
          <DialogDescription className="sr-only">
            Set up Stripe Connect to accept online payments
          </DialogDescription>
        </DialogHeader>

        {currentStep !== 'intro' && currentStep !== 'success' && (
          <Progress value={getProgress()} className="h-1" />
        )}

        {renderStepContent()}
      </DialogContent>
    </Dialog>
  );
}
