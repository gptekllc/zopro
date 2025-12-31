import { useState } from 'react';
import OnboardingChoice from './OnboardingChoice';
import CreateCompanyFlow from './CreateCompanyFlow';
import JoinCompanyFlow from './JoinCompanyFlow';
import CustomerOnboardingFlow from './CustomerOnboardingFlow';

type OnboardingStep = 'choice' | 'create' | 'join' | 'customer';

interface OnboardingFlowProps {
  onComplete: () => void;
}

const OnboardingFlow = ({ onComplete }: OnboardingFlowProps) => {
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('choice');

  const handleComplete = () => {
    window.location.reload();
  };

  switch (currentStep) {
    case 'create':
      return (
        <CreateCompanyFlow 
          onBack={() => setCurrentStep('choice')} 
          onComplete={handleComplete} 
        />
      );
    case 'join':
      return (
        <JoinCompanyFlow 
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
          onChooseJoinCompany={() => setCurrentStep('join')}
          onChooseContinueAsCustomer={() => setCurrentStep('customer')}
        />
      );
  }
};

export default OnboardingFlow;
