import { useState, useEffect } from 'react';
import { useTimeEntries, useActiveTimeEntry, useClockIn, useClockOut, useUpdateTimeEntry, useStartBreak, useEndBreak, TimeEntry } from '@/hooks/useTimeEntries';
import { useJobs } from '@/hooks/useJobs';
import { useAuth } from '@/hooks/useAuth';
import { useCompany } from '@/hooks/useCompany';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Clock, Play, Square, Timer, Calendar, Loader2, Eye, Pencil, Coffee, FileText, Briefcase } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { format, differenceInMinutes } from 'date-fns';
import { toast } from 'sonner';
import { TimeEntryDialog } from '@/components/timeclock/TimeEntryDialog';
import { Link } from 'react-router-dom';

const TimeClock = () => {
  const { user, profile, roles } = useAuth();
  const { data: company } = useCompany();
  const { data: jobs = [] } = useJobs();
  const { data: timeEntries = [], isLoading } = useTimeEntries();
  const { data: activeEntry } = useActiveTimeEntry();
  const clockIn = useClockIn();
  const clockOut = useClockOut();
  const updateTimeEntry = useUpdateTimeEntry();
  const startBreak = useStartBreak();
  const endBreak = useEndBreak();
  
  const [notes, setNotes] = useState('');
  const [selectedJobId, setSelectedJobId] = useState<string>('none');
  const [elapsedTime, setElapsedTime] = useState('00:00:00');
  const [breakTime, setBreakTime] = useState('00:00');
  const [selectedEntry, setSelectedEntry] = useState<TimeEntry | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [recordWorkHours, setRecordWorkHours] = useState(false);
  // Filter jobs that can be worked on (scheduled or in_progress)
  const availableJobs = jobs.filter(j => 
    j.status === 'scheduled' || j.status === 'in_progress' || j.status === 'draft'
  );

  // Check if user can edit entries (admin or manager)
  const canEdit = roles.some(r => r.role === 'admin' || r.role === 'manager');
  const canViewReports = roles.some(r => r.role === 'admin' || r.role === 'manager');

  // Filter entries for current user
  const userEntries = timeEntries.filter(e => e.user_id === user?.id);
  
  // Calculate weekly hours
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  weekStart.setHours(0, 0, 0, 0);
  
  const weeklyEntries = userEntries.filter(e => new Date(e.clock_in) >= weekStart);
  const weeklyMinutes = weeklyEntries.reduce((total, entry) => {
    const clockOutTime = entry.clock_out ? new Date(entry.clock_out) : new Date();
    const worked = differenceInMinutes(clockOutTime, new Date(entry.clock_in));
    const breakMins = entry.break_minutes || 0;
    return total + worked - breakMins;
  }, 0);
  const weeklyHours = Math.floor(weeklyMinutes / 60);
  const weeklyMins = weeklyMinutes % 60;

  // Update elapsed time for active entry
  useEffect(() => {
    if (!activeEntry) {
      setElapsedTime('00:00:00');
      setBreakTime('00:00');
      return;
    }

    const updateTimer = () => {
      const now = new Date();
      const start = new Date(activeEntry.clock_in);
      let diff = now.getTime() - start.getTime();
      
      // Subtract accumulated break time
      const breakMinutes = activeEntry.break_minutes || 0;
      diff -= breakMinutes * 60000;
      
      // If currently on break, also subtract ongoing break time
      if (activeEntry.is_on_break && activeEntry.break_start) {
        const ongoingBreak = now.getTime() - new Date(activeEntry.break_start).getTime();
        diff -= ongoingBreak;
        
        // Update break display
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
  }, [activeEntry]);

  const handleClockIn = async () => {
    try {
      await clockIn.mutateAsync({ 
        notes: notes || undefined, 
        jobId: selectedJobId !== 'none' ? selectedJobId : undefined,
        recordWorkHours: selectedJobId !== 'none' && recordWorkHours,
      });
      setNotes('');
      // Keep selectedJobId and recordWorkHours for clock out
      toast.success('Clocked in successfully!');
    } catch (error) {
      toast.error('Failed to clock in');
    }
  };

  const handleClockOut = async () => {
    if (!activeEntry) return;
    
    // End break first if on break
    if (activeEntry.is_on_break && activeEntry.break_start) {
      await endBreak.mutateAsync({
        entryId: activeEntry.id,
        breakStart: activeEntry.break_start,
        currentBreakMinutes: activeEntry.break_minutes || 0,
      });
    }
    
    try {
      await clockOut.mutateAsync({ 
        id: activeEntry.id, 
        notes: notes || undefined,
        jobId: activeEntry.job_id,
        hourlyRate: profile?.hourly_rate || 0,
      });
      setNotes('');
      setSelectedJobId('none');
      setRecordWorkHours(false);
      toast.success('Clocked out successfully!');
    } catch (error) {
      toast.error('Failed to clock out');
    }
  };

  const handleToggleBreak = async () => {
    if (!activeEntry) return;
    
    if (activeEntry.is_on_break) {
      // End break
      if (activeEntry.break_start) {
        await endBreak.mutateAsync({
          entryId: activeEntry.id,
          breakStart: activeEntry.break_start,
          currentBreakMinutes: activeEntry.break_minutes || 0,
        });
      }
    } else {
      // Start break
      await startBreak.mutateAsync(activeEntry.id);
    }
  };

  const handleViewEntry = (entry: TimeEntry) => {
    setSelectedEntry(entry);
    setDialogOpen(true);
  };

  const handleSaveEntry = async (data: { clock_in: string; clock_out: string | null; notes: string | null; break_minutes?: number }) => {
    if (!selectedEntry) return;
    await updateTimeEntry.mutateAsync({
      id: selectedEntry.id,
      ...data,
    });
  };

  const formatDuration = (entry: typeof userEntries[0]) => {
    if (!entry.clock_out) return 'Active';
    const mins = differenceInMinutes(new Date(entry.clock_out), new Date(entry.clock_in)) - (entry.break_minutes || 0);
    const hrs = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hrs}h ${remainingMins}m`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Time Clock</h1>
          <p className="text-muted-foreground mt-1">
            Track your work hours
            {company?.timezone && (
              <span className="ml-2 text-xs">({company.timezone})</span>
            )}
          </p>
        </div>
        {canViewReports && (
          <Link to="/timesheet">
            <Button variant="outline">
              <FileText className="w-4 h-4 mr-2" />
              View Timesheet
            </Button>
          </Link>
        )}
      </div>

      {/* Main Time Clock Card */}
      <Card className="overflow-hidden">
        <div className={`p-8 text-center ${activeEntry?.is_on_break ? 'bg-amber-500' : activeEntry ? 'gradient-success' : 'gradient-primary'}`}>
          <div className="text-primary-foreground">
            {activeEntry?.is_on_break ? (
              <Coffee className="w-12 h-12 mx-auto mb-4 opacity-90" />
            ) : (
              <Timer className="w-12 h-12 mx-auto mb-4 opacity-90" />
            )}
            <p className="text-sm uppercase tracking-wider opacity-80 mb-2">
              {activeEntry?.is_on_break ? 'On Break' : activeEntry ? 'Currently Working' : 'Ready to Clock In'}
            </p>
            <p className="text-5xl font-bold font-mono mb-2">{elapsedTime}</p>
              {activeEntry && (
              <div className="space-y-1">
                <p className="text-sm opacity-80">
                  Started at {format(new Date(activeEntry.clock_in), 'h:mm a')}
                </p>
                {activeEntry.job && (
                  <p className="text-sm opacity-80 flex items-center justify-center gap-1">
                    <Briefcase className="w-3 h-3" />
                    {activeEntry.job.job_number}
                  </p>
                )}
                {((activeEntry.break_minutes || 0) > 0 || activeEntry.is_on_break) && (
                  <p className="text-sm opacity-80 flex items-center justify-center gap-1">
                    <Coffee className="w-3 h-3" />
                    Break: {breakTime}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
        
        <CardContent className="p-6">
          <div className="space-y-4">
            {/* Job Selector - only show when not clocked in */}
            {!activeEntry && availableJobs.length > 0 && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Link to Job (optional)</Label>
                  <Select value={selectedJobId} onValueChange={setSelectedJobId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a job" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No job</SelectItem>
                      {availableJobs.map((job) => (
                        <SelectItem key={job.id} value={job.id}>
                          {job.job_number} - {job.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Record Work Hours Checkbox */}
                {selectedJobId !== 'none' && (
                  <div className="flex items-center space-x-2 p-3 bg-muted/50 rounded-lg border">
                    <Checkbox
                      id="record-work-hours"
                      checked={recordWorkHours}
                      onCheckedChange={(checked) => setRecordWorkHours(checked === true)}
                    />
                    <div className="flex-1">
                      <label
                        htmlFor="record-work-hours"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        Add/Record Work Hours to Job
                      </label>
                      <p className="text-xs text-muted-foreground mt-1">
                        When stopped, your time will be recorded as labor hours on this job
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            <Textarea
              placeholder="Add notes (optional)..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
            
            {activeEntry ? (
              <div className="flex gap-3">
                <Button
                  onClick={handleToggleBreak}
                  disabled={startBreak.isPending || endBreak.isPending}
                  variant={activeEntry.is_on_break ? "default" : "secondary"}
                  className="flex-1 h-14 text-lg"
                >
                  {startBreak.isPending || endBreak.isPending ? (
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  ) : (
                    <Coffee className="w-5 h-5 mr-2" />
                  )}
                  {activeEntry.is_on_break ? 'End Break' : 'Start Break'}
                </Button>
                <Button
                  onClick={handleClockOut}
                  disabled={clockOut.isPending}
                  className="flex-1 h-14 text-lg bg-destructive hover:bg-destructive/90"
                >
                  {clockOut.isPending ? (
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  ) : (
                    <Square className="w-5 h-5 mr-2" />
                  )}
                  Clock Out
                </Button>
              </div>
            ) : (
              <Button
                onClick={handleClockIn}
                disabled={clockIn.isPending}
                className="w-full h-14 text-lg"
              >
                {clockIn.isPending ? (
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                ) : (
                  <Play className="w-5 h-5 mr-2" />
                )}
                Clock In
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="p-6 text-center">
            <Calendar className="w-8 h-8 mx-auto mb-2 text-primary" />
            <p className="text-2xl font-bold">{weeklyHours}h {weeklyMins}m</p>
            <p className="text-sm text-muted-foreground">This Week</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 text-center">
            <Clock className="w-8 h-8 mx-auto mb-2 text-accent" />
            <p className="text-2xl font-bold">{userEntries.length}</p>
            <p className="text-sm text-muted-foreground">Total Entries</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Entries */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Time Entries</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {userEntries.slice(0, 10).map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between py-3 border-b last:border-0 cursor-pointer hover:bg-muted/50 rounded-lg px-2 -mx-2 transition-colors"
                onClick={() => handleViewEntry(entry)}
              >
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                    {canEdit ? <Pencil className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">
                        {format(new Date(entry.clock_in), 'EEEE, MMM d')}
                      </p>
                      {entry.job && (
                        <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full flex items-center gap-1">
                          <Briefcase className="w-3 h-3" />
                          {entry.job.job_number}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(entry.clock_in), 'h:mm a')}
                      {entry.clock_out && ` - ${format(new Date(entry.clock_out), 'h:mm a')}`}
                      {(entry.break_minutes || 0) > 0 && (
                        <span className="ml-2 text-amber-600">
                          <Coffee className="w-3 h-3 inline mr-1" />
                          {entry.break_minutes}m break
                        </span>
                      )}
                    </p>
                    {entry.notes && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{entry.notes}</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    entry.clock_out 
                      ? 'bg-muted text-muted-foreground' 
                      : 'bg-success/10 text-success'
                  }`}>
                    {formatDuration(entry)}
                  </span>
                </div>
              </div>
            ))}
            {userEntries.length === 0 && (
              <p className="text-center text-muted-foreground py-8">
                No time entries yet. Clock in to start tracking!
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Time Entry Dialog */}
      <TimeEntryDialog
        entry={selectedEntry}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        canEdit={canEdit}
        onSave={handleSaveEntry}
        timezone={company?.timezone}
      />
    </div>
  );
};

export default TimeClock;
