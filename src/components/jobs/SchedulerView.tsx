import { Job } from '@/hooks/useJobs';
import ResourceCalendar from './ResourceCalendar';

interface SchedulerViewProps {
  jobs: Job[];
  technicians: { id: string; full_name: string | null; email: string; employment_status?: string | null }[];
  onJobClick: (job: Job) => void;
  onSlotSelect?: (technicianId: string, start: Date, end: Date) => void;
}

export default function SchedulerView({ jobs, technicians, onJobClick, onSlotSelect }: SchedulerViewProps) {
  // Filter out technicians on leave
  const availableTechnicians = technicians.filter(t => t.employment_status !== 'on_leave');

  return (
    <div className="h-[calc(100vh-12rem)] border rounded-lg overflow-hidden bg-background">
      <ResourceCalendar
        jobs={jobs}
        technicians={availableTechnicians}
        onJobClick={onJobClick}
        onSlotSelect={onSlotSelect}
      />
    </div>
  );
}
