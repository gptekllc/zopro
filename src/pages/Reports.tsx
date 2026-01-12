import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DollarSign, Clock, BarChart3, Users, UserCheck, Lock } from 'lucide-react';
import TransactionsReport from '@/components/reports/TransactionsReport';
import TimesheetReportTab from '@/components/reports/TimesheetReportTab';
import MonthlySummaryReport from '@/components/reports/MonthlySummaryReport';
import CustomerRevenueReport from '@/components/reports/CustomerRevenueReport';
import TechnicianPerformanceReport from '@/components/reports/TechnicianPerformanceReport';
import { cn } from '@/lib/utils';
import PageContainer from '@/components/layout/PageContainer';
import { FeatureGate } from '@/components/FeatureGate';
import { usePermissions, PERMISSION_KEYS } from '@/hooks/usePermissions';
import { Card, CardContent } from '@/components/ui/card';

const Reports = () => {
  const { hasPermission, isLoading } = usePermissions();
  
  // Show permission denied for technicians
  if (!isLoading && !hasPermission(PERMISSION_KEYS.VIEW_REPORTS)) {
    return (
      <PageContainer className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md text-center">
          <CardContent className="pt-6 space-y-4">
            <Lock className="w-12 h-12 mx-auto text-muted-foreground" />
            <h2 className="text-xl font-semibold">Access Restricted</h2>
            <p className="text-muted-foreground">
              You don't have permission to view reports. Please contact your administrator for access.
            </p>
          </CardContent>
        </Card>
      </PageContainer>
    );
  }
  
  return (
    <FeatureGate feature="reports">
      <ReportsContent />
    </FeatureGate>
  );
};

const ReportsContent = () => {
  const [activeTab, setActiveTab] = useState('summary');
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <PageContainer className="space-y-6 lg:space-y-8">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div 
          className={cn(
            "sticky top-0 lg:top-0 z-10 bg-background pb-4 -mx-3 px-3 lg:-mx-6 lg:px-6 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 transition-shadow duration-200",
            isScrolled && "shadow-md border-b border-border"
          )}
        >
          <header>
            <h1 className="text-2xl sm:text-3xl font-bold">Reports</h1>
            <p className="text-muted-foreground mt-1 text-sm sm:text-base">
              View and analyze your business data
            </p>
          </header>

          <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-flex">
            <TabsTrigger value="summary" className="gap-2">
              <BarChart3 className="w-4 h-4 hidden sm:inline" />
              Summary
            </TabsTrigger>
            <TabsTrigger value="transactions" className="gap-2">
              <DollarSign className="w-4 h-4 hidden sm:inline" />
              <span className="hidden sm:inline">Transactions</span>
              <span className="sm:hidden">Trans</span>
            </TabsTrigger>
            <TabsTrigger value="timesheets" className="gap-2">
              <Clock className="w-4 h-4 hidden sm:inline" />
              <span className="hidden sm:inline">Timesheets</span>
              <span className="sm:hidden">Time</span>
            </TabsTrigger>
            <TabsTrigger value="customers" className="gap-2">
              <Users className="w-4 h-4 hidden sm:inline" />
              <span className="hidden sm:inline">Customers</span>
              <span className="sm:hidden">Cust</span>
            </TabsTrigger>
            <TabsTrigger value="team" className="gap-2">
              <UserCheck className="w-4 h-4 hidden sm:inline" />
              Team
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="summary" className="mt-6">
          <MonthlySummaryReport />
        </TabsContent>

        <TabsContent value="transactions" className="mt-6">
          <TransactionsReport />
        </TabsContent>

        <TabsContent value="timesheets" className="mt-6">
          <TimesheetReportTab />
        </TabsContent>

        <TabsContent value="customers" className="mt-6">
          <CustomerRevenueReport />
        </TabsContent>

        <TabsContent value="team" className="mt-6">
          <TechnicianPerformanceReport />
        </TabsContent>
      </Tabs>
    </PageContainer>
  );
};

export default Reports;
