import { useState, useMemo } from 'react';
import { useTimeEntries } from '@/hooks/useTimeEntries';
import { useProfiles } from '@/hooks/useProfiles';
import { useCompany } from '@/hooks/useCompany';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar, Download, Loader2, ChevronLeft, ChevronRight, FileText, Mail, Users, X, Search, MoreVertical } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks, eachDayOfInterval, differenceInMinutes, isSameDay } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ReportEmailDialog } from './ReportEmailDialog';
import { formatAmount } from '@/lib/formatAmount';

const TimesheetReportTab = () => {
  const { roles } = useAuth();
  const { data: company } = useCompany();
  const { data: timeEntries = [], isLoading: loadingEntries } = useTimeEntries();
  const { data: profiles = [], isLoading: loadingProfiles } = useProfiles();
  
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 0 }));
  const [numWeeks, setNumWeeks] = useState('1');
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [memberFilterSearch, setMemberFilterSearch] = useState('');

  const canViewAll = roles.some(r => r.role === 'admin' || r.role === 'manager');

  // Get all team members for the filter dropdown
  const allTeamMembers = useMemo(() => {
    return profiles.filter(p => p.company_id === company?.id);
  }, [profiles, company?.id]);

  // Filter members in dropdown by search
  const filteredDropdownMembers = useMemo(() => {
    if (!memberFilterSearch.trim()) return allTeamMembers;
    const search = memberFilterSearch.toLowerCase();
    return allTeamMembers.filter(m => 
      (m.full_name && m.full_name.toLowerCase().includes(search)) ||
      m.email.toLowerCase().includes(search)
    );
  }, [allTeamMembers, memberFilterSearch]);

  const toggleMember = (memberId: string) => {
    setSelectedMemberIds(prev => 
      prev.includes(memberId) 
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const clearSelectedMembers = () => {
    setSelectedMemberIds([]);
  };

  const weekEnd = endOfWeek(addWeeks(weekStart, parseInt(numWeeks) - 1), { weekStartsOn: 0 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  // Group entries by user and day
  const timesheetData = useMemo(() => {
    let teamMembers = profiles.filter(p => p.company_id === company?.id);
    
    // Filter by selected members if any are selected
    if (selectedMemberIds.length > 0) {
      teamMembers = teamMembers.filter(m => selectedMemberIds.includes(m.id));
    }
    
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
  }, [profiles, timeEntries, weekDays, company?.id, selectedMemberIds]);

  const formatMinutes = (mins: number) => {
    if (mins <= 0) return '-';
    const hours = Math.floor(mins / 60);
    const minutes = mins % 60;
    return `${hours}:${String(minutes).padStart(2, '0')}`;
  };

  const getFilteredMemberNames = () => {
    if (selectedMemberIds.length === 0) return null;
    return selectedMemberIds
      .map(id => allTeamMembers.find(m => m.id === id))
      .filter(Boolean)
      .map(m => m!.full_name || m!.email)
      .join(', ');
  };

  const exportToCSV = () => {
    const filterNote = selectedMemberIds.length > 0 
      ? `Filtered: ${getFilteredMemberNames()}`
      : '';
    
    const headers = ['Team Member', ...weekDays.map(d => format(d, 'EEE MMM d')), 'Total'];
    
    const rows = timesheetData.map(row => [
      row.member.full_name || row.member.email,
      ...row.dailyHours.map(d => formatMinutes(d.minutes)),
      formatMinutes(row.weeklyTotal),
    ]);

    const dailyTotals = weekDays.map((_, i) => 
      timesheetData.reduce((sum, row) => sum + row.dailyHours[i].minutes, 0)
    );
    const grandTotal = timesheetData.reduce((sum, row) => sum + row.weeklyTotal, 0);
    rows.push(['TOTAL', ...dailyTotals.map(formatMinutes), formatMinutes(grandTotal)]);

    const csvContent = [
      ...(filterNote ? [`"${filterNote}"`] : []),
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const filterSuffix = selectedMemberIds.length > 0 ? '_filtered' : '';
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `timesheet_${format(weekStart, 'yyyy-MM-dd')}_to_${format(weekEnd, 'yyyy-MM-dd')}${filterSuffix}.csv`;
    link.click();
  };

  const exportToPDF = async () => {
    setIsExportingPdf(true);
    
    try {
      const dailyTotals = weekDays.map((_, i) => 
        timesheetData.reduce((sum, row) => sum + row.dailyHours[i].minutes, 0)
      );
      const grandTotal = timesheetData.reduce((sum, row) => sum + row.weeklyTotal, 0);

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

          <div class="report-title">Weekly Timesheet Report${selectedMemberIds.length > 0 ? ' (Filtered)' : ''}</div>
          <div class="date-range">${format(weekStart, 'MMMM d, yyyy')} - ${format(weekEnd, 'MMMM d, yyyy')}${selectedMemberIds.length > 0 ? `<br><span style="font-size: 12px;">Showing: ${getFilteredMemberNames()}</span>` : ''}</div>

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

      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(pdfContent);
        printWindow.document.close();
        
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

  // Send email report
  const sendReportEmail = async (emails: string[]): Promise<{ successful: string[]; failed: { email: string; reason: string }[] }> => {
    setIsSendingEmail(true);
    try {
      const dailyTotals = weekDays.map((_, i) => 
        timesheetData.reduce((sum, row) => sum + row.dailyHours[i].minutes, 0)
      );
      const grandTotal = timesheetData.reduce((sum, row) => sum + row.weeklyTotal, 0);

      const reportData = {
        title: 'Timesheet Report',
        timeRange: `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`,
        generatedAt: format(new Date(), 'MMMM d, yyyy'),
        stats: {
          teamSize: timesheetData.length,
          totalHours: formatMinutes(grandTotal),
          periodWeeks: numWeeks,
        },
        timesheets: timesheetData.slice(0, 20).map(row => ({
          name: row.member.full_name || row.member.email,
          email: row.member.email,
          totalHours: formatMinutes(row.weeklyTotal),
          dailyHours: row.dailyHours.map(d => ({
            date: format(d.date, 'EEE MMM d'),
            hours: formatMinutes(d.minutes),
          })),
        })),
      };

      const { data, error } = await supabase.functions.invoke('send-report-email', {
        body: { 
          to: emails, 
          reportType: 'timesheet',
          reportData 
        },
      });

      if (error) throw error;

      const result = data as { successful: string[]; failed: { email: string; reason: string }[] };
      
      if (result.successful.length > 0) {
        toast.success(`Report sent to ${result.successful.length} recipient${result.successful.length !== 1 ? 's' : ''}`);
      }
      if (result.failed.length > 0) {
        toast.error(`Failed to send to ${result.failed.length} recipient${result.failed.length !== 1 ? 's' : ''}`);
      }

      return result;
    } catch (error: any) {
      console.error('Failed to send email:', error);
      toast.error('Failed to send email: ' + (error.message || 'Unknown error'));
      return { successful: [], failed: emails.map(e => ({ email: e, reason: error.message || 'Unknown error' })) };
    } finally {
      setIsSendingEmail(false);
    }
  };

  const isLoading = loadingEntries || loadingProfiles;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-[400px] w-full" />
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
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-center lg:justify-between gap-4">
        <div className="flex flex-col sm:flex-row items-center gap-2">
          <div className="flex items-center justify-center gap-2">
            <Button variant="outline" size="icon" onClick={() => setWeekStart(subWeeks(weekStart, 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2 px-4 py-2 border rounded-md">
              <Calendar className="w-4 h-4 text-muted-foreground" />
              <span className="font-medium text-sm">
                {format(weekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
              </span>
            </div>
            <Button 
              variant="outline" 
              size="icon" 
              onClick={() => setWeekStart(addWeeks(weekStart, 1))}
              disabled={weekStart >= startOfWeek(new Date(), { weekStartsOn: 0 })}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Select value={numWeeks} onValueChange={setNumWeeks}>
              <SelectTrigger className="w-[100px] sm:w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 Week</SelectItem>
                <SelectItem value="2">2 Weeks</SelectItem>
                <SelectItem value="4">4 Weeks</SelectItem>
              </SelectContent>
            </Select>

            {/* Team Member Filter - Desktop */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="hidden sm:flex min-w-[140px] justify-start">
                  <Users className="w-4 h-4 mr-2" />
                  {selectedMemberIds.length === 0 ? (
                    <span className="text-muted-foreground">All Members</span>
                  ) : (
                    <span>{selectedMemberIds.length} selected</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2 bg-background" align="start">
                <div className="flex items-center justify-between mb-2 pb-2 border-b">
                  <span className="text-sm font-medium">Filter by Member</span>
                  {selectedMemberIds.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearSelectedMembers} className="h-6 px-2 text-xs">
                      Clear all
                    </Button>
                  )}
                </div>
                <div className="relative mb-2">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search members..."
                    value={memberFilterSearch}
                    onChange={(e) => setMemberFilterSearch(e.target.value)}
                    className="pl-8 h-8 text-sm"
                  />
                </div>
                <div className="max-h-[200px] overflow-y-auto space-y-1">
                  {filteredDropdownMembers.map(member => (
                    <div
                      key={member.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer"
                      onClick={() => toggleMember(member.id)}
                    >
                      <Checkbox
                        checked={selectedMemberIds.includes(member.id)}
                        onClick={(e) => e.stopPropagation()}
                        onCheckedChange={() => toggleMember(member.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate">{member.full_name || member.email}</div>
                        {member.full_name && (
                          <div className="text-xs text-muted-foreground truncate">{member.email}</div>
                        )}
                      </div>
                    </div>
                  ))}
                  {filteredDropdownMembers.length === 0 && (
                    <div className="text-sm text-muted-foreground text-center py-4">
                      {allTeamMembers.length === 0 ? 'No team members' : 'No matches found'}
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Mobile: Team Member Filter + Actions on second row */}
          <div className="flex sm:hidden items-center justify-center gap-2 w-full">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="flex-1 justify-start">
                  <Users className="w-4 h-4 mr-2" />
                  {selectedMemberIds.length === 0 ? (
                    <span className="text-muted-foreground">All Members</span>
                  ) : (
                    <span>{selectedMemberIds.length} selected</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2 bg-background" align="start">
                <div className="flex items-center justify-between mb-2 pb-2 border-b">
                  <span className="text-sm font-medium">Filter by Member</span>
                  {selectedMemberIds.length > 0 && (
                    <Button variant="ghost" size="sm" onClick={clearSelectedMembers} className="h-6 px-2 text-xs">
                      Clear all
                    </Button>
                  )}
                </div>
                <div className="relative mb-2">
                  <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search members..."
                    value={memberFilterSearch}
                    onChange={(e) => setMemberFilterSearch(e.target.value)}
                    className="pl-8 h-8 text-sm"
                  />
                </div>
                <div className="max-h-[200px] overflow-y-auto space-y-1">
                  {filteredDropdownMembers.map(member => (
                    <div
                      key={member.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer"
                      onClick={() => toggleMember(member.id)}
                    >
                      <Checkbox
                        checked={selectedMemberIds.includes(member.id)}
                        onClick={(e) => e.stopPropagation()}
                        onCheckedChange={() => toggleMember(member.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate">{member.full_name || member.email}</div>
                        {member.full_name && (
                          <div className="text-xs text-muted-foreground truncate">{member.email}</div>
                        )}
                      </div>
                    </div>
                  ))}
                  {filteredDropdownMembers.length === 0 && (
                    <div className="text-sm text-muted-foreground text-center py-4">
                      {allTeamMembers.length === 0 ? 'No team members' : 'No matches found'}
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
            {/* Mobile Actions Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <MoreVertical className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-popover">
                <DropdownMenuItem onClick={() => setEmailDialogOpen(true)} disabled={timesheetData.length === 0}>
                  <Mail className="w-4 h-4 mr-2" />
                  Email
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportToPDF} disabled={isExportingPdf}>
                  <FileText className="w-4 h-4 mr-2" />
                  Print/PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportToCSV}>
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        
        {/* Desktop Actions */}
        <div className="hidden sm:flex items-center justify-end gap-2">
          <Button onClick={() => setEmailDialogOpen(true)} variant="outline" size="sm" disabled={timesheetData.length === 0}>
            <Mail className="w-4 h-4 mr-2" />
            Email
          </Button>
          <Button onClick={exportToPDF} variant="outline" size="sm" disabled={isExportingPdf}>
            {isExportingPdf ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <FileText className="w-4 h-4 mr-2" />
            )}
            Print/PDF
          </Button>
          <Button onClick={exportToCSV} variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

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
                    <th key={day.toISOString()} className="text-center py-3 px-2 font-semibold min-w-[70px]">
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
                    <td colSpan={weekDays.length + 2} className="text-center py-12 text-muted-foreground">
                      No time entries for this period
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

      {/* Email Dialog */}
      <ReportEmailDialog
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        onSend={sendReportEmail}
        isSending={isSendingEmail}
        title="Email Timesheet Report"
      />
    </div>
  );
};

export default TimesheetReportTab;
