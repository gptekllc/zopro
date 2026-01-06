import { useState, useEffect } from 'react';
import { useTimeEntries, useActiveTimeEntry, useClockIn, useClockOut, useUpdateTimeEntry, useStartBreak, useEndBreak, TimeEntry } from '@/hooks/useTimeEntries';
import { useJobs } from '@/hooks/useJobs';
import { useAuth } from '@/hooks/useAuth';
import { useCompany } from '@/hooks/useCompany';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Clock, Play, Square, Calendar, Loader2, Eye, Pencil, Coffee, FileText, Briefcase, History, MapPin, ChevronLeft, ChevronRight, MoreVertical } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { format, differenceInMinutes, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, addWeeks, subWeeks } from 'date-fns';
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
  
  const [currentTime, setCurrentTime] = useState(new Date());
  const [notes, setNotes] = useState('');
  const [selectedJobId, setSelectedJobId] = useState<string>('none');
  const [elapsedTime, setElapsedTime] = useState('00:00:00');
  const [breakTime, setBreakTime] = useState('00:00');
  const [selectedEntry, setSelectedEntry] = useState<TimeEntry | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [recordWorkHours, setRecordWorkHours] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);

  const availableJobs = jobs.filter(j => 
    j.status === 'scheduled' || j.status === 'in_progress' || j.status === 'draft'
  );

  const canEdit = roles.some(r => r.role === 'admin' || r.role === 'manager');
  const canViewReports = roles.some(r => r.role === 'admin' || r.role === 'manager');
  const userEntries = timeEntries.filter(e => e.user_id === user?.id);
  
  // Calculate weekly hours
  const today = new Date();
  const currentWeekStart = startOfWeek(addWeeks(today, weekOffset), { weekStartsOn: 0 });
  const currentWeekEnd = endOfWeek(addWeeks(today, weekOffset), { weekStartsOn: 0 });
  const weekDays = eachDayOfInterval({ start: currentWeekStart, end: currentWeekEnd });
  
  const weeklyEntries = userEntries.filter(e => {
    const entryDate = new Date(e.clock_in);
    return entryDate >= currentWeekStart && entryDate <= currentWeekEnd;
  });
  
  const weeklyMinutes = weeklyEntries.reduce((total, entry) => {
    const clockOutTime = entry.clock_out ? new Date(entry.clock_out) : new Date();
    const worked = differenceInMinutes(clockOutTime, new Date(entry.clock_in));
    const breakMins = entry.break_minutes || 0;
    return total + worked - breakMins;
  }, 0);
  const weeklyHours = Math.floor(weeklyMinutes / 60);
  const weeklyMins = weeklyMinutes % 60;

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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

  const getStatus = () => {
    if (!activeEntry) return 'idle';
    if (activeEntry.is_on_break) return 'break';
    return 'working';
  };

  const status = getStatus();

  const getEntriesForDay = (day: Date) => {
    return weeklyEntries.filter(e => isSameDay(new Date(e.clock_in), day));
  };

  const formatDayDuration = (entries: TimeEntry[]) => {
    if (entries.length === 0) return '--';
    
    const totalMins = entries.reduce((total, entry) => {
      if (!entry.clock_out) return total;
      const worked = differenceInMinutes(new Date(entry.clock_out), new Date(entry.clock_in));
      const breakMins = entry.break_minutes || 0;
      return total + worked - breakMins;
    }, 0);
    
    if (totalMins === 0) {
      const hasActive = entries.some(e => !e.clock_out);
      if (hasActive) return 'In Progress';
      return '--';
    }
    
    const hrs = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    return `${hrs}h ${mins}m`;
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
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Time Clock</h1>
            <p className="text-muted-foreground">Manage your shifts and time cards.</p>
          </div>
          <div className="flex items-center gap-2">
            {canViewReports && (
              <Link to="/timesheet">
                <Button variant="outline" size="sm">
                  <FileText className="w-4 h-4 mr-2" />
                  Timesheet
                </Button>
              </Link>
            )}
            <Link to="/notifications">
              <Button variant="outline" size="sm">
                <History className="w-4 h-4 mr-2" />
                View History
              </Button>
            </Link>
          </div>
        </div>

        {/* Main Action Card */}
        <div className="grid lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2 overflow-hidden relative">
            {/* Background decorative blob */}
            <div className={`absolute top-0 right-0 w-64 h-64 bg-gradient-to-br opacity-10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none 
              ${status === 'working' ? 'from-green-400 to-emerald-600' : status === 'break' ? 'from-amber-400 to-orange-600' : 'from-slate-400 to-slate-600'}`} 
            />

            <div className="p-8 flex flex-col items-center justify-center text-center min-h-[360px]">
              {/* Status Badge */}
              <div className="mb-6">
                {status === 'working' && (
                  <span className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-semibold bg-green-50 text-green-700 border border-green-100 animate-pulse dark:bg-green-950 dark:text-green-300 dark:border-green-800">
                    <span className="w-2 h-2 rounded-full bg-green-500 mr-2"></span>
                    Clocked In
                  </span>
                )}
                {status === 'break' && (
                  <span className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-semibold bg-amber-50 text-amber-700 border border-amber-100 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800">
                    <span className="w-2 h-2 rounded-full bg-amber-500 mr-2 animate-bounce"></span>
                    On Break
                  </span>
                )}
                {status === 'idle' && (
                  <span className="inline-flex items-center px-4 py-1.5 rounded-full text-sm font-semibold bg-muted text-muted-foreground border">
                    <span className="w-2 h-2 rounded-full bg-muted-foreground mr-2"></span>
                    Off Clock
                  </span>
                )}
              </div>

              {/* Time Display */}
              <div className="mb-2">
                <span className="text-7xl font-mono font-bold tracking-tighter">
                  {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="text-xl font-mono text-muted-foreground font-medium ml-2">
                  {currentTime.getSeconds().toString().padStart(2, '0')}
                </span>
              </div>
              <p className="text-muted-foreground font-medium mb-6 flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {currentTime.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>

              {/* Shift Timer */}
              {(status === 'working' || status === 'break') && (
                <div className="mb-6 p-3 bg-muted/50 rounded-lg border w-full max-w-xs">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1">Current Shift Duration</div>
                  <div className="text-2xl font-mono font-medium">{elapsedTime}</div>
                  {activeEntry?.job && (
                    <div className="mt-1 text-xs text-muted-foreground flex items-center justify-center gap-1">
                      <Briefcase className="w-3 h-3" />
                      {activeEntry.job.job_number}
                    </div>
                  )}
                  {((activeEntry?.break_minutes || 0) > 0 || status === 'break') && (
                    <div className="mt-1 text-xs text-amber-600 flex items-center justify-center gap-1">
                      <Coffee className="w-3 h-3" />
                      Break: {breakTime}
                    </div>
                  )}
                </div>
              )}

              {/* Job Selection (only when idle) */}
              {status === 'idle' && availableJobs.length > 0 && (
                <div className="w-full max-w-md mb-4 space-y-2">
                  <Label className="text-xs">Link to Job (Optional)</Label>
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

              {/* Notes Input */}
              <div className="w-full max-w-md mb-4">
                <Textarea
                  placeholder="Notes (optional)..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="text-sm"
                />
              </div>

              {/* Actions Grid */}
              <div className="grid grid-cols-2 gap-4 w-full max-w-md">
                {status === 'idle' ? (
                  <Button 
                    size="lg" 
                    className="col-span-2 h-14 shadow-lg bg-green-600 hover:bg-green-700 text-white"
                    onClick={handleClockIn}
                    disabled={clockIn.isPending}
                  >
                    {clockIn.isPending ? (
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    ) : (
                      <Play className="w-5 h-5 mr-2 fill-current" />
                    )}
                    Clock In
                  </Button>
                ) : (
                  <>
                    <Button 
                      variant="destructive" 
                      size="lg" 
                      className="h-14 shadow-lg"
                      onClick={handleClockOut}
                      disabled={clockOut.isPending}
                    >
                      {clockOut.isPending ? (
                        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      ) : (
                        <Square className="w-5 h-5 mr-2 fill-current" />
                      )}
                      Clock Out
                    </Button>

                    {status === 'working' ? (
                      <Button 
                        size="lg" 
                        className="h-14 shadow-lg bg-amber-500 hover:bg-amber-600 text-white"
                        onClick={handleToggleBreak}
                        disabled={startBreak.isPending}
                      >
                        {startBreak.isPending ? (
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        ) : (
                          <Coffee className="w-5 h-5 mr-2" />
                        )}
                        Start Break
                      </Button>
                    ) : (
                      <Button 
                        size="lg" 
                        className="h-14"
                        onClick={handleToggleBreak}
                        disabled={endBreak.isPending}
                      >
                        {endBreak.isPending ? (
                          <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                        ) : (
                          <Play className="w-5 h-5 mr-2" />
                        )}
                        Resume Work
                      </Button>
                    )}
                  </>
                )}
              </div>

              {status !== 'idle' && company?.timezone && (
                <div className="mt-6 flex items-center text-xs text-muted-foreground gap-1">
                  <MapPin className="w-3 h-3" />
                  <span>Timezone: </span>
                  <span className="font-medium">{company.timezone}</span>
                </div>
              )}
            </div>
          </Card>

          {/* Side Stats */}
          <div className="space-y-6">
            <Card className="p-5">
              <h3 className="text-sm font-semibold mb-4 flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-muted-foreground" />
                Weekly Summary
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-end">
                  <div>
                    <p className="text-3xl font-bold">
                      {weeklyHours}<span className="text-lg text-muted-foreground font-normal">h</span>{' '}
                      {weeklyMins}<span className="text-lg text-muted-foreground font-normal">m</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">Total hours this week</p>
                  </div>
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs border border-primary/20">
                    {Math.min(100, Math.round((weeklyMinutes / (40 * 60)) * 100))}%
                  </div>
                </div>
                {/* Progress Bar */}
                <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                  <div 
                    className="bg-primary h-2 rounded-full transition-all" 
                    style={{ width: `${Math.min(100, (weeklyMinutes / (40 * 60)) * 100)}%` }}
                  ></div>
                </div>
                <div className="pt-4 border-t grid grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs text-muted-foreground">Regular</div>
                    <div className="font-medium">{weeklyHours}h {weeklyMins}m</div>
                  </div>
                  <div>
                    <div className="text-xs text-muted-foreground">Entries</div>
                    <div className="font-medium">{weeklyEntries.length}</div>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-0 overflow-hidden flex-1">
              <div className="p-4 border-b bg-muted/30 flex justify-between items-center">
                <h3 className="text-sm font-semibold">Recent Activity</h3>
                <Button variant="ghost" size="sm" className="h-6 text-xs" asChild>
                  <Link to="/timesheet">View All</Link>
                </Button>
              </div>
              <div className="divide-y max-h-[250px] overflow-y-auto">
                {userEntries.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground text-sm">No activity yet</div>
                ) : (
                  userEntries.slice(0, 6).map((entry) => (
                    <div 
                      key={entry.id} 
                      className="p-3 flex items-start gap-3 hover:bg-muted/50 transition-colors cursor-pointer"
                      onClick={() => handleViewEntry(entry)}
                    >
                      <div className={`mt-1.5 h-2 w-2 rounded-full shrink-0 
                        ${!entry.clock_out ? 'bg-green-500' : 'bg-muted-foreground'}`} 
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between">
                          <p className="text-sm font-medium">
                            {format(new Date(entry.clock_in), 'EEE, MMM d')}
                          </p>
                          <span className="text-xs text-muted-foreground font-mono">
                            {format(new Date(entry.clock_in), 'h:mm a')}
                          </span>
                        </div>
                        {entry.job && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5 flex items-center gap-1">
                            <Briefcase className="w-3 h-3" /> {entry.job.job_number}
                          </p>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>

        {/* Weekly Timesheet Table */}
        <Card className="overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h3 className="font-semibold">Timesheet</h3>
              <div className="flex items-center bg-muted rounded-md p-0.5">
                <button 
                  className="p-1 hover:bg-background rounded-sm transition-all"
                  onClick={() => setWeekOffset(prev => prev - 1)}
                >
                  <ChevronLeft className="w-4 h-4 text-muted-foreground" />
                </button>
                <span className="text-xs font-medium px-3 text-muted-foreground">
                  {format(currentWeekStart, 'MMM d')} - {format(currentWeekEnd, 'MMM d')}
                </span>
                <button 
                  className="p-1 hover:bg-background rounded-sm transition-all"
                  onClick={() => setWeekOffset(prev => prev + 1)}
                  disabled={weekOffset >= 0}
                >
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>
            </div>
            {canViewReports && (
              <Link to="/timesheet">
                <Button variant="outline" size="sm">Export PDF</Button>
              </Link>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-muted/50 text-muted-foreground font-medium border-b">
                <tr>
                  <th className="px-4 py-3 w-1/4">Date</th>
                  <th className="px-4 py-3">Clock In</th>
                  <th className="px-4 py-3">Clock Out</th>
                  <th className="px-4 py-3">Break</th>
                  <th className="px-4 py-3 text-right">Total</th>
                  <th className="px-4 py-3 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {weekDays.map((day, index) => {
                  const dayEntries = getEntriesForDay(day);
                  const firstEntry = dayEntries[0];
                  const totalBreak = dayEntries.reduce((sum, e) => sum + (e.break_minutes || 0), 0);
                  const isToday = isSameDay(day, new Date());
                  
                  return (
                    <tr 
                      key={day.toISOString()} 
                      className={`hover:bg-muted/30 ${index % 2 === 1 ? 'bg-muted/10' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <div className={`font-medium ${isToday ? 'text-primary' : ''}`}>
                          {format(day, 'EEE, MMM d')}
                        </div>
                        {dayEntries.length > 0 && firstEntry?.job && (
                          <div className="text-xs text-muted-foreground">{firstEntry.job.job_number}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {firstEntry ? format(new Date(firstEntry.clock_in), 'h:mm a') : '--'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {firstEntry?.clock_out ? format(new Date(firstEntry.clock_out), 'h:mm a') : firstEntry ? '--' : '--'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {totalBreak > 0 ? `${totalBreak}m` : '--'}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {formatDayDuration(dayEntries)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {firstEntry && (
                          <button 
                            className="text-muted-foreground hover:text-foreground"
                            onClick={() => handleViewEntry(firstEntry)}
                          >
                            {canEdit ? <Pencil className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-muted/50 font-medium border-t">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-right">Weekly Total</td>
                  <td className="px-4 py-3 text-right text-base">{weeklyHours}h {weeklyMins}m</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>

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
