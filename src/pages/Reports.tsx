import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DollarSign, Clock, BarChart3 } from 'lucide-react';
import TransactionsReport from '@/components/reports/TransactionsReport';
import TimesheetReportTab from '@/components/reports/TimesheetReportTab';
import MonthlySummaryReport from '@/components/reports/MonthlySummaryReport';

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
          <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-flex">
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
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Reports;
