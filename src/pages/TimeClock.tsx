import { useState, useEffect } from 'react';
import { useStore } from '@/store/useStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Clock, Play, Square, Timer, Calendar } from 'lucide-react';
import { format, differenceInMinutes, differenceInHours } from 'date-fns';
import { toast } from 'sonner';

const TimeClock = () => {
  const { timeEntries, currentUser, clockIn, clockOut, getActiveTimeEntry } = useStore();
  const [notes, setNotes] = useState('');
  const [elapsedTime, setElapsedTime] = useState('00:00:00');
  
  const activeEntry = getActiveTimeEntry();

  // Filter entries for current user
  const userEntries = timeEntries.filter(e => e.userId === currentUser?.id);
  
  // Calculate weekly hours
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  weekStart.setHours(0, 0, 0, 0);
  
  const weeklyEntries = userEntries.filter(e => new Date(e.clockIn) >= weekStart);
  const weeklyMinutes = weeklyEntries.reduce((total, entry) => {
    const clockOutTime = entry.clockOut ? new Date(entry.clockOut) : new Date();
    return total + differenceInMinutes(clockOutTime, new Date(entry.clockIn));
  }, 0);
  const weeklyHours = Math.floor(weeklyMinutes / 60);
  const weeklyMins = weeklyMinutes % 60;

  // Update elapsed time for active entry
  useEffect(() => {
    if (!activeEntry) {
      setElapsedTime('00:00:00');
      return;
    }

    const updateTimer = () => {
      const now = new Date();
      const start = new Date(activeEntry.clockIn);
      const diff = now.getTime() - start.getTime();
      
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

  const handleClockIn = () => {
    clockIn(notes);
    setNotes('');
    toast.success('Clocked in successfully!');
  };

  const handleClockOut = () => {
    clockOut(notes);
    setNotes('');
    toast.success('Clocked out successfully!');
  };

  const formatDuration = (entry: typeof timeEntries[0]) => {
    if (!entry.clockOut) return 'Active';
    const mins = differenceInMinutes(new Date(entry.clockOut), new Date(entry.clockIn));
    const hrs = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hrs}h ${remainingMins}m`;
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Time Clock</h1>
        <p className="text-muted-foreground mt-1">Track your work hours</p>
      </div>

      {/* Main Time Clock Card */}
      <Card className="overflow-hidden">
        <div className={`p-8 text-center ${activeEntry ? 'gradient-success' : 'gradient-primary'}`}>
          <div className="text-primary-foreground">
            <Timer className="w-12 h-12 mx-auto mb-4 opacity-90" />
            <p className="text-sm uppercase tracking-wider opacity-80 mb-2">
              {activeEntry ? 'Currently Working' : 'Ready to Clock In'}
            </p>
            <p className="text-5xl font-bold font-mono mb-2">{elapsedTime}</p>
            {activeEntry && (
              <p className="text-sm opacity-80">
                Started at {format(new Date(activeEntry.clockIn), 'h:mm a')}
              </p>
            )}
          </div>
        </div>
        
        <CardContent className="p-6">
          <div className="space-y-4">
            <Textarea
              placeholder="Add notes (optional)..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
            
            {activeEntry ? (
              <Button
                onClick={handleClockOut}
                className="w-full h-14 text-lg bg-destructive hover:bg-destructive/90"
              >
                <Square className="w-5 h-5 mr-2" />
                Clock Out
              </Button>
            ) : (
              <Button
                onClick={handleClockIn}
                className="w-full h-14 text-lg"
              >
                <Play className="w-5 h-5 mr-2" />
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
            {userEntries.slice(-10).reverse().map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between py-3 border-b last:border-0"
              >
                <div>
                  <p className="font-medium">
                    {format(new Date(entry.clockIn), 'EEEE, MMM d')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(entry.clockIn), 'h:mm a')}
                    {entry.clockOut && ` - ${format(new Date(entry.clockOut), 'h:mm a')}`}
                  </p>
                  {entry.notes && (
                    <p className="text-sm text-muted-foreground mt-1">{entry.notes}</p>
                  )}
                </div>
                <div className="text-right">
                  <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                    entry.clockOut 
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
    </div>
  );
};

export default TimeClock;
