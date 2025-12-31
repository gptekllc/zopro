import { useState, useMemo } from 'react';
import { useTimeEntries, TimeEntry } from '@/hooks/useTimeEntries';
import { useProfiles } from '@/hooks/useProfiles';
import { useCompany } from '@/hooks/useCompany';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Download, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, differenceInMinutes, isSameDay } from 'date-fns';

const TimesheetReport = () => {
  const { roles } = useAuth();
  const { data: company } = useCompany();
  const { data: timeEntries = [], isLoading: loadingEntries } = useTimeEntries();
  const { data: profiles = [], isLoading: loadingProfiles } = useProfiles();
  
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }));

  const canViewAll = roles.some(r => r.role === 'admin' || r.role === 'manager');

  const weekEnd = endOfWeek(weekStart, { weekStartsOn: 0 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Group entries by user and day
  const timesheetData = useMemo(() => {
    const teamMembers = profiles.filter(p => p.company_id === company?.id);
    
    return teamMembers.map(member => {
      const memberEntries = timeEntries.filter(e => e.user_id === member.id);
      
      const dailyHours = weekDays.map(day => {
        const dayEntries = memberEntries.filter(e => 
          isSameDay(new Date(e.clock_in), day)
        );
        
        const totalMinutes = dayEntries.reduce((total, entry) => {
          const clockOut = entry.clock_out ? new Date(entry.clock_out) : new Date();
          const worked = differenceInMinutes(clockOut, new Date(entry.clock_in));
          const breakMins = entry.break_minutes || 0;
          return total + worked - breakMins;
        }, 0);
        
        return {
          date: day,
          minutes: totalMinutes,
          entries: dayEntries,
        };
      });

      const weeklyTotal = dailyHours.reduce((sum, d) => sum + d.minutes, 0);

      return {
        member,
        dailyHours,
        weeklyTotal,
      };
    }).filter(row => row.weeklyTotal > 0 || row.dailyHours.some(d => d.entries.length > 0));
  }, [profiles, timeEntries, weekDays, company?.id]);

  const formatMinutes = (mins: number) => {
    if (mins <= 0) return '-';
    const hours = Math.floor(mins / 60);
    const minutes = mins % 60;
    return `${hours}:${String(minutes).padStart(2, '0')}`;
  };

  const exportToCSV = () => {
    const headers = ['Team Member', ...weekDays.map(d => format(d, 'EEE MMM d')), 'Total'];
    
    const rows = timesheetData.map(row => [
      row.member.full_name || row.member.email,
      ...row.dailyHours.map(d => formatMinutes(d.minutes)),
      formatMinutes(row.weeklyTotal),
    ]);

    // Add totals row
    const dailyTotals = weekDays.map((_, i) => 
      timesheetData.reduce((sum, row) => sum + row.dailyHours[i].minutes, 0)
    );
    const grandTotal = timesheetData.reduce((sum, row) => sum + row.weeklyTotal, 0);
    rows.push(['TOTAL', ...dailyTotals.map(formatMinutes), formatMinutes(grandTotal)]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `timesheet_${format(weekStart, 'yyyy-MM-dd')}_to_${format(weekEnd, 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const isLoading = loadingEntries || loadingProfiles;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!canViewAll) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">You don't have permission to view this report.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Weekly Timesheet</h1>
          <p className="text-muted-foreground mt-1">
            Team hours overview
            {company?.timezone && <span className="ml-2 text-xs">({company.timezone})</span>}
          </p>
        </div>
        <Button onClick={exportToCSV} variant="outline">
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
      </div>

      {/* Week Navigation */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => setWeekStart(subWeeks(weekStart, 1))}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-2">
              <Calendar className="w-5 h-5 text-muted-foreground" />
              <span className="font-semibold">
                {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
              </span>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setWeekStart(addWeeks(weekStart, 1))}
              disabled={weekStart >= startOfWeek(new Date(), { weekStartsOn: 0 })}
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Timesheet Table */}
      <Card>
        <CardHeader>
          <CardTitle>Team Hours</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-4 font-semibold">Team Member</th>
                  {weekDays.map(day => (
                    <th key={day.toISOString()} className="text-center py-3 px-2 font-semibold min-w-[80px]">
                      <div className="text-xs text-muted-foreground">{format(day, 'EEE')}</div>
                      <div>{format(day, 'd')}</div>
                    </th>
                  ))}
                  <th className="text-center py-3 px-4 font-semibold bg-muted/50">Total</th>
                </tr>
              </thead>
              <tbody>
                {timesheetData.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-8 text-muted-foreground">
                      No time entries for this week
                    </td>
                  </tr>
                ) : (
                  <>
                    {timesheetData.map(row => (
                      <tr key={row.member.id} className="border-b hover:bg-muted/30">
                        <td className="py-3 px-4">
                          <div className="font-medium">{row.member.full_name || 'Unknown'}</div>
                          <div className="text-xs text-muted-foreground">{row.member.email}</div>
                        </td>
                        {row.dailyHours.map((day, i) => (
                          <td key={i} className="text-center py-3 px-2">
                            <span className={day.minutes > 0 ? 'font-medium' : 'text-muted-foreground'}>
                              {formatMinutes(day.minutes)}
                            </span>
                          </td>
                        ))}
                        <td className="text-center py-3 px-4 font-bold bg-muted/50">
                          {formatMinutes(row.weeklyTotal)}
                        </td>
                      </tr>
                    ))}
                    {/* Totals Row */}
                    <tr className="bg-muted/30 font-semibold">
                      <td className="py-3 px-4">TOTAL</td>
                      {weekDays.map((_, i) => {
                        const dayTotal = timesheetData.reduce((sum, row) => sum + row.dailyHours[i].minutes, 0);
                        return (
                          <td key={i} className="text-center py-3 px-2">
                            {formatMinutes(dayTotal)}
                          </td>
                        );
                      })}
                      <td className="text-center py-3 px-4 bg-primary/10 text-primary">
                        {formatMinutes(timesheetData.reduce((sum, row) => sum + row.weeklyTotal, 0))}
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default TimesheetReport;
