import { Navigate, Outlet } from 'react-router-dom';
import { useStore } from '@/store/useStore';
import AppLayout from '@/components/layout/AppLayout';

const ProtectedRoute = () => {
  const isAuthenticated = useStore((state) => state.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
};

export default ProtectedRoute;
