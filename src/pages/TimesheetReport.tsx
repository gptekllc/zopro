import AppLayout from '@/components/layout/AppLayout';
import TimesheetReportTab from '@/components/reports/TimesheetReportTab';

// Legacy route - works standalone but links to Reports page
const TimesheetReport = () => {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Weekly Timesheet</h1>
          <p className="text-muted-foreground">
            Team hours overview - <a href="/reports" className="text-primary hover:underline">View all reports</a>
          </p>
        </div>
        <TimesheetReportTab />
      </div>
    </AppLayout>
  );
};

export default TimesheetReport;
