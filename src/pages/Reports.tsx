import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DollarSign, Clock, BarChart3, Users } from 'lucide-react';
import TransactionsReport from '@/components/reports/TransactionsReport';
import TimesheetReportTab from '@/components/reports/TimesheetReportTab';
import MonthlySummaryReport from '@/components/reports/MonthlySummaryReport';
import CustomerRevenueReport from '@/components/reports/CustomerRevenueReport';

const Reports = () => {
  const [activeTab, setActiveTab] = useState('transactions');

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Reports</h1>
          <p className="text-muted-foreground">
            View and analyze your business data
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-flex">
            <TabsTrigger value="transactions" className="gap-2">
              <DollarSign className="w-4 h-4 hidden sm:inline" />
              Transactions
            </TabsTrigger>
            <TabsTrigger value="timesheets" className="gap-2">
              <Clock className="w-4 h-4 hidden sm:inline" />
              Timesheets
            </TabsTrigger>
            <TabsTrigger value="summary" className="gap-2">
              <BarChart3 className="w-4 h-4 hidden sm:inline" />
              Summary
            </TabsTrigger>
            <TabsTrigger value="customers" className="gap-2">
              <Users className="w-4 h-4 hidden sm:inline" />
              Customers
            </TabsTrigger>
          </TabsList>

          <TabsContent value="transactions" className="mt-6">
            <TransactionsReport />
          </TabsContent>

          <TabsContent value="timesheets" className="mt-6">
            <TimesheetReportTab />
          </TabsContent>

          <TabsContent value="summary" className="mt-6">
            <MonthlySummaryReport />
          </TabsContent>

          <TabsContent value="customers" className="mt-6">
            <CustomerRevenueReport />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Reports;
