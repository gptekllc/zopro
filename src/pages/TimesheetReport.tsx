import { useState, useMemo } from 'react';
import { useTimeEntries, TimeEntry, useDeleteTimeEntry } from '@/hooks/useTimeEntries';
import { useProfiles } from '@/hooks/useProfiles';
import { useCompany } from '@/hooks/useCompany';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Calendar, Download, Loader2, ChevronLeft, ChevronRight, Trash2, FileText } from 'lucide-react';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, differenceInMinutes, isSameDay } from 'date-fns';

const TimesheetReport = () => {
  const { roles } = useAuth();
  const { data: company } = useCompany();
  const { data: timeEntries = [], isLoading: loadingEntries } = useTimeEntries();
  const { data: profiles = [], isLoading: loadingProfiles } = useProfiles();
  const deleteTimeEntry = useDeleteTimeEntry();
  
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [numWeeks, setNumWeeks] = useState(1);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const canViewAll = roles.some(r => r.role === 'admin' || r.role === 'manager');

  const weekEnd = endOfWeek(addWeeks(weekStart, numWeeks - 1), { weekStartsOn: 0 });
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

  const exportToPDF = async () => {
    setIsExportingPdf(true);
    
    try {
      // Calculate totals
      const dailyTotals = weekDays.map((_, i) => 
        timesheetData.reduce((sum, row) => sum + row.dailyHours[i].minutes, 0)
      );
      const grandTotal = timesheetData.reduce((sum, row) => sum + row.weeklyTotal, 0);

      // Generate PDF-friendly HTML
      const pdfContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>Timesheet Report</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 30px; border-bottom: 2px solid #6366f1; padding-bottom: 20px; }
            .company-info { flex: 1; }
            .company-name { font-size: 24px; font-weight: bold; color: #6366f1; margin-bottom: 5px; }
            .company-details { font-size: 12px; color: #666; }
            .logo { max-width: 120px; max-height: 60px; object-fit: contain; }
            .report-title { font-size: 20px; font-weight: bold; margin-bottom: 5px; }
            .date-range { font-size: 14px; color: #666; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th { background: #6366f1; color: white; padding: 10px 8px; text-align: center; font-size: 11px; }
            th:first-child { text-align: left; }
            td { padding: 10px 8px; border-bottom: 1px solid #e5e7eb; text-align: center; font-size: 12px; }
            td:first-child { text-align: left; }
            .member-name { font-weight: 500; }
            .member-email { font-size: 10px; color: #666; }
            .total-row { background: #f3f4f6; font-weight: bold; }
            .grand-total { background: #6366f1; color: white; font-weight: bold; }
            .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #666; text-align: center; }
            @media print {
              body { padding: 20px; }
              .header { page-break-inside: avoid; }
              table { page-break-inside: auto; }
              tr { page-break-inside: avoid; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="company-info">
              <div class="company-name">${company?.name || 'Company'}</div>
              <div class="company-details">
                ${company?.address ? `${company.address}<br>` : ''}
                ${company?.city || ''}${company?.state ? `, ${company.state}` : ''} ${company?.zip || ''}<br>
                ${company?.phone ? `Tel: ${company.phone}` : ''} ${company?.email ? `• ${company.email}` : ''}
              </div>
            </div>
            ${company?.logo_url ? `<img src="${company.logo_url}" class="logo" alt="Company Logo" />` : ''}
          </div>

          <div class="report-title">Weekly Timesheet Report</div>
          <div class="date-range">${format(weekStart, 'MMMM d, yyyy')} - ${format(weekEnd, 'MMMM d, yyyy')}</div>

          <table>
            <thead>
              <tr>
                <th style="text-align: left; width: 180px;">Team Member</th>
                ${weekDays.map(day => `<th>${format(day, 'EEE')}<br>${format(day, 'd')}</th>`).join('')}
                <th style="background: #4f46e5;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${timesheetData.length === 0 ? `
                <tr>
                  <td colspan="${weekDays.length + 2}" style="text-align: center; padding: 30px; color: #666;">
                    No time entries for this period
                  </td>
                </tr>
              ` : timesheetData.map(row => `
                <tr>
                  <td>
                    <div class="member-name">${row.member.full_name || 'Unknown'}</div>
                    <div class="member-email">${row.member.email}</div>
                  </td>
                  ${row.dailyHours.map(d => `<td>${formatMinutes(d.minutes)}</td>`).join('')}
                  <td style="font-weight: bold; background: #f3f4f6;">${formatMinutes(row.weeklyTotal)}</td>
                </tr>
              `).join('')}
              ${timesheetData.length > 0 ? `
                <tr class="total-row">
                  <td><strong>TOTAL</strong></td>
                  ${dailyTotals.map(t => `<td>${formatMinutes(t)}</td>`).join('')}
                  <td class="grand-total">${formatMinutes(grandTotal)}</td>
                </tr>
              ` : ''}
            </tbody>
          </table>

          <div class="footer">
            Generated on ${format(new Date(), 'MMMM d, yyyy \'at\' h:mm a')}
            ${company?.timezone ? ` • Timezone: ${company.timezone}` : ''}
          </div>
        </body>
        </html>
      `;

      // Create a new window for printing
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(pdfContent);
        printWindow.document.close();
        
        // Wait for content to load, then print
        printWindow.onload = () => {
          setTimeout(() => {
            printWindow.print();
          }, 250);
        };
      }
    } catch (error) {
      console.error('PDF export error:', error);
    } finally {
      setIsExportingPdf(false);
    }
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
        <div className="flex items-center gap-2">
          <Button onClick={exportToCSV} variant="outline">
            <Download className="w-4 h-4 mr-2" />
            CSV
          </Button>
          <Button onClick={exportToPDF} variant="outline" disabled={isExportingPdf}>
            {isExportingPdf ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <FileText className="w-4 h-4 mr-2" />
            )}
            PDF
          </Button>
          <select 
            className="border rounded px-2 py-1 text-sm"
            value={numWeeks}
            onChange={(e) => setNumWeeks(Number(e.target.value))}
          >
            <option value={1}>1 Week</option>
            <option value={2}>2 Weeks</option>
            <option value={4}>4 Weeks</option>
          </select>
        </div>
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
