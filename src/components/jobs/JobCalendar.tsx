import { useState, useMemo, DragEvent } from 'react';
import { Job, useUpdateJob } from '@/hooks/useJobs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, GripVertical } from 'lucide-react';
import { 
  format, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay,
  addMonths, 
  subMonths, 
  addWeeks,
  subWeeks,
  addDays,
  subDays,
  isToday, 
  parseISO, 
  setHours, 
  setMinutes,
  eachHourOfInterval,
  startOfDay,
  endOfDay
} from 'date-fns';
import { toast } from 'sonner';

type CalendarView = 'month' | 'week' | 'day';

interface JobCalendarProps {
  jobs: Job[];
  onJobClick: (job: Job) => void;
  onSlotClick?: (date: Date) => void;
}

const JobCalendar = ({ jobs, onJobClick, onSlotClick }: JobCalendarProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>('month');
  const [draggedJob, setDraggedJob] = useState<Job | null>(null);
  const [dropTargetDate, setDropTargetDate] = useState<string | null>(null);
  const updateJob = useUpdateJob();

  // Calculate date ranges based on view
  const { days, hours } = useMemo(() => {
    if (view === 'month') {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
      const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
      return { 
        days: eachDayOfInterval({ start: calendarStart, end: calendarEnd }),
        hours: []
      };
    } else if (view === 'week') {
      const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
      const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
      return { 
        days: eachDayOfInterval({ start: weekStart, end: weekEnd }),
        hours: eachHourOfInterval({ start: setHours(new Date(), 6), end: setHours(new Date(), 20) })
      };
    } else {
      // Day view
      const dayStart = startOfDay(currentDate);
      return { 
        days: [dayStart],
        hours: eachHourOfInterval({ start: setHours(dayStart, 6), end: setHours(dayStart, 20) })
      };
    }
  }, [currentDate, view]);

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

  // Get jobs for a specific hour on a day
  const getJobsForHour = (day: Date, hour: number) => {
    const dateKey = format(day, 'yyyy-MM-dd');
    const dayJobs = jobsByDate.get(dateKey) || [];
    return dayJobs.filter(job => {
      if (!job.scheduled_start) return false;
      const jobHour = parseISO(job.scheduled_start).getHours();
      return jobHour === hour;
    });
  };

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

  const handleDrop = async (e: DragEvent<HTMLDivElement>, targetDate: Date, targetHour?: number) => {
    e.preventDefault();
    setDropTargetDate(null);

    if (!draggedJob) return;

    let newScheduledStart: Date;
    let newScheduledEnd: Date | null = null;

    if (targetHour !== undefined) {
      // Dropping on a specific hour slot
      newScheduledStart = setMinutes(setHours(targetDate, targetHour), 0);
      if (draggedJob.scheduled_start && draggedJob.scheduled_end) {
        const originalStart = parseISO(draggedJob.scheduled_start);
        const originalEnd = parseISO(draggedJob.scheduled_end);
        const durationMs = originalEnd.getTime() - originalStart.getTime();
        newScheduledEnd = new Date(newScheduledStart.getTime() + durationMs);
      }
    } else if (draggedJob.scheduled_start) {
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
      newScheduledStart = setMinutes(setHours(targetDate, 9), 0);
    }

    try {
      await updateJob.mutateAsync({
        id: draggedJob.id,
        scheduled_start: newScheduledStart.toISOString(),
        scheduled_end: newScheduledEnd?.toISOString() || null,
      });
      toast.success(`Job ${draggedJob.job_number} rescheduled to ${format(newScheduledStart, 'MMM d, h:mm a')}`);
    } catch (error) {
      toast.error('Failed to reschedule job');
    }

    setDraggedJob(null);
  };

  const handleSlotClick = (day: Date, hour?: number) => {
    if (!onSlotClick) return;
    
    let clickedDate = day;
    if (hour !== undefined) {
      clickedDate = setMinutes(setHours(day, hour), 0);
    } else {
      // Default to 9 AM for month view clicks
      clickedDate = setMinutes(setHours(day, 9), 0);
    }
    onSlotClick(clickedDate);
  };

  // Navigation
  const navigateDate = (direction: 'prev' | 'next' | 'today') => {
    if (direction === 'today') {
      setCurrentDate(new Date());
    } else {
      if (view === 'month') {
        setCurrentDate(direction === 'next' ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
      } else if (view === 'week') {
        setCurrentDate(direction === 'next' ? addWeeks(currentDate, 1) : subWeeks(currentDate, 1));
      } else {
        setCurrentDate(direction === 'next' ? addDays(currentDate, 1) : subDays(currentDate, 1));
      }
    }
  };

  const getHeaderTitle = () => {
    if (view === 'month') return format(currentDate, 'MMMM yyyy');
    if (view === 'week') return `Week of ${format(days[0], 'MMM d')} - ${format(days[days.length - 1], 'MMM d, yyyy')}`;
    return format(currentDate, 'EEEE, MMMM d, yyyy');
  };

  // Render job item
  const renderJobItem = (job: Job, showTime = true) => (
    <div
      key={job.id}
      draggable
      onDragStart={(e) => handleDragStart(e, job)}
      onDragEnd={handleDragEnd}
      onClick={(e) => {
        e.stopPropagation();
        onJobClick(job);
      }}
      className={`text-xs p-1 rounded cursor-grab hover:opacity-80 transition-opacity truncate flex items-center gap-1 ${getStatusColor(job.status)} ${getPriorityBorder(job.priority)} ${
        draggedJob?.id === job.id ? 'opacity-50' : ''
      }`}
      title={`${job.job_number}: ${job.title} (Drag to reschedule)`}
    >
      <GripVertical className="w-3 h-3 flex-shrink-0 opacity-50" />
      <span className="truncate">
        {showTime && job.scheduled_start && (
          <span className="font-medium">
            {format(parseISO(job.scheduled_start), 'HH:mm')}
          </span>
        )}{' '}
        {job.title}
      </span>
    </div>
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2">
            <CalendarIcon className="w-5 h-5" />
            {getHeaderTitle()}
          </CardTitle>
          <div className="flex items-center gap-2">
            {/* View Toggle */}
            <div className="flex gap-1 border rounded-md p-1">
              <Button
                variant={view === 'month' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setView('month')}
              >
                Month
              </Button>
              <Button
                variant={view === 'week' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setView('week')}
              >
                Week
              </Button>
              <Button
                variant={view === 'day' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setView('day')}
              >
                Day
              </Button>
            </div>
            
            {/* Navigation */}
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigateDate('prev')}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateDate('today')}
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => navigateDate('next')}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {onSlotClick ? 'Click on a time slot to create a job, or drag existing jobs to reschedule' : 'Drag and drop jobs to reschedule them'}
        </p>
      </CardHeader>
      <CardContent>
        {/* Month View */}
        {view === 'month' && (
          <>
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
                    className={`min-h-[100px] p-1 rounded-md border transition-colors cursor-pointer hover:bg-accent/50 ${
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
                    onClick={() => handleSlotClick(day)}
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
                      {dayJobs.slice(0, 3).map(job => renderJobItem(job))}
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
          </>
        )}

        {/* Week View */}
        {view === 'week' && (
          <div className="overflow-auto">
            <div className="min-w-[700px]">
              {/* Day headers */}
              <div className="grid grid-cols-[60px_repeat(7,1fr)] gap-1 mb-1 sticky top-0 bg-background z-10">
                <div className="text-sm font-medium text-muted-foreground py-2"></div>
                {days.map(day => (
                  <div 
                    key={format(day, 'yyyy-MM-dd')} 
                    className={`text-center text-sm font-medium py-2 rounded ${
                      isToday(day) ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
                    }`}
                  >
                    <div>{format(day, 'EEE')}</div>
                    <div className={`text-lg ${isToday(day) ? 'text-primary font-bold' : 'text-foreground'}`}>
                      {format(day, 'd')}
                    </div>
                  </div>
                ))}
              </div>

              {/* Time grid */}
              <div className="max-h-[500px] overflow-y-auto">
                {hours.map(hourDate => {
                  const hour = hourDate.getHours();
                  return (
                    <div key={hour} className="grid grid-cols-[60px_repeat(7,1fr)] gap-1">
                      <div className="text-xs text-muted-foreground py-2 text-right pr-2">
                        {format(hourDate, 'h a')}
                      </div>
                      {days.map(day => {
                        const dateKey = `${format(day, 'yyyy-MM-dd')}-${hour}`;
                        const hourJobs = getJobsForHour(day, hour);
                        const isDropTarget = dropTargetDate === dateKey;

                        return (
                          <div
                            key={dateKey}
                            className={`min-h-[50px] p-1 border-t border-border transition-colors cursor-pointer hover:bg-accent/50 ${
                              isDropTarget ? 'bg-primary/20' : ''
                            }`}
                            onDragOver={(e) => handleDragOver(e, dateKey)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, day, hour)}
                            onClick={() => handleSlotClick(day, hour)}
                          >
                            <div className="space-y-1">
                              {hourJobs.map(job => renderJobItem(job, false))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Day View */}
        {view === 'day' && (
          <div className="max-h-[500px] overflow-y-auto">
            {hours.map(hourDate => {
              const hour = hourDate.getHours();
              const day = days[0];
              const dateKey = `${format(day, 'yyyy-MM-dd')}-${hour}`;
              const hourJobs = getJobsForHour(day, hour);
              const isDropTarget = dropTargetDate === dateKey;

              return (
                <div 
                  key={hour} 
                  className={`grid grid-cols-[80px_1fr] gap-2 border-t border-border transition-colors cursor-pointer hover:bg-accent/50 ${
                    isDropTarget ? 'bg-primary/20' : ''
                  }`}
                  onDragOver={(e) => handleDragOver(e, dateKey)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, day, hour)}
                  onClick={() => handleSlotClick(day, hour)}
                >
                  <div className="text-sm text-muted-foreground py-3 text-right pr-2 font-medium">
                    {format(hourDate, 'h:mm a')}
                  </div>
                  <div className="min-h-[60px] p-2 space-y-1">
                    {hourJobs.map(job => renderJobItem(job, false))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

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
