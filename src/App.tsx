import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Outlet, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import AppLayout from "@/components/layout/AppLayout";
import Login from "./pages/Login";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import SmsTerms from "./pages/SmsTerms";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Customers from "./pages/Customers";
import CustomerDetail from "./pages/CustomerDetail";
import Jobs from "./pages/Jobs";
import JobTemplates from "./pages/JobTemplates";
import Templates from "./pages/Templates";
import Items from "./pages/Items";
import Quotes from "./pages/Quotes";
import Invoices from "./pages/Invoices";
import TimeClock from "./pages/TimeClock";
import TimesheetReport from "./pages/TimesheetReport";
import Reports from "./pages/Reports";
import Technicians from "./pages/Technicians";
import Company from "./pages/Company";
import Settings from "./pages/Settings";
import SecuritySettings from "./pages/SecuritySettings";
import Profile from "./pages/Profile";
import SuperAdmin from "./pages/SuperAdmin";
import CustomerPortal from "./pages/CustomerPortal";
import Notifications from "./pages/Notifications";
import Alerts from "./pages/Alerts";
import Subscription from "./pages/Subscription";
import StripeConnectReturn from "./pages/StripeConnectReturn";
import StripeConnectRefresh from "./pages/StripeConnectRefresh";
import PayPalConnectReturn from "./pages/PayPalConnectReturn";
import SquareConnectReturn from "./pages/SquareConnectReturn";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import ScrollToTop from "./components/layout/ScrollToTop";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
    },
  },
});

const AuthedLayout = () => (
  <AppLayout>
    <Outlet />
  </AppLayout>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <ScrollToTop />
            <Routes>
              <Route path="/" element={<Login />} />
              <Route path="/login" element={<Login />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/sms-terms" element={<SmsTerms />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/customer-portal" element={<CustomerPortal />} />
              <Route path="/portal" element={<Navigate to="/customer-portal" replace />} />

              <Route element={<ProtectedRoute />}>
                <Route element={<AuthedLayout />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/customers" element={<Customers />} />
                  <Route path="/customers/:customerId" element={<CustomerDetail />} />
                  <Route path="/jobs" element={<Jobs />} />
                  <Route path="/jobs/templates" element={<JobTemplates />} />
                  <Route path="/templates" element={<Templates />} />
                  <Route path="/items" element={<Items />} />
                  <Route path="/quotes" element={<Quotes />} />
                  <Route path="/invoices" element={<Invoices />} />
                  <Route path="/timeclock" element={<TimeClock />} />
                  <Route path="/timesheet" element={<TimesheetReport />} />
                  <Route path="/reports" element={<Reports />} />
                  <Route path="/technicians" element={<Technicians />} />
                  <Route path="/company" element={<Company />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="/settings/security" element={<SecuritySettings />} />
                  <Route path="/security-settings" element={<SecuritySettings />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/notifications" element={<Notifications />} />
                  <Route path="/alerts" element={<Alerts />} />
                  <Route path="/subscription" element={<Subscription />} />
                  <Route path="/super-admin" element={<SuperAdmin />} />
                  <Route path="/stripe-connect/return" element={<StripeConnectReturn />} />
                  <Route path="/stripe-connect/refresh" element={<StripeConnectRefresh />} />
                  <Route path="/paypal-connect/return" element={<PayPalConnectReturn />} />
                  <Route path="/square-connect/return" element={<SquareConnectReturn />} />
                </Route>
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
