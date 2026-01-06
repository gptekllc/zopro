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
import AppLayout from '@/components/layout/AppLayout';

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

  const availableJobs = jobs.filter(j => 
    j.status === 'scheduled' || j.status === 'in_progress' || j.status === 'draft'
  );

  const canEdit = roles.some(r => r.role === 'admin' || r.role === 'manager');
  const canViewReports = roles.some(r => r.role === 'admin' || r.role === 'manager');
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
  }, [activeEntry]);

  const handleClockIn = async () => {
    try {
      await clockIn.mutateAsync({ 
        notes: notes || undefined, 
        jobId: selectedJobId !== 'none' ? selectedJobId : undefined,
        recordWorkHours: selectedJobId !== 'none' && recordWorkHours,
      });
      setNotes('');
      toast.success('Clocked in successfully!');
    } catch (error) {
      toast.error('Failed to clock in');
    }
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
    
    try {
      await clockOut.mutateAsync({ 
        id: activeEntry.id, 
        notes: notes || undefined,
        jobId: activeEntry.job_id,
        technicianHourlyRate: profile?.hourly_rate || 0,
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
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-4 lg:space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Time Clock</h1>
            <p className="text-sm text-muted-foreground">
              Track your work hours
              {company?.timezone && <span className="ml-1">({company.timezone})</span>}
            </p>
          </div>
          {canViewReports && (
            <Link to="/timesheet">
              <Button variant="outline" size="sm">
                <FileText className="w-4 h-4 mr-2" />
                Timesheet
              </Button>
            </Link>
          )}
        </div>

        {/* Main Layout - responsive grid */}
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 lg:gap-6">
          {/* Left Column: Clock Widget + Stats */}
          <div className="space-y-4">
            {/* Clock Widget */}
            <Card className="overflow-hidden">
              <div className={`p-6 text-center ${activeEntry?.is_on_break ? 'bg-amber-500' : activeEntry ? 'gradient-success' : 'gradient-primary'}`}>
                <div className="text-primary-foreground">
                  {activeEntry?.is_on_break ? (
                    <Coffee className="w-10 h-10 mx-auto mb-3 opacity-90" />
                  ) : (
                    <Timer className="w-10 h-10 mx-auto mb-3 opacity-90" />
                  )}
                  <p className="text-xs uppercase tracking-wider opacity-80 mb-1">
                    {activeEntry?.is_on_break ? 'On Break' : activeEntry ? 'Working' : 'Ready'}
                  </p>
                  <p className="text-4xl font-bold font-mono">{elapsedTime}</p>
                  {activeEntry && (
                    <div className="mt-2 space-y-0.5 text-sm opacity-80">
                      <p>Started {format(new Date(activeEntry.clock_in), 'h:mm a')}</p>
                      {activeEntry.job && (
                        <p className="flex items-center justify-center gap-1">
                          <Briefcase className="w-3 h-3" />
                          {activeEntry.job.job_number}
                        </p>
                      )}
                      {((activeEntry.break_minutes || 0) > 0 || activeEntry.is_on_break) && (
                        <p className="flex items-center justify-center gap-1">
                          <Coffee className="w-3 h-3" />
                          Break: {breakTime}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
              
              <CardContent className="p-4 space-y-3">
                {!activeEntry && availableJobs.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs">Link to Job</Label>
                    <Select value={selectedJobId} onValueChange={setSelectedJobId}>
                      <SelectTrigger className="h-9">
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
                    
                    {selectedJobId !== 'none' && (
                      <div className="flex items-start gap-2 p-2 bg-muted/50 rounded border text-xs">
                        <Checkbox
                          id="record-work-hours"
                          checked={recordWorkHours}
                          onCheckedChange={(checked) => setRecordWorkHours(checked === true)}
                          className="mt-0.5"
                        />
                        <label htmlFor="record-work-hours" className="cursor-pointer">
                          <span className="font-medium">Record hours to job</span>
                          <p className="text-muted-foreground">Time will be added as labor</p>
                        </label>
                      </div>
                    )}
                  </div>
                )}
                
                <Textarea
                  placeholder="Notes (optional)..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="text-sm"
                />
                
                {activeEntry ? (
                  <div className="flex gap-2">
                    <Button
                      onClick={handleToggleBreak}
                      disabled={startBreak.isPending || endBreak.isPending}
                      variant={activeEntry.is_on_break ? "default" : "secondary"}
                      className="flex-1 h-11"
                    >
                      {startBreak.isPending || endBreak.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Coffee className="w-4 h-4 mr-2" />
                      )}
                      {activeEntry.is_on_break ? 'End' : 'Break'}
                    </Button>
                    <Button
                      onClick={handleClockOut}
                      disabled={clockOut.isPending}
                      className="flex-1 h-11 bg-destructive hover:bg-destructive/90"
                    >
                      {clockOut.isPending ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Square className="w-4 h-4 mr-2" />
                      )}
                      Clock Out
                    </Button>
                  </div>
                ) : (
                  <Button
                    onClick={handleClockIn}
                    disabled={clockIn.isPending}
                    className="w-full h-11"
                  >
                    {clockIn.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4 mr-2" />
                    )}
                    Clock In
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Stats Cards */}
            <div className="grid grid-cols-2 gap-3">
              <Card>
                <CardContent className="p-4 text-center">
                  <Calendar className="w-6 h-6 mx-auto mb-1 text-primary" />
                  <p className="text-lg font-bold">{weeklyHours}h {weeklyMins}m</p>
                  <p className="text-xs text-muted-foreground">This Week</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <Clock className="w-6 h-6 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-lg font-bold">{userEntries.length}</p>
                  <p className="text-xs text-muted-foreground">Total Entries</p>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Right Column: Recent Entries */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Recent Entries</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {userEntries.slice(0, 10).map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between py-2.5 px-3 -mx-3 border-b last:border-0 cursor-pointer hover:bg-muted/50 rounded transition-colors"
                    onClick={() => handleViewEntry(entry)}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                        {canEdit ? <Pencil className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </Button>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm">
                            {format(new Date(entry.clock_in), 'EEE, MMM d')}
                          </p>
                          {entry.job && (
                            <span className="text-xs px-1.5 py-0.5 bg-primary/10 text-primary rounded flex items-center gap-1">
                              <Briefcase className="w-3 h-3" />
                              {entry.job.job_number}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(entry.clock_in), 'h:mm a')}
                          {entry.clock_out && ` - ${format(new Date(entry.clock_out), 'h:mm a')}`}
                          {(entry.break_minutes || 0) > 0 && (
                            <span className="ml-1.5 text-amber-600">
                              <Coffee className="w-3 h-3 inline mr-0.5" />
                              {entry.break_minutes}m
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${
                      entry.clock_out 
                        ? 'bg-muted text-muted-foreground' 
                        : 'bg-success/10 text-success'
                    }`}>
                      {formatDuration(entry)}
                    </span>
                  </div>
                ))}
                {userEntries.length === 0 && (
                  <p className="text-center text-muted-foreground py-8 text-sm">
                    No time entries yet. Clock in to start!
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        <TimeEntryDialog
          entry={selectedEntry}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          canEdit={canEdit}
          onSave={handleSaveEntry}
          timezone={company?.timezone}
        />
      </div>
    </AppLayout>
  );
};

export default TimeClock;