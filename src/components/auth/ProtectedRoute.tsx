import { useState, useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import OnboardingFlow from '@/components/onboarding/OnboardingFlow';

const ProtectedRoute = () => {
  const { user, profile, roles, isLoading, isSuperAdmin } = useAuth();
  const location = useLocation();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    // Show onboarding if user has no company, is not a super admin, and doesn't have customer role
    const hasCustomerRole = roles.some(r => (r.role as string) === 'customer');
    if (!isLoading && user && profile && !profile.company_id && !isSuperAdmin && !hasCustomerRole) {
      setShowOnboarding(true);
    } else {
      setShowOnboarding(false);
    }
  }, [isLoading, user, profile, roles, isSuperAdmin]);

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

  // Show onboarding for users without a company (except super admins and customers)
  if (showOnboarding) {
    return <OnboardingFlow onComplete={() => window.location.reload()} />;
  }

  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
};

export default ProtectedRoute;
