import { useState, useMemo } from 'react';
import { Job } from '@/hooks/useJobs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, isToday, parseISO } from 'date-fns';

interface JobCalendarProps {
  jobs: Job[];
  onJobClick: (job: Job) => void;
}

const JobCalendar = ({ jobs, onJobClick }: JobCalendarProps) => {
  const [currentDate, setCurrentDate] = useState(new Date());

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

            return (
              <div
                key={dateKey}
                className={`min-h-[100px] p-1 rounded-md border ${
                  isToday(day) 
                    ? 'bg-primary/5 border-primary' 
                    : isCurrentMonth 
                      ? 'bg-card border-border' 
                      : 'bg-muted/30 border-transparent'
                }`}
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
                      onClick={() => onJobClick(job)}
                      className={`text-xs p-1 rounded cursor-pointer hover:opacity-80 transition-opacity truncate ${getStatusColor(job.status)} ${getPriorityBorder(job.priority)}`}
                      title={`${job.job_number}: ${job.title}`}
                    >
                      {job.scheduled_start && (
                        <span className="font-medium">
                          {format(parseISO(job.scheduled_start), 'HH:mm')}
                        </span>
                      )}{' '}
                      {job.title}
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
        </div>
      </CardContent>
    </Card>
  );
};

export default JobCalendar;
