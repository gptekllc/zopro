import { useMemo } from 'react';
import { useJobTimeEntries } from '@/hooks/useTimeEntries';
import { Clock, Timer, Users } from 'lucide-react';
import { format, differenceInMinutes } from 'date-fns';

interface JobTimeSummaryProps {
  jobId: string;
}

export function JobTimeSummary({ jobId }: JobTimeSummaryProps) {
  const { data: timeEntries = [], isLoading } = useJobTimeEntries(jobId);

  const summary = useMemo(() => {
    if (!timeEntries.length) return null;

    let totalMinutes = 0;
    const workerMap = new Map<string, number>();

    timeEntries.forEach(entry => {
      if (!entry.clock_out) return; // Skip active entries
      
      const clockIn = new Date(entry.clock_in);
      const clockOut = new Date(entry.clock_out);
      const workedMinutes = differenceInMinutes(clockOut, clockIn) - (entry.break_minutes || 0);
      
      if (workedMinutes > 0) {
        totalMinutes += workedMinutes;
        const workerName = entry.user?.full_name || 'Unknown';
        workerMap.set(workerName, (workerMap.get(workerName) || 0) + workedMinutes);
      }
    });

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return {
      totalMinutes,
      formattedTotal: hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`,
      workers: Array.from(workerMap.entries()).map(([name, mins]) => ({
        name,
        formattedTime: Math.floor(mins / 60) > 0 
          ? `${Math.floor(mins / 60)}h ${mins % 60}m` 
          : `${mins}m`
      })),
      entryCount: timeEntries.filter(e => e.clock_out).length,
    };
  }, [timeEntries]);

  if (isLoading) {
    return (
      <div className="p-4 bg-muted/50 rounded-lg animate-pulse">
        <div className="h-4 bg-muted rounded w-24 mb-2"></div>
        <div className="h-6 bg-muted rounded w-16"></div>
      </div>
    );
  }

  if (!summary || summary.totalMinutes === 0) {
    return (
      <div className="p-4 bg-muted/50 rounded-lg text-center">
        <Timer className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">No time tracked yet</p>
      </div>
    );
  }

  return (
    <div className="p-4 bg-muted/50 rounded-lg space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Total Time Tracked</span>
        </div>
        <span className="text-lg font-bold text-primary">{summary.formattedTotal}</span>
      </div>
      
      {summary.workers.length > 0 && (
        <div className="border-t pt-3 space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Users className="w-3 h-3" />
            <span>By Team Member</span>
          </div>
          <div className="space-y-1">
            {summary.workers.map(worker => (
              <div key={worker.name} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{worker.name}</span>
                <span className="font-medium">{worker.formattedTime}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="text-xs text-muted-foreground text-right">
        {summary.entryCount} time {summary.entryCount === 1 ? 'entry' : 'entries'}
      </div>
    </div>
  );
}
