import { useState, useMemo, DragEvent, MouseEvent as ReactMouseEvent } from 'react';
import { Job, useUpdateJob } from '@/hooks/useJobs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, GripVertical, ChevronsUpDown } from 'lucide-react';
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
  endOfDay,
  differenceInMinutes,
  addMinutes
} from 'date-fns';
import { toast } from 'sonner';

type CalendarView = 'month' | 'week' | 'day';

interface JobCalendarProps {
  jobs: Job[];
  onJobClick: (job: Job) => void;
  onSlotClick?: (date: Date) => void;
}

const getInitials = (name: string | null | undefined): string => {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

const JobCalendar = ({ jobs, onJobClick, onSlotClick }: JobCalendarProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>('week'); // Default to week view
  const [draggedJob, setDraggedJob] = useState<Job | null>(null);
  const [dropTargetDate, setDropTargetDate] = useState<string | null>(null);
  const [resizingJob, setResizingJob] = useState<{ job: Job; startY: number; originalMinutes: number } | null>(null);
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

  // Group ALL jobs by date (including draft, completed, etc.)
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

  // Calculate job height based on duration (for week/day views)
  const getJobHeight = (job: Job) => {
    if (!job.scheduled_start || !job.scheduled_end) return 40; // Default height
    const start = parseISO(job.scheduled_start);
    const end = parseISO(job.scheduled_end);
    const durationMinutes = differenceInMinutes(end, start);
    // 50px per hour = ~0.83px per minute
    return Math.max(40, (durationMinutes / 60) * 50);
  };

  const getStatusColor = (status: Job['status']) => {
    switch (status) {
      case 'draft': return 'bg-muted text-muted-foreground border-muted-foreground/30';
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
      case 'medium': return 'border-l-2 border-l-blue-400';
      case 'low': return 'border-l-2 border-l-muted-foreground/30';
      default: return '';
    }
  };

  const getPriorityIndicator = (priority: Job['priority']) => {
    if (priority === 'urgent') return 'U';
    if (priority === 'high') return 'H';
    return null;
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

  // Resize handlers for week/day views
  const handleResizeStart = (e: ReactMouseEvent, job: Job) => {
    e.stopPropagation();
    e.preventDefault();
    if (!job.scheduled_start || !job.scheduled_end) return;
    
    const start = parseISO(job.scheduled_start);
    const end = parseISO(job.scheduled_end);
    const originalMinutes = differenceInMinutes(end, start);
    
    setResizingJob({ job, startY: e.clientY, originalMinutes });
    
    const handleMouseMove = (moveEvent: globalThis.MouseEvent) => {
      const deltaY = moveEvent.clientY - e.clientY;
      // Each 50px = 1 hour = 60 minutes
      const deltaMinutes = Math.round((deltaY / 50) * 60 / 15) * 15; // Round to 15-minute increments
      const newDuration = Math.max(15, originalMinutes + deltaMinutes);
      
      // Visual feedback would go here
    };
    
    const handleMouseUp = async (upEvent: globalThis.MouseEvent) => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      
      const deltaY = upEvent.clientY - e.clientY;
      const deltaMinutes = Math.round((deltaY / 50) * 60 / 15) * 15;
      const newDuration = Math.max(15, originalMinutes + deltaMinutes);
      
      if (newDuration !== originalMinutes) {
        const newEnd = addMinutes(start, newDuration);
        try {
          await updateJob.mutateAsync({
            id: job.id,
            scheduled_end: newEnd.toISOString(),
          });
          toast.success(`Job duration updated to ${Math.floor(newDuration / 60)}h ${newDuration % 60}m`);
        } catch (error) {
          toast.error('Failed to update job duration');
        }
      }
      
      setResizingJob(null);
    };
    
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
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

  // Get first assignee for avatar
  const getJobAssignee = (job: Job) => {
    if (job.assignees && job.assignees.length > 0) {
      return job.assignees[0].profile;
    }
    return job.assignee;
  };

  // Render job item for Month view (compact)
  const renderMonthJobItem = (job: Job) => (
    <div
      key={job.id}
      draggable
      onDragStart={(e) => handleDragStart(e, job)}
      onDragEnd={handleDragEnd}
      onClick={(e) => {
        e.stopPropagation();
        onJobClick(job);
      }}
      className={`text-xs p-1 rounded cursor-pointer hover:opacity-80 transition-opacity truncate flex items-center gap-1 ${getStatusColor(job.status)} ${getPriorityBorder(job.priority)} ${
        draggedJob?.id === job.id ? 'opacity-50' : ''
      }`}
      title={`${job.job_number}: ${job.title} - Click to edit, Drag to reschedule`}
    >
      <GripVertical className="w-3 h-3 flex-shrink-0 opacity-50 cursor-grab" />
      <span className="truncate">
        {job.scheduled_start && (
          <span className="font-medium">
            {format(parseISO(job.scheduled_start), 'HH:mm')}
          </span>
        )}{' '}
        {job.title}
      </span>
    </div>
  );

  // Render enhanced job item for Week/Day views
  const renderWeekDayJobItem = (job: Job, showResize = true) => {
    const assignee = getJobAssignee(job);
    const priorityIndicator = getPriorityIndicator(job.priority);
    const height = view !== 'month' && job.scheduled_end ? getJobHeight(job) : 'auto';
    
    return (
      <div
        key={job.id}
        draggable
        onDragStart={(e) => handleDragStart(e, job)}
        onDragEnd={handleDragEnd}
        onClick={(e) => {
          e.stopPropagation();
          onJobClick(job);
        }}
        className={`text-xs p-1.5 rounded cursor-pointer hover:opacity-90 transition-all relative ${getStatusColor(job.status)} ${getPriorityBorder(job.priority)} ${
          draggedJob?.id === job.id ? 'opacity-50' : ''
        }`}
        style={{ minHeight: 40, height: typeof height === 'number' ? `${height}px` : height }}
        title={`${job.job_number}: ${job.title} - ${job.customer?.name || 'Unknown'}`}
      >
        <div className="flex items-start justify-between gap-1">
          <GripVertical className="w-3 h-3 flex-shrink-0 opacity-50 cursor-grab mt-0.5" />
          <div className="flex-1 min-w-0 overflow-hidden">
            <div className="flex items-center gap-1">
              <span className="font-bold truncate">{job.job_number}</span>
              {priorityIndicator && (
                <Badge className={`h-3 px-1 text-[8px] ${
                  job.priority === 'urgent' ? 'bg-destructive text-destructive-foreground' : 'bg-warning text-warning-foreground'
                }`}>
                  {priorityIndicator}
                </Badge>
              )}
            </div>
            <div className="truncate text-[10px] opacity-90 font-medium">{job.title}</div>
            <div className="truncate text-[10px] opacity-80">{job.customer?.name || 'Unknown'}</div>
          </div>
          {assignee && (
            <Avatar className="w-5 h-5 flex-shrink-0">
              <AvatarImage src={(assignee as any).avatar_url} />
              <AvatarFallback className="text-[8px] bg-background/50">
                {getInitials(assignee.full_name)}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
        
        {/* Resize handle for week/day views */}
        {showResize && job.scheduled_end && (
          <div 
            className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize hover:bg-white/30 flex items-center justify-center"
            onMouseDown={(e) => handleResizeStart(e, job)}
          >
            <ChevronsUpDown className="w-3 h-3 opacity-50" />
          </div>
        )}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-2 px-3 sm:px-6">
        {/* Mobile: Stack vertically, Desktop: Side by side */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Title + Navigation row on mobile */}
          <div className="flex items-center justify-between sm:justify-start gap-2">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <CalendarIcon className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="truncate">{getHeaderTitle()}</span>
            </CardTitle>
            
            {/* Navigation - always visible */}
            <div className="flex gap-1 shrink-0">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 sm:h-9 sm:w-9"
                onClick={() => navigateDate('prev')}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 px-2 sm:px-3 text-xs sm:text-sm"
                onClick={() => navigateDate('today')}
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 sm:h-9 sm:w-9"
                onClick={() => navigateDate('next')}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* View Toggle - full width on mobile */}
          <div className="flex gap-1 border rounded-md p-1 w-full sm:w-auto">
            <Button
              variant={view === 'month' ? 'default' : 'ghost'}
              size="sm"
              className="flex-1 sm:flex-none h-7 text-xs sm:text-sm"
              onClick={() => setView('month')}
            >
              Month
            </Button>
            <Button
              variant={view === 'week' ? 'default' : 'ghost'}
              size="sm"
              className="flex-1 sm:flex-none h-7 text-xs sm:text-sm"
              onClick={() => setView('week')}
            >
              Week
            </Button>
            <Button
              variant={view === 'day' ? 'default' : 'ghost'}
              size="sm"
              className="flex-1 sm:flex-none h-7 text-xs sm:text-sm"
              onClick={() => setView('day')}
            >
              Day
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2 hidden sm:block">
          {onSlotClick ? 'Click on a time slot to create a job, drag jobs to reschedule, or drag the bottom edge to resize' : 'Drag and drop jobs to reschedule, drag the bottom edge to resize duration'}
        </p>
      </CardHeader>
      <CardContent className="px-2 sm:px-6">
        {/* Month View */}
        {view === 'month' && (
          <>
            {/* Day headers - abbreviated on mobile */}
            <div className="grid grid-cols-7 gap-0.5 sm:gap-1 mb-1">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, idx) => (
                <div key={idx} className="text-center text-xs sm:text-sm font-medium text-muted-foreground py-1 sm:py-2 sm:hidden">
                  {day}
                </div>
              ))}
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-center text-sm font-medium text-muted-foreground py-2 hidden sm:block">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
              {days.map(day => {
                const dateKey = format(day, 'yyyy-MM-dd');
                const dayJobs = jobsByDate.get(dateKey) || [];
                const isCurrentMonth = isSameMonth(day, currentDate);
                const isDropTarget = dropTargetDate === dateKey;

                return (
                  <div
                    key={dateKey}
                    className={`min-h-[60px] sm:min-h-[100px] p-0.5 sm:p-1 rounded-md border transition-colors cursor-pointer hover:bg-accent/50 ${
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
                    <div className={`text-xs sm:text-sm font-medium mb-0.5 sm:mb-1 ${
                      isToday(day) 
                        ? 'text-primary' 
                        : isCurrentMonth 
                          ? 'text-foreground' 
                          : 'text-muted-foreground'
                    }`}>
                      {format(day, 'd')}
                    </div>
                    <div className="space-y-0.5 sm:space-y-1 overflow-hidden max-h-[40px] sm:max-h-[80px]">
                      {dayJobs.slice(0, view === 'month' ? (window.innerWidth < 640 ? 1 : 3) : 3).map(job => renderMonthJobItem(job))}
                      {dayJobs.length > (window.innerWidth < 640 ? 1 : 3) && (
                        <div className="text-[10px] sm:text-xs text-muted-foreground text-center">
                          +{dayJobs.length - (window.innerWidth < 640 ? 1 : 3)} more
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
          <div className="overflow-auto -mx-2 sm:mx-0">
            <div className="min-w-[500px] sm:min-w-[700px] px-2 sm:px-0">
              {/* Day headers */}
              <div className="grid grid-cols-[40px_repeat(7,1fr)] sm:grid-cols-[60px_repeat(7,1fr)] gap-0.5 sm:gap-1 mb-1 sticky top-0 bg-background z-10">
                <div className="text-sm font-medium text-muted-foreground py-2"></div>
                {days.map(day => (
                  <div 
                    key={format(day, 'yyyy-MM-dd')} 
                    className={`text-center text-xs sm:text-sm font-medium py-1 sm:py-2 rounded ${
                      isToday(day) ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
                    }`}
                  >
                    <div className="hidden sm:block">{format(day, 'EEE')}</div>
                    <div className="sm:hidden">{format(day, 'EEEEE')}</div>
                    <div className={`text-sm sm:text-lg ${isToday(day) ? 'text-primary font-bold' : 'text-foreground'}`}>
                      {format(day, 'd')}
                    </div>
                  </div>
                ))}
              </div>

              {/* Time grid */}
              <div className="max-h-[400px] sm:max-h-[500px] overflow-y-auto">
                {hours.map(hourDate => {
                  const hour = hourDate.getHours();
                  return (
                    <div key={hour} className="grid grid-cols-[40px_repeat(7,1fr)] sm:grid-cols-[60px_repeat(7,1fr)] gap-0.5 sm:gap-1">
                      <div className="text-[10px] sm:text-xs text-muted-foreground py-2 text-right pr-1 sm:pr-2">
                        {format(hourDate, 'h a')}
                      </div>
                      {days.map(day => {
                        const dateKey = `${format(day, 'yyyy-MM-dd')}-${hour}`;
                        const hourJobs = getJobsForHour(day, hour);
                        const isDropTarget = dropTargetDate === dateKey;

                        return (
                          <div
                            key={dateKey}
                            className={`min-h-[50px] p-0.5 sm:p-1 border-t border-border transition-colors cursor-pointer hover:bg-accent/50 ${
                              isDropTarget ? 'bg-primary/20' : ''
                            }`}
                            onDragOver={(e) => handleDragOver(e, dateKey)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, day, hour)}
                            onClick={() => handleSlotClick(day, hour)}
                          >
                            <div className="space-y-0.5 sm:space-y-1">
                              {hourJobs.map(job => renderWeekDayJobItem(job))}
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
          <div className="max-h-[400px] sm:max-h-[500px] overflow-y-auto">
            {hours.map(hourDate => {
              const hour = hourDate.getHours();
              const day = days[0];
              const dateKey = `${format(day, 'yyyy-MM-dd')}-${hour}`;
              const hourJobs = getJobsForHour(day, hour);
              const isDropTarget = dropTargetDate === dateKey;

              return (
                <div 
                  key={hour} 
                  className={`grid grid-cols-[60px_1fr] sm:grid-cols-[80px_1fr] gap-1 sm:gap-2 border-t border-border transition-colors cursor-pointer hover:bg-accent/50 ${
                    isDropTarget ? 'bg-primary/20' : ''
                  }`}
                  onDragOver={(e) => handleDragOver(e, dateKey)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, day, hour)}
                  onClick={() => handleSlotClick(day, hour)}
                >
                  <div className="text-xs sm:text-sm text-muted-foreground py-2 sm:py-3 text-right pr-1 sm:pr-2 font-medium">
                    {format(hourDate, 'h:mm a')}
                  </div>
                  <div className="min-h-[50px] sm:min-h-[60px] p-1 sm:p-2 space-y-1">
                    {hourJobs.map(job => renderWeekDayJobItem(job))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Legend - hidden on mobile, visible on larger screens */}
        <div className="hidden sm:flex flex-wrap gap-3 mt-4 pt-4 border-t text-xs">
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded bg-muted border border-muted-foreground/30" />
            <span>Draft</span>
          </div>
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
          <div className="flex items-center gap-1 border-l pl-3">
            <div className="w-3 h-3 rounded border-l-2 border-l-destructive bg-muted" />
            <span>Urgent</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-3 h-3 rounded border-l-2 border-l-warning bg-muted" />
            <span>High</span>
          </div>
          <div className="flex items-center gap-1 ml-auto">
            <GripVertical className="w-3 h-3" />
            <span className="text-muted-foreground">Drag to reschedule</span>
          </div>
          <div className="flex items-center gap-1">
            <ChevronsUpDown className="w-3 h-3" />
            <span className="text-muted-foreground">Resize duration</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default JobCalendar;