import TimesheetReportTab from '@/components/reports/TimesheetReportTab';
import { Link } from 'react-router-dom';
import PageContainer from '@/components/layout/PageContainer';

const TimesheetReport = () => {
  return (
    <PageContainer width="full" className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold">Weekly Timesheet</h1>
        <p className="text-muted-foreground text-sm">
          Team hours overview — <Link to="/reports" className="text-primary hover:underline">View all reports</Link>
        </p>
      </div>
      <div className="w-full overflow-x-auto">
        <TimesheetReportTab />
      </div>
    </PageContainer>
  );
};

export default TimesheetReport;