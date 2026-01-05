import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Customers from "./pages/Customers";
import CustomerDetail from "./pages/CustomerDetail";
import Jobs from "./pages/Jobs";
import JobTemplates from "./pages/JobTemplates";
import Templates from "./pages/Templates";
import Catalog from "./pages/Catalog";
import Quotes from "./pages/Quotes";
import Invoices from "./pages/Invoices";
import TimeClock from "./pages/TimeClock";
import TimesheetReport from "./pages/TimesheetReport";
import Technicians from "./pages/Technicians";
import Company from "./pages/Company";
import Settings from "./pages/Settings";
import Profile from "./pages/Profile";
import SuperAdmin from "./pages/SuperAdmin";
import CustomerPortal from "./pages/CustomerPortal";
import Notifications from "./pages/Notifications";
import StripeConnectReturn from "./pages/StripeConnectReturn";
import StripeConnectRefresh from "./pages/StripeConnectRefresh";
import NotFound from "./pages/NotFound";
import ProtectedRoute from "./components/auth/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/customer-portal" element={<CustomerPortal />} />

            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/customers" element={<Customers />} />
              <Route path="/customers/:customerId" element={<CustomerDetail />} />
              <Route path="/jobs" element={<Jobs />} />
              <Route path="/jobs/templates" element={<JobTemplates />} />
              <Route path="/templates" element={<Templates />} />
              <Route path="/catalog" element={<Catalog />} />
              <Route path="/quotes" element={<Quotes />} />
              <Route path="/invoices" element={<Invoices />} />
              <Route path="/timeclock" element={<TimeClock />} />
              <Route path="/timesheet" element={<TimesheetReport />} />
              <Route path="/technicians" element={<Technicians />} />
              <Route path="/company" element={<Company />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/super-admin" element={<SuperAdmin />} />
              <Route path="/stripe-connect/return" element={<StripeConnectReturn />} />
              <Route path="/stripe-connect/refresh" element={<StripeConnectRefresh />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
