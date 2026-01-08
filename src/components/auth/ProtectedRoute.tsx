import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useCompany } from '@/hooks/useCompany';
import OnboardingFlow from '@/components/onboarding/OnboardingFlow';
import MFAChallenge from '@/components/auth/MFAChallenge';
import MFAEnrollment from '@/components/auth/MFAEnrollment';
import { useState } from 'react';

const ProtectedRoute = () => {
  const { user, profile, roles, isLoading, isSuperAdmin, needsMFAChallenge, hasMFA, refreshMFAStatus } = useAuth();
  const { data: company, isLoading: companyLoading } = useCompany();
  const [mfaVerified, setMfaVerified] = useState(false);
  const [mfaEnrolled, setMfaEnrolled] = useState(false);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  // Wait for profile to load before determining onboarding
  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading profile...</div>
      </div>
    );
  }

  // Check if user has customer role
  const hasCustomerRole = roles.some(r => r.role === 'customer');
  
  // Show onboarding for users without a company (except super admins and customers)
  const needsOnboarding = !profile.company_id && !isSuperAdmin && !hasCustomerRole;

  if (needsOnboarding) {
    return <OnboardingFlow onComplete={() => window.location.reload()} />;
  }

  // Wait for company to load if user has a company_id
  if (profile.company_id && companyLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  // MFA Challenge - user has MFA enrolled but needs to verify this session
  if (needsMFAChallenge && !mfaVerified) {
    return (
      <MFAChallenge 
        onVerified={() => {
          setMfaVerified(true);
          refreshMFAStatus();
        }} 
      />
    );
  }

  // MFA Enrollment Required - company requires MFA but user hasn't enrolled
  if (company?.require_mfa && !hasMFA && !isSuperAdmin && !hasCustomerRole && !mfaEnrolled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold">Security Requirement</h1>
            <p className="text-muted-foreground mt-2">
              Your organization requires two-factor authentication. Please set it up to continue.
            </p>
          </div>
          <MFAEnrollment 
            onComplete={() => {
              setMfaEnrolled(true);
              refreshMFAStatus();
            }} 
          />
        </div>
      </div>
    );
  }

  return <Outlet />;
};

export default ProtectedRoute;
