import AppLayout from '@/components/layout/AppLayout';
import TimesheetReportTab from '@/components/reports/TimesheetReportTab';

const TimesheetReport = () => {
  return (
    <AppLayout contentWidth="full">
      <div className="space-y-6 max-w-full">
        <div>
          <h1 className="text-2xl font-bold">Weekly Timesheet</h1>
          <p className="text-muted-foreground text-sm">
            Team hours overview — <a href="/reports" className="text-primary hover:underline">View all reports</a>
          </p>
        </div>
        <div className="w-full overflow-x-auto">
          <TimesheetReportTab />
        </div>
      </div>
    </AppLayout>
  );
};

export default TimesheetReport;