import { useState, useMemo, DragEvent } from 'react';
import { Job, useUpdateJob } from '@/hooks/useJobs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, GripVertical } from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, addMonths, subMonths, isToday, parseISO, setHours, setMinutes } from 'date-fns';
import { toast } from 'sonner';

interface JobCalendarProps {
  jobs: Job[];
  onJobClick: (job: Job) => void;
}

const JobCalendar = ({ jobs, onJobClick }: JobCalendarProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [draggedJob, setDraggedJob] = useState<Job | null>(null);
  const [dropTargetDate, setDropTargetDate] = useState<string | null>(null);
  const updateJob = useUpdateJob();

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const jobsByDate = useMemo(() => {
    const map = new Map<string, Job[]>();
    jobs.forEach(job => {
      if (job.scheduled_start) {
        const dateKey = format(parseISO(job.scheduled_start), 'yyyy-MM-dd');
        if (!map.has(dateKey)) {
          map.set(dateKey, []);
        }
        map.get(dateKey)!.push(job);
      }
    });
    return map;
  }, [jobs]);

  const getStatusColor = (status: Job['status']) => {
    switch (status) {
      case 'draft': return 'bg-muted text-muted-foreground';
      case 'scheduled': return 'bg-blue-500 text-white';
      case 'in_progress': return 'bg-warning text-warning-foreground';
      case 'completed': return 'bg-success text-white';
      case 'invoiced': return 'bg-primary text-primary-foreground';
      case 'paid': return 'bg-success text-white';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getPriorityBorder = (priority: Job['priority']) => {
    switch (priority) {
      case 'urgent': return 'border-l-4 border-l-destructive';
      case 'high': return 'border-l-4 border-l-warning';
      default: return '';
    }
  };

  const handleDragStart = (e: DragEvent<HTMLDivElement>, job: Job) => {
    setDraggedJob(job);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', job.id);
  };

  const handleDragEnd = () => {
    setDraggedJob(null);
    setDropTargetDate(null);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>, dateKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTargetDate(dateKey);
  };

  const handleDragLeave = () => {
    setDropTargetDate(null);
  };

  const handleDrop = async (e: DragEvent<HTMLDivElement>, targetDate: Date) => {
    e.preventDefault();
    setDropTargetDate(null);

    if (!draggedJob) return;

    // Preserve the original time if it exists
    let newScheduledStart: Date;
    let newScheduledEnd: Date | null = null;

    if (draggedJob.scheduled_start) {
      const originalStart = parseISO(draggedJob.scheduled_start);
      newScheduledStart = setMinutes(
        setHours(targetDate, originalStart.getHours()),
        originalStart.getMinutes()
      );

      if (draggedJob.scheduled_end) {
        const originalEnd = parseISO(draggedJob.scheduled_end);
        const durationMs = originalEnd.getTime() - originalStart.getTime();
        newScheduledEnd = new Date(newScheduledStart.getTime() + durationMs);
      }
    } else {
      // Default to 9 AM if no time was set
      newScheduledStart = setMinutes(setHours(targetDate, 9), 0);
    }

    try {
      await updateJob.mutateAsync({
        id: draggedJob.id,
        scheduled_start: newScheduledStart.toISOString(),
        scheduled_end: newScheduledEnd?.toISOString() || null,
      });
      toast.success(`Job ${draggedJob.job_number} rescheduled to ${format(targetDate, 'MMM d')}`);
    } catch (error) {
      toast.error('Failed to reschedule job');
    }

    setDraggedJob(null);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5" />
            {format(currentDate, 'MMMM yyyy')}
          </CardTitle>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentDate(subMonths(currentDate, 1))}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentDate(new Date())}
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentDate(addMonths(currentDate, 1))}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Drag and drop jobs to reschedule them
        </p>
      </CardHeader>
      <CardContent>
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {days.map(day => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const dayJobs = jobsByDate.get(dateKey) || [];
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isDropTarget = dropTargetDate === dateKey;

            return (
              <div
                key={dateKey}
                className={`min-h-[100px] p-1 rounded-md border transition-colors ${
                  isDropTarget
                    ? 'bg-primary/20 border-primary border-2'
                    : isToday(day) 
                      ? 'bg-primary/5 border-primary' 
                      : isCurrentMonth 
                        ? 'bg-card border-border' 
                        : 'bg-muted/30 border-transparent'
                }`}
                onDragOver={(e) => handleDragOver(e, dateKey)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, day)}
              >
                <div className={`text-sm font-medium mb-1 ${
                  isToday(day) 
                    ? 'text-primary' 
                    : isCurrentMonth 
                      ? 'text-foreground' 
                      : 'text-muted-foreground'
                }`}>
                  {format(day, 'd')}
                </div>
                <div className="space-y-1 overflow-hidden max-h-[80px]">
                  {dayJobs.slice(0, 3).map(job => (
                    <div
                      key={job.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, job)}
                      onDragEnd={handleDragEnd}
                      onClick={() => onJobClick(job)}
                      className={`text-xs p-1 rounded cursor-grab hover:opacity-80 transition-opacity truncate flex items-center gap-1 ${getStatusColor(job.status)} ${getPriorityBorder(job.priority)} ${
                        draggedJob?.id === job.id ? 'opacity-50' : ''
                      }`}
                      title={`${job.job_number}: ${job.title} (Drag to reschedule)`}
                    >
                      <GripVertical className="w-3 h-3 flex-shrink-0 opacity-50" />
                      <span className="truncate">
                        {job.scheduled_start && (
                          <span className="font-medium">
                            {format(parseISO(job.scheduled_start), 'HH:mm')}
                          </span>
                        )}{' '}
                        {job.title}
                      </span>
                    </div>
                  ))}
                  {dayJobs.length > 3 && (
                    <div className="text-xs text-muted-foreground text-center">
                      +{dayJobs.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-blue-500" />
            <span>Scheduled</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-warning" />
            <span>In Progress</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-success" />
            <span>Completed</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded border-l-4 border-l-destructive" />
            <span>Urgent</span>
          </div>
          <div className="flex items-center gap-1 ml-auto">
            <GripVertical className="w-3 h-3" />
            <span className="text-muted-foreground">Drag to reschedule</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default JobCalendar;