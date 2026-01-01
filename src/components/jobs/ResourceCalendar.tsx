import { useState, useMemo, useCallback } from 'react';
import { Calendar, dateFnsLocalizer, Views, SlotInfo } from 'react-big-calendar';
import withDragAndDrop, { withDragAndDropProps } from 'react-big-calendar/lib/addons/dragAndDrop';
import { format, parse, startOfWeek, getDay, addMinutes, parseISO, differenceInMinutes } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { Job, useUpdateJob } from '@/hooks/useJobs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

import 'react-big-calendar/lib/css/react-big-calendar.css';
import 'react-big-calendar/lib/addons/dragAndDrop/styles.css';

const locales = { 'en-US': enUS };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }),
  getDay,
  locales,
});

const DnDCalendar = withDragAndDrop(Calendar);

interface CalendarEvent {
  id: string;
  title: string;
  start: Date;
  end: Date;
  resourceId: string;
  job: Job;
}

interface Resource {
  id: string;
  title: string;
}

interface ResourceCalendarProps {
  jobs: Job[];
  technicians: { id: string; full_name: string | null; email: string }[];
  onJobClick: (job: Job) => void;
  onSlotSelect?: (technicianId: string, start: Date, end: Date) => void;
}

export default function ResourceCalendar({ 
  jobs, 
  technicians, 
  onJobClick,
  onSlotSelect 
}: ResourceCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<'day' | 'week'>(Views.DAY as 'day' | 'week');
  const updateJob = useUpdateJob();

  // Create resources (technicians as columns)
  const resources: Resource[] = useMemo(() => {
    return technicians.map(tech => ({
      id: tech.id,
      title: tech.full_name || tech.email,
    }));
  }, [technicians]);

  // Convert jobs to calendar events
  const events: CalendarEvent[] = useMemo(() => {
    return jobs
      .filter(job => job.scheduled_start && job.assigned_to && !job.archived_at)
      .map(job => {
        const start = parseISO(job.scheduled_start!);
        const end = job.scheduled_end 
          ? parseISO(job.scheduled_end)
          : addMinutes(start, job.estimated_duration || 60);
        
        return {
          id: job.id,
          title: `${job.job_number} - ${job.title}`,
          start,
          end,
          resourceId: job.assigned_to!,
          job,
        };
      });
  }, [jobs]);

  // Check for conflicts
  const checkConflict = useCallback((
    techId: string,
    newStart: Date,
    newEnd: Date,
    excludeJobId?: string
  ): boolean => {
    const techEvents = events.filter(e => 
      e.resourceId === techId && 
      e.id !== excludeJobId
    );

    return techEvents.some(event => {
      return (newStart < event.end && newEnd > event.start);
    });
  }, [events]);

  // Handle event drop (reschedule/reassign)
  const handleEventDrop: withDragAndDropProps<CalendarEvent, Resource>['onEventDrop'] = useCallback(
    async ({ event, start, end, resourceId }) => {
      const newStart = start as Date;
      const newEnd = end as Date;
      const newResourceId = resourceId as string;

      // Check for conflicts
      if (checkConflict(newResourceId, newStart, newEnd, event.id)) {
        toast.error('This technician already has a job scheduled at this time');
        return;
      }

      const techName = resources.find(r => r.id === newResourceId)?.title || 'technician';

      try {
        await updateJob.mutateAsync({
          id: event.id,
          assigned_to: newResourceId,
          scheduled_start: newStart.toISOString(),
          scheduled_end: newEnd.toISOString(),
          status: event.job.status === 'draft' ? 'scheduled' : event.job.status,
        });
        toast.success(`Job moved to ${techName} at ${format(newStart, 'h:mm a')}`);
      } catch (error) {
        toast.error('Failed to update job');
      }
    },
    [checkConflict, resources, updateJob]
  );

  // Handle event resize (duration change)
  const handleEventResize: withDragAndDropProps<CalendarEvent, Resource>['onEventResize'] = useCallback(
    async ({ event, start, end }) => {
      const newStart = start as Date;
      const newEnd = end as Date;

      // Check for conflicts when extending
      if (checkConflict(event.resourceId, newStart, newEnd, event.id)) {
        toast.error('Cannot extend - conflicts with another job');
        return;
      }

      const durationMinutes = differenceInMinutes(newEnd, newStart);

      try {
        await updateJob.mutateAsync({
          id: event.id,
          scheduled_start: newStart.toISOString(),
          scheduled_end: newEnd.toISOString(),
          estimated_duration: durationMinutes,
        });
        toast.success(`Duration updated to ${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`);
      } catch (error) {
        toast.error('Failed to update duration');
      }
    },
    [checkConflict, updateJob]
  );

  // Handle drop from sidebar
  const handleDropFromOutside = useCallback(
    async ({ start, end, resource }: { start: Date; end: Date; resource?: string }) => {
      // This is triggered when dropping from external source
      // The actual data comes from the draggedEvent which we need to get from a data transfer
    },
    []
  );

  // Handle drag over for external drops
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  // Custom drop handler for external jobs
  const handleExternalDrop = useCallback(
    async (e: React.DragEvent, techId: string, slotStart: Date) => {
      e.preventDefault();
      
      try {
        const jobData = JSON.parse(e.dataTransfer.getData('application/json')) as Job;
        const duration = jobData.estimated_duration || 60;
        const newEnd = addMinutes(slotStart, duration);

        // Check for conflicts
        if (checkConflict(techId, slotStart, newEnd)) {
          toast.error('This technician already has a job scheduled at this time');
          return;
        }

        const techName = resources.find(r => r.id === techId)?.title || 'technician';

        await updateJob.mutateAsync({
          id: jobData.id,
          assigned_to: techId,
          scheduled_start: slotStart.toISOString(),
          scheduled_end: newEnd.toISOString(),
          status: 'scheduled',
        });
        
        toast.success(`Job assigned to ${techName} at ${format(slotStart, 'h:mm a')}`);
      } catch (error) {
        // Invalid JSON or failed update
        console.error('Drop failed:', error);
      }
    },
    [checkConflict, resources, updateJob]
  );

  // Handle slot selection (click on empty slot)
  const handleSelectSlot = useCallback((slotInfo: SlotInfo) => {
    if (onSlotSelect && slotInfo.resourceId) {
      onSlotSelect(
        slotInfo.resourceId as string,
        slotInfo.start,
        slotInfo.end
      );
    }
  }, [onSlotSelect]);

  // Get status color
  const getStatusColor = (status: Job['status']) => {
    switch (status) {
      case 'draft': return 'hsl(var(--muted))';
      case 'scheduled': return 'hsl(217, 91%, 55%)'; // blue
      case 'in_progress': return 'hsl(38, 92%, 50%)'; // yellow/warning
      case 'completed': return 'hsl(142, 76%, 36%)'; // green
      case 'invoiced': return 'hsl(280, 85%, 60%)'; // purple
      case 'paid': return 'hsl(142, 76%, 36%)'; // green
      default: return 'hsl(var(--muted))';
    }
  };

  // Custom event component
  const EventComponent = ({ event }: { event: CalendarEvent }) => {
    const job = event.job;
    const isUrgent = job.priority === 'urgent';
    const isHigh = job.priority === 'high';

    return (
      <div
        className={`
          h-full p-1 overflow-hidden rounded text-xs cursor-pointer
          ${isUrgent ? 'ring-2 ring-destructive' : ''}
          ${isHigh ? 'ring-1 ring-warning' : ''}
        `}
        style={{ backgroundColor: getStatusColor(job.status) }}
        onClick={(e) => {
          e.stopPropagation();
          onJobClick(job);
        }}
      >
        <div className="text-white font-medium truncate flex items-center gap-1">
          {isUrgent && <AlertTriangle className="w-3 h-3 shrink-0" />}
          {job.job_number}
        </div>
        <div className="text-white/80 truncate">{job.title}</div>
        <div className="text-white/70 truncate">{job.customer?.name}</div>
      </div>
    );
  };

  // Navigation
  const navigateDate = (direction: 'prev' | 'next' | 'today') => {
    if (direction === 'today') {
      setCurrentDate(new Date());
    } else {
      const days = view === 'week' ? 7 : 1;
      const newDate = new Date(currentDate);
      newDate.setDate(newDate.getDate() + (direction === 'next' ? days : -days));
      setCurrentDate(newDate);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between p-4 border-b bg-card">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigateDate('prev')}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => navigateDate('next')}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigateDate('today')}>
            Today
          </Button>
          <h2 className="font-semibold ml-2">
            {view === 'week' 
              ? `Week of ${format(currentDate, 'MMM d, yyyy')}`
              : format(currentDate, 'EEEE, MMMM d, yyyy')
            }
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex gap-1 border rounded-md p-1">
            <Button
              variant={view === 'day' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setView('day')}
            >
              Day
            </Button>
            <Button
              variant={view === 'week' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setView('week')}
            >
              Week
            </Button>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2 border-b bg-muted/30 text-xs">
        <span className="text-muted-foreground">Status:</span>
        <Badge variant="outline" className="bg-[hsl(217,91%,55%)] text-white border-0">Scheduled</Badge>
        <Badge variant="outline" className="bg-[hsl(38,92%,50%)] text-white border-0">In Progress</Badge>
        <Badge variant="outline" className="bg-[hsl(142,76%,36%)] text-white border-0">Completed</Badge>
        <span className="ml-4 text-muted-foreground">Priority:</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full ring-2 ring-destructive" /> Urgent</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full ring-1 ring-warning" /> High</span>
      </div>

      {/* Calendar */}
      <div className="flex-1 p-4 overflow-hidden">
        <DnDCalendar
          localizer={localizer}
          events={events}
          resources={resources}
          resourceIdAccessor="id"
          resourceTitleAccessor="title"
          startAccessor="start"
          endAccessor="end"
          date={currentDate}
          onNavigate={setCurrentDate}
          view={view}
          onView={(v) => setView(v as 'day' | 'week')}
          views={['day', 'week']}
          min={new Date(1970, 0, 1, 6, 0, 0)} // 6 AM
          max={new Date(1970, 0, 1, 20, 0, 0)} // 8 PM
          step={15} // 15 minute slots
          timeslots={4} // 4 slots per hour (15 min each)
          onEventDrop={handleEventDrop}
          onEventResize={handleEventResize}
          onSelectSlot={handleSelectSlot}
          selectable
          resizable
          draggableAccessor={() => true}
          components={{
            event: EventComponent,
          }}
          eventPropGetter={(event) => ({
            style: {
              backgroundColor: getStatusColor(event.job.status),
              border: 'none',
              borderRadius: '4px',
            },
          })}
          dayLayoutAlgorithm="no-overlap"
          style={{ height: '100%' }}
        />
      </div>
    </div>
  );
}
