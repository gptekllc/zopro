import { useState, useEffect } from 'react';
import {
  useJobTimeEntries,
  useActiveTimeEntry,
  useClockIn,
  useClockOut,
  useStartBreak,
  useEndBreak,
  TimeEntry,
} from '@/hooks/useTimeEntries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Clock, Play, Square, Timer, Loader2, Coffee, User } from 'lucide-react';
import { format, differenceInMinutes } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { formatAmount } from '@/lib/formatAmount';

interface JobTimeTrackerProps {
  jobId: string;
  jobNumber: string;
  laborHourlyRate?: number | null;
}

export function JobTimeTracker({ jobId, jobNumber, laborHourlyRate }: JobTimeTrackerProps) {
  const { profile } = useAuth();
  const { data: jobTimeEntries = [], isLoading } = useJobTimeEntries(jobId);
  const { data: activeEntry } = useActiveTimeEntry();
  const clockIn = useClockIn();
  const clockOut = useClockOut();
  const startBreak = useStartBreak();
  const endBreak = useEndBreak();

  const [notes, setNotes] = useState('');
  const [recordWorkHours, setRecordWorkHours] = useState(true);
  const [elapsedTime, setElapsedTime] = useState('00:00:00');
  const [breakTime, setBreakTime] = useState('00:00');

  // Check if the active entry is for THIS job
  const isActiveOnThisJob = activeEntry?.job_id === jobId;
  const hasActiveEntry = !!activeEntry;
  
  // Calculate total hours worked on this job
  const totalMinutes = jobTimeEntries.reduce((total, entry) => {
    const clockOutTime = entry.clock_out ? new Date(entry.clock_out) : new Date();
    const worked = differenceInMinutes(clockOutTime, new Date(entry.clock_in));
    const breakMins = entry.break_minutes || 0;
    return total + worked - breakMins;
  }, 0);
  const totalHours = Math.floor(totalMinutes / 60);
  const totalMins = totalMinutes % 60;

  // Update elapsed time for active entry on this job
  useEffect(() => {
    if (!isActiveOnThisJob || !activeEntry) {
      setElapsedTime('00:00:00');
      setBreakTime('00:00');
      return;
    }

    const updateTimer = () => {
      const now = new Date();
      const start = new Date(activeEntry.clock_in);
      let diff = now.getTime() - start.getTime();
      
      const breakMinutes = activeEntry.break_minutes || 0;
      diff -= breakMinutes * 60000;
      
      if (activeEntry.is_on_break && activeEntry.break_start) {
        const ongoingBreak = now.getTime() - new Date(activeEntry.break_start).getTime();
        diff -= ongoingBreak;
        
        const breakMins = Math.floor(ongoingBreak / 60000);
        const breakSecs = Math.floor((ongoingBreak % 60000) / 1000);
        setBreakTime(`${String(breakMins).padStart(2, '0')}:${String(breakSecs).padStart(2, '0')}`);
      } else {
        const totalBreakMins = activeEntry.break_minutes || 0;
        setBreakTime(`${String(totalBreakMins).padStart(2, '0')}:00`);
      }
      
      if (diff < 0) diff = 0;
      
      const hours = Math.floor(diff / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      
      setElapsedTime(
        `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
      );
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [activeEntry, isActiveOnThisJob]);

  const handleClockIn = async () => {
    await clockIn.mutateAsync({
      notes: notes || undefined,
      jobId,
      recordWorkHours,
    });
    setNotes('');
  };

  const handleClockOut = async () => {
    if (!activeEntry) return;
    
    if (activeEntry.is_on_break && activeEntry.break_start) {
      await endBreak.mutateAsync({
        entryId: activeEntry.id,
        breakStart: activeEntry.break_start,
        currentBreakMinutes: activeEntry.break_minutes || 0,
      });
    }
    
    const effectiveRate = laborHourlyRate ?? profile?.hourly_rate ?? 0;
    
    await clockOut.mutateAsync({ 
      id: activeEntry.id, 
      notes: notes || undefined,
      jobId,
      technicianHourlyRate: effectiveRate,
    });
    setNotes('');
  };

  const handleToggleBreak = async () => {
    if (!activeEntry) return;
    
    if (activeEntry.is_on_break) {
      if (activeEntry.break_start) {
        await endBreak.mutateAsync({
          entryId: activeEntry.id,
          breakStart: activeEntry.break_start,
          currentBreakMinutes: activeEntry.break_minutes || 0,
        });
      }
    } else {
      await startBreak.mutateAsync(activeEntry.id);
    }
  };

  const formatDuration = (entry: TimeEntry) => {
    if (!entry.clock_out) return 'Active';
    const mins = differenceInMinutes(new Date(entry.clock_out), new Date(entry.clock_in)) - (entry.break_minutes || 0);
    const hrs = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hrs}h ${remainingMins}m`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Timer Card */}
      <Card className="overflow-hidden">
        <div className={`p-6 text-center ${activeEntry?.is_on_break && isActiveOnThisJob ? 'bg-amber-500' : isActiveOnThisJob ? 'gradient-success' : 'gradient-primary'}`}>
          <div className="text-primary-foreground">
            {isActiveOnThisJob ? (
              <>
                {activeEntry?.is_on_break ? (
                  <Coffee className="w-8 h-8 mx-auto mb-2 opacity-90" />
                ) : (
                  <Timer className="w-8 h-8 mx-auto mb-2 opacity-90" />
                )}
                <p className="text-sm uppercase tracking-wider opacity-80 mb-1">
                  {activeEntry?.is_on_break ? 'On Break' : 'Working on ' + jobNumber}
                </p>
                <p className="text-4xl font-bold font-mono mb-1">{elapsedTime}</p>
                <p className="text-sm opacity-80">
                  Started at {format(new Date(activeEntry!.clock_in), 'h:mm a')}
                </p>
                {((activeEntry?.break_minutes || 0) > 0 || activeEntry?.is_on_break) && (
                  <p className="text-sm opacity-80 flex items-center justify-center gap-1 mt-1">
                    <Coffee className="w-3 h-3" />
                    Break: {breakTime}
                  </p>
                )}
              </>
            ) : (
              <>
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-90" />
                <p className="text-sm uppercase tracking-wider opacity-80 mb-1">
                  {hasActiveEntry ? 'Already clocked in on another job' : 'Ready to Start'}
                </p>
                <p className="text-2xl font-bold mb-1">
                  {totalHours}h {totalMins}m total
                </p>
                <p className="text-sm opacity-80">{jobTimeEntries.length} time entries</p>
              </>
            )}
          </div>
        </div>
        
          <CardContent className="p-4">
            <div className="space-y-3">
              <Textarea
                placeholder="Add notes (optional)..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />

              {/* Record Hours to Job */}
              {!isActiveOnThisJob && (
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id={`record-hours-${jobId}`}
                      checked={recordWorkHours}
                      disabled={hasActiveEntry}
                      onCheckedChange={(checked) => setRecordWorkHours(checked === true)}
                    />
                    <Label htmlFor={`record-hours-${jobId}`} className="text-sm text-muted-foreground cursor-pointer">
                      Record Hours to Job
                    </Label>
                  </div>

                  {hasActiveEntry ? (
                    <p className="text-xs text-muted-foreground pl-6">
                      Stop your active timer to change this option.
                    </p>
                  ) : recordWorkHours ? (
                    <p className="text-xs text-muted-foreground pl-6">
                      Rate: {formatAmount((laborHourlyRate ?? profile?.hourly_rate ?? 0) as number)}/hr
                      {laborHourlyRate ? (
                        <span className="ml-1 text-primary">(job rate)</span>
                      ) : profile?.hourly_rate ? (
                        <span className="ml-1">(your default rate)</span>
                      ) : null}
                    </p>
                  ) : null}
                </div>
              )}
              
              {isActiveOnThisJob ? (
                <div className="flex gap-2">
                  <Button
                    onClick={handleToggleBreak}
                    disabled={startBreak.isPending || endBreak.isPending}
                    variant={activeEntry?.is_on_break ? "default" : "secondary"}
                    className="flex-1"
                  >
                    {startBreak.isPending || endBreak.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Coffee className="w-4 h-4 mr-2" />
                    )}
                    {activeEntry?.is_on_break ? 'End Break' : 'Break'}
                  </Button>
                  <Button
                    onClick={handleClockOut}
                    disabled={clockOut.isPending}
                    className="flex-1 bg-destructive hover:bg-destructive/90"
                  >
                    {clockOut.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Square className="w-4 h-4 mr-2" />
                    )}
                    Stop
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={handleClockIn}
                  disabled={clockIn.isPending || hasActiveEntry}
                  className="w-full"
                >
                  {clockIn.isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Play className="w-4 h-4 mr-2" />
                  )}
                  {hasActiveEntry ? 'Already Clocked In' : 'Start Timer'}
                </Button>
              )}
            </div>
          </CardContent>
      </Card>

      {/* Time Entry History */}
      {jobTimeEntries.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Time Entry History</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {jobTimeEntries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between py-2 border-b last:border-0"
              >
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">
                      {entry.user?.full_name || 'Unknown'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(entry.clock_in), 'MMM d, h:mm a')}
                      {entry.clock_out && ` - ${format(new Date(entry.clock_out), 'h:mm a')}`}
                    </p>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  entry.clock_out 
                    ? 'bg-muted text-muted-foreground' 
                    : 'bg-success/10 text-success'
                }`}>
                  {formatDuration(entry)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
