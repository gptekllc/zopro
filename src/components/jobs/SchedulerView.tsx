import { useState, useCallback } from 'react';
import { Job, useUpdateJob } from '@/hooks/useJobs';
import UnassignedJobsSidebar from './UnassignedJobsSidebar';
import ResourceCalendar from './ResourceCalendar';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Menu, Users } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { addMinutes, parseISO } from 'date-fns';
import { toast } from 'sonner';

interface SchedulerViewProps {
  jobs: Job[];
  technicians: { id: string; full_name: string | null; email: string }[];
  onJobClick: (job: Job) => void;
}

export default function SchedulerView({ jobs, technicians, onJobClick }: SchedulerViewProps) {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const updateJob = useUpdateJob();

  // Handle drop on calendar from sidebar
  const handleCalendarDrop = useCallback(
    async (e: React.DragEvent, techId: string, slotStart: Date) => {
      e.preventDefault();
      
      try {
        const jobData = JSON.parse(e.dataTransfer.getData('application/json')) as Job;
        const duration = jobData.estimated_duration || 60;
        const newEnd = addMinutes(slotStart, duration);

        const techName = technicians.find(t => t.id === techId)?.full_name || 'technician';

        await updateJob.mutateAsync({
          id: jobData.id,
          assigned_to: techId,
          scheduled_start: slotStart.toISOString(),
          scheduled_end: newEnd.toISOString(),
          status: 'scheduled',
        });
        
        toast.success(`Job assigned to ${techName}`);
        setSidebarOpen(false);
      } catch (error) {
        // Invalid JSON or failed update
        console.error('Drop failed:', error);
      }
    },
    [technicians, updateJob]
  );

  // Count unassigned jobs for badge
  const unassignedCount = jobs.filter(job => {
    const isUnassigned = !job.assigned_to || !job.scheduled_start;
    const isNotArchived = !job.archived_at;
    const isNotCompleted = !['completed', 'invoiced', 'paid'].includes(job.status);
    return isUnassigned && isNotArchived && isNotCompleted;
  }).length;

  // Mobile layout with sheet
  if (isMobile) {
    return (
      <div className="flex flex-col h-[calc(100vh-12rem)]">
        {/* Mobile Sidebar Toggle */}
        <div className="flex items-center gap-2 p-2 border-b">
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Menu className="w-4 h-4" />
                Unassigned
                {unassignedCount > 0 && (
                  <span className="bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full text-xs">
                    {unassignedCount}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="p-0 w-80">
              <UnassignedJobsSidebar 
                jobs={jobs} 
                onJobClick={(job) => {
                  onJobClick(job);
                  setSidebarOpen(false);
                }} 
              />
            </SheetContent>
          </Sheet>
          
          <span className="text-sm text-muted-foreground">
            <Users className="w-4 h-4 inline mr-1" />
            {technicians.length} technicians
          </span>
        </div>

        {/* Calendar */}
        <div className="flex-1 min-h-0">
          <ResourceCalendar
            jobs={jobs}
            technicians={technicians}
            onJobClick={onJobClick}
          />
        </div>
      </div>
    );
  }

  // Desktop layout with sidebar
  return (
    <div className="flex h-[calc(100vh-12rem)] border rounded-lg overflow-hidden bg-background">
      {/* Sidebar - Fixed width */}
      <div className="w-72 shrink-0">
        <UnassignedJobsSidebar jobs={jobs} onJobClick={onJobClick} />
      </div>

      {/* Calendar - Flexible */}
      <div className="flex-1 min-w-0">
        <ResourceCalendar
          jobs={jobs}
          technicians={technicians}
          onJobClick={onJobClick}
        />
      </div>
    </div>
  );
}
