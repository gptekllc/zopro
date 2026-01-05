import { useState } from 'react';
import AppLayout from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DollarSign, Clock, BarChart3 } from 'lucide-react';
import TransactionsReport from '@/components/reports/TransactionsReport';

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
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Clock className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">Timesheet Reports</h3>
              <p className="text-muted-foreground mt-1">
                Coming soon - View team timesheet summaries and exports
              </p>
            </div>
          </TabsContent>

          <TabsContent value="summary" className="mt-6">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <BarChart3 className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">Monthly Summary</h3>
              <p className="text-muted-foreground mt-1">
                Coming soon - Jobs, quotes, and revenue analytics
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default Reports;
