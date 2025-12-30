import { useState, useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import AppLayout from '@/components/layout/AppLayout';
import CompanyOnboarding from '@/components/onboarding/CompanyOnboarding';

const ProtectedRoute = () => {
  const { user, profile, isLoading, isSuperAdmin } = useAuth();
  const location = useLocation();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    // Show onboarding if user has no company and is not a super admin
    if (!isLoading && user && profile && !profile.company_id && !isSuperAdmin) {
      setShowOnboarding(true);
    } else {
      setShowOnboarding(false);
    }
  }, [isLoading, user, profile, isSuperAdmin]);

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

  // Show onboarding for users without a company (except super admins)
  if (showOnboarding) {
    return (
      <CompanyOnboarding 
        onComplete={() => {
          // Refresh the page to reload profile data
          window.location.reload();
        }} 
      />
    );
  }

  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
};

export default ProtectedRoute;
