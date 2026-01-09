import { useMemo } from 'react';
import { useJobTimeEntries } from './useTimeEntries';
import { differenceInMinutes } from 'date-fns';

export interface LaborSummary {
  totalHours: number;
  totalMinutes: number;
  formattedTotal: string;
  entries: {
    workerName: string;
    hours: number;
    minutes: number;
  }[];
}

export function useJobLaborFromTimeEntries(jobId: string | null) {
  const { data: timeEntries = [], isLoading } = useJobTimeEntries(jobId);

  const laborSummary = useMemo<LaborSummary | null>(() => {
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

    if (totalMinutes === 0) return null;

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    // Convert to hours with 2 decimal places for line item quantity
    const totalHours = Math.round((totalMinutes / 60) * 100) / 100;

    return {
      totalHours,
      totalMinutes,
      formattedTotal: hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`,
      entries: Array.from(workerMap.entries()).map(([name, mins]) => ({
        workerName: name,
        hours: Math.floor(mins / 60),
        minutes: mins % 60,
      })),
    };
  }, [timeEntries]);

  return {
    laborSummary,
    isLoading,
    hasTimeEntries: timeEntries.length > 0,
  };
}
