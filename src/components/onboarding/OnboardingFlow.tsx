import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import OnboardingChoice from './OnboardingChoice';
import CreateCompanyFlow from './CreateCompanyFlow';
import CustomerOnboardingFlow from './CustomerOnboardingFlow';
import { Loader2 } from 'lucide-react';

type OnboardingStep = 'loading' | 'choice' | 'create' | 'customer';

interface OnboardingFlowProps {
  onComplete: () => void;
}

const OnboardingFlow = ({ onComplete }: OnboardingFlowProps) => {
  const { profile, isLoading } = useAuth();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('choice');

  const handleComplete = () => {
    window.location.reload();
  };

  if (isLoading) {
    return (
      <div 
        className="min-h-screen flex items-center justify-center gradient-primary p-4"
        style={{
          paddingTop: 'var(--safe-area-top)',
          paddingBottom: 'var(--safe-area-bottom)',
        }}
      >
        <div className="flex items-center gap-2 text-primary-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  // If user already has a company, they shouldn't be here
  if (profile?.company_id) {
    window.location.href = '/dashboard';
    return null;
  }

  switch (currentStep) {
    case 'create':
      return (
        <CreateCompanyFlow 
          onBack={() => setCurrentStep('choice')} 
          onComplete={handleComplete} 
        />
      );
    case 'customer':
      return (
        <CustomerOnboardingFlow 
          onBack={() => setCurrentStep('choice')} 
          onComplete={handleComplete} 
        />
      );
    default:
      return (
        <OnboardingChoice
          onChooseCreateCompany={() => setCurrentStep('create')}
          onChooseContinueAsCustomer={() => setCurrentStep('customer')}
        />
      );
  }
};

export default OnboardingFlow;
