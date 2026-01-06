import TimesheetReportTab from '@/components/reports/TimesheetReportTab';
import { Link } from 'react-router-dom';

const TimesheetReport = () => {
  return (
    <div className="space-y-6 max-w-full">
      <div>
        <h1 className="text-2xl font-bold">Weekly Timesheet</h1>
        <p className="text-muted-foreground text-sm">
          Team hours overview — <Link to="/reports" className="text-primary hover:underline">View all reports</Link>
        </p>
      </div>
      <div className="w-full overflow-x-auto">
        <TimesheetReportTab />
      </div>
    </div>
  );
};

export default TimesheetReport;