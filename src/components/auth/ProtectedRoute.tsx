import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import OnboardingFlow from '@/components/onboarding/OnboardingFlow';


const ProtectedRoute = () => {
  const { user, profile, roles, isLoading, isSuperAdmin } = useAuth();

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

  return <Outlet />;
};

export default ProtectedRoute;
