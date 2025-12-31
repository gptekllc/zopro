import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import OnboardingChoice from './OnboardingChoice';
import CreateCompanyFlow from './CreateCompanyFlow';
import JoinCompanyFlow from './JoinCompanyFlow';
import CustomerOnboardingFlow from './CustomerOnboardingFlow';
import PendingRequestView from './PendingRequestView';
import { Loader2 } from 'lucide-react';

type OnboardingStep = 'loading' | 'pending' | 'choice' | 'create' | 'join' | 'customer';

interface OnboardingFlowProps {
  onComplete: () => void;
}

const OnboardingFlow = ({ onComplete }: OnboardingFlowProps) => {
  const { user, profile } = useAuth();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>('loading');

  // Check for existing pending/approved join request
  const { data: existingRequest, isLoading } = useQuery({
    queryKey: ['my-join-request-check', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      
      const { data, error } = await (supabase as any)
        .from('join_requests')
        .select('*, companies(name)')
        .eq('user_id', user.id)
        .in('status', ['pending', 'approved'])
        .order('requested_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (isLoading) {
      setCurrentStep('loading');
      return;
    }

    // If user was approved but profile hasn't updated yet, reload
    if (existingRequest?.status === 'approved' && !profile?.company_id) {
      // The approval has happened but profile hasn't caught up - show pending view which will reload
      setCurrentStep('pending');
      return;
    }

    // If there's a pending request, show the pending view
    if (existingRequest?.status === 'pending') {
      setCurrentStep('pending');
      return;
    }

    // Otherwise show the choice screen
    setCurrentStep('choice');
  }, [isLoading, existingRequest, profile?.company_id]);

  const handleComplete = () => {
    window.location.reload();
  };

  if (currentStep === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center gradient-primary p-4">
        <div className="flex items-center gap-2 text-primary-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  switch (currentStep) {
    case 'pending':
      return (
        <PendingRequestView 
          onStartNew={() => setCurrentStep('choice')} 
        />
      );
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
