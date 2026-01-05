import { useMemo, useState } from 'react';
import { format, parseISO, differenceInMinutes, subMonths, startOfMonth, endOfMonth, startOfYear, subYears, isWithinInterval } from 'date-fns';
import { useProfiles } from '@/hooks/useProfiles';
import { useTimeEntries } from '@/hooks/useTimeEntries';
import { useJobs } from '@/hooks/useJobs';
import { useAllPayments } from '@/hooks/usePayments';
import { useInvoices } from '@/hooks/useInvoices';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TablePagination } from '@/components/ui/table-pagination';
import { SortableTableHeader } from '@/components/ui/sortable-table-header';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  Users,
  Clock,
  Briefcase,
  DollarSign,
  Download,
  Search,
  Printer,
  CalendarIcon,
  Mail,
  User,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { formatAmount } from '@/lib/formatAmount';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ReportEmailDialog } from './ReportEmailDialog';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

type SortField = 'name' | 'jobsCompleted' | 'hoursWorked' | 'revenueGenerated' | 'avgJobValue';
type SortDirection = 'asc' | 'desc';

const TechnicianPerformanceReport = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('revenueGenerated');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [timeRange, setTimeRange] = useState('all');
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const { data: profiles, isLoading: loadingProfiles } = useProfiles();
  const { data: timeEntries, isLoading: loadingTimeEntries } = useTimeEntries();
  const { data: jobs, isLoading: loadingJobs } = useJobs();
  const { data: payments, isLoading: loadingPayments } = useAllPayments();
  const { data: invoices, isLoading: loadingInvoices } = useInvoices();

  const isLoading = loadingProfiles || loadingTimeEntries || loadingJobs || loadingPayments || loadingInvoices;

  // Toggle member selection for filter
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

  // Get all team members for filter dropdown
  const allTeamMembers = useMemo(() => {
    if (!profiles) return [];
    return profiles.filter(p => 
      ['technician', 'manager', 'admin'].includes(p.role) && 
      p.employment_status !== 'terminated'
    );
  }, [profiles]);

  // Calculate date range
  const dateRange = useMemo(() => {
    const now = new Date();
    
    if (timeRange === 'custom' && customStartDate && customEndDate) {
      return { start: startOfMonth(customStartDate), end: endOfMonth(customEndDate) };
    }
    
    if (timeRange === 'all') return null;
    
    if (timeRange === 'ytd') {
      return { start: startOfYear(now), end: now };
    }
    
    if (timeRange === 'lastyear') {
      const lastYear = subYears(now, 1);
      return { start: startOfYear(lastYear), end: new Date(lastYear.getFullYear(), 11, 31) };
    }
    
    const months = parseInt(timeRange);
    return { start: startOfMonth(subMonths(now, months - 1)), end: now };
  }, [timeRange, customStartDate, customEndDate]);

  // Calculate technician metrics
  const technicianData = useMemo(() => {
    if (!profiles || !timeEntries || !jobs || !payments || !invoices) return [];

    // Only include team members (technicians, managers, admins)
    const teamMembers = profiles.filter(p => 
      ['technician', 'manager', 'admin'].includes(p.role) && 
      p.employment_status !== 'terminated'
    );

    return teamMembers.map(technician => {
      // Filter time entries by date range
      const techTimeEntries = timeEntries.filter(te => {
        if (te.user_id !== technician.id) return false;
        if (!te.clock_out) return false;
        
        if (dateRange) {
          const clockIn = parseISO(te.clock_in);
          if (!isWithinInterval(clockIn, { start: dateRange.start, end: dateRange.end })) {
            return false;
          }
        }
        return true;
      });

      // Calculate total hours worked
      const totalMinutesWorked = techTimeEntries.reduce((sum, te) => {
        const clockIn = parseISO(te.clock_in);
        const clockOut = te.clock_out ? parseISO(te.clock_out) : new Date();
        const minutes = differenceInMinutes(clockOut, clockIn) - (te.break_minutes || 0);
        return sum + Math.max(0, minutes);
      }, 0);
      const hoursWorked = Math.round((totalMinutesWorked / 60) * 100) / 100;

      // Get jobs assigned to this technician
      const techJobs = jobs.filter(j => {
        if (j.assigned_to !== technician.id) return false;
        if (!['completed', 'invoiced', 'paid'].includes(j.status)) return false;
        
        if (dateRange) {
          const jobDate = j.actual_end ? parseISO(j.actual_end) : parseISO(j.updated_at);
          if (!isWithinInterval(jobDate, { start: dateRange.start, end: dateRange.end })) {
            return false;
          }
        }
        return true;
      });

      // Calculate revenue from jobs assigned to this technician
      const techInvoiceIds = invoices
        .filter(i => techJobs.some(j => j.id === i.job_id))
        .map(i => i.id);

      const revenueGenerated = payments
        .filter(p => techInvoiceIds.includes(p.invoice_id) && p.status === 'completed')
        .reduce((sum, p) => sum + Number(p.amount), 0);

      const avgJobValue = techJobs.length > 0 ? revenueGenerated / techJobs.length : 0;

      return {
        id: technician.id,
        name: technician.full_name || technician.email,
        email: technician.email,
        role: technician.role,
        jobsCompleted: techJobs.length,
        hoursWorked,
        revenueGenerated,
        avgJobValue,
        hourlyRate: technician.hourly_rate || 0,
        effectiveHourlyRate: hoursWorked > 0 ? revenueGenerated / hoursWorked : 0,
      };
    }).filter(t => t.jobsCompleted > 0 || t.hoursWorked > 0);
  }, [profiles, timeEntries, jobs, payments, invoices, dateRange]);

  // Filter and sort
  const filteredData = useMemo(() => {
    let result = technicianData.filter(t => {
      // Apply member filter if any selected
      if (selectedMemberIds.length > 0 && !selectedMemberIds.includes(t.id)) {
        return false;
      }
      // Apply search filter
      return t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.email.toLowerCase().includes(searchQuery.toLowerCase());
    });

    result.sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];
      
      if (typeof aVal === 'string') aVal = aVal.toLowerCase();
      if (typeof bVal === 'string') bVal = bVal.toLowerCase();
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [technicianData, searchQuery, sortField, sortDirection, selectedMemberIds]);

  // Get selected member names for display
  const getSelectedMemberNames = () => {
    if (selectedMemberIds.length === 0) return null;
    return selectedMemberIds
      .map(id => allTeamMembers.find(m => m.id === id))
      .filter(Boolean)
      .map(m => m!.full_name || m!.email)
      .join(', ');
  };

  // Reset to first page when filters change
  useMemo(() => {
    setCurrentPage(1);
  }, [searchQuery, sortField, sortDirection, timeRange, customStartDate, customEndDate, pageSize, selectedMemberIds]);

  // Paginated data
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredData.slice(startIndex, startIndex + pageSize);
  }, [filteredData, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredData.length / pageSize);


  // Calculate summary stats
  const stats = useMemo(() => {
    if (filteredData.length === 0) return null;

    const totalHours = filteredData.reduce((sum, t) => sum + t.hoursWorked, 0);
    const totalJobs = filteredData.reduce((sum, t) => sum + t.jobsCompleted, 0);
    const totalRevenue = filteredData.reduce((sum, t) => sum + t.revenueGenerated, 0);
    const avgEffectiveRate = totalHours > 0 ? totalRevenue / totalHours : 0;

    return {
      teamSize: filteredData.length,
      totalHours,
      totalJobs,
      totalRevenue,
      avgEffectiveRate,
    };
  }, [filteredData]);

  // Chart data
  const chartData = useMemo(() => {
    return filteredData
      .sort((a, b) => b.revenueGenerated - a.revenueGenerated)
      .slice(0, 10)
      .map(t => ({
        name: t.name.length > 12 ? t.name.substring(0, 12) + '...' : t.name,
        jobs: t.jobsCompleted,
        hours: t.hoursWorked,
        revenue: t.revenueGenerated,
      }));
  }, [filteredData]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const getTimeRangeLabel = () => {
    if (timeRange === 'all') return 'All Time';
    if (timeRange === 'custom' && customStartDate && customEndDate) {
      return `${format(customStartDate, 'MMM yyyy')} - ${format(customEndDate, 'MMM yyyy')}`;
    }
    if (timeRange === 'ytd') return 'Year to Date';
    if (timeRange === 'lastyear') return 'Last Year';
    if (timeRange === '1') return 'Last Month';
    return `Last ${timeRange} Months`;
  };

  // Export to CSV
  const exportToCSV = () => {
    if (filteredData.length === 0) return;

    const headers = ['Team Member', 'Email', 'Role', 'Jobs Completed', 'Hours Worked', 'Revenue Generated', 'Avg Job Value', 'Effective Rate'];
    
    const rows = filteredData.map(t => [
      t.name,
      t.email,
      t.role,
      t.jobsCompleted,
      t.hoursWorked.toFixed(1),
      `$${formatAmount(t.revenueGenerated)}`,
      `$${formatAmount(t.avgJobValue)}`,
      `$${formatAmount(t.effectiveHourlyRate)}/hr`,
    ]);

    // Add summary
    rows.push([]);
    rows.push(['Summary', '', '', '', '', '', '', '']);
    rows.push(['Team Size', stats?.teamSize || 0, '', '', '', '', '', '']);
    rows.push(['Total Hours', stats?.totalHours.toFixed(1) || '0', '', '', '', '', '', '']);
    rows.push(['Total Jobs', stats?.totalJobs || 0, '', '', '', '', '', '']);
    rows.push(['Total Revenue', `$${formatAmount(stats?.totalRevenue || 0)}`, '', '', '', '', '', '']);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `technician-performance-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // Print/PDF export
  const printReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const tableRows = filteredData.map(t => `
      <tr>
        <td style="border: 1px solid #ddd; padding: 8px;">${t.name}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${t.role}</td>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${t.jobsCompleted}</td>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${t.hoursWorked.toFixed(1)}</td>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">$${formatAmount(t.revenueGenerated)}</td>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">$${formatAmount(t.effectiveHourlyRate)}/hr</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Technician Performance Report</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
          h1 { color: #1a1a2e; margin-bottom: 5px; }
          .subtitle { color: #666; margin-bottom: 20px; }
          .summary-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px; }
          .card { border: 1px solid #ddd; border-radius: 8px; padding: 15px; }
          .card-title { font-size: 12px; color: #666; margin-bottom: 5px; }
          .card-value { font-size: 24px; font-weight: bold; }
          .green { color: #16a34a; }
          table { border-collapse: collapse; width: 100%; margin-top: 20px; font-size: 12px; }
          th { background-color: #f5f5f5; border: 1px solid #ddd; padding: 8px; text-align: left; }
          @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <h1>Technician Performance Report</h1>
        <p class="subtitle">${getTimeRangeLabel()} • Generated on ${format(new Date(), 'MMMM d, yyyy')}</p>
        
        <div class="summary-cards">
          <div class="card">
            <div class="card-title">Team Members</div>
            <div class="card-value">${stats?.teamSize || 0}</div>
          </div>
          <div class="card">
            <div class="card-title">Total Jobs</div>
            <div class="card-value">${stats?.totalJobs || 0}</div>
          </div>
          <div class="card">
            <div class="card-title">Total Hours</div>
            <div class="card-value">${stats?.totalHours.toFixed(1) || '0'}</div>
          </div>
          <div class="card">
            <div class="card-title">Total Revenue</div>
            <div class="card-value green">$${formatAmount(stats?.totalRevenue || 0)}</div>
          </div>
        </div>

        <h2>Team Performance</h2>
        <table>
          <thead>
            <tr>
              <th>Team Member</th>
              <th>Role</th>
              <th style="text-align: right;">Jobs</th>
              <th style="text-align: right;">Hours</th>
              <th style="text-align: right;">Revenue</th>
              <th style="text-align: right;">Effective Rate</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  // Send email
  const sendReportEmail = async (emails: string[]): Promise<{ successful: string[]; failed: { email: string; reason: string }[] }> => {
    setIsSendingEmail(true);
    try {
      const reportData = {
        title: 'Technician Performance Report',
        timeRange: getTimeRangeLabel(),
        generatedAt: format(new Date(), 'MMMM d, yyyy'),
        stats: {
          teamSize: stats?.teamSize || 0,
          totalJobs: stats?.totalJobs || 0,
          totalHours: stats?.totalHours.toFixed(1) || '0',
          totalRevenue: formatAmount(stats?.totalRevenue || 0),
        },
        technicians: filteredData.slice(0, 20).map(t => ({
          name: t.name,
          role: t.role,
          jobsCompleted: t.jobsCompleted,
          hoursWorked: t.hoursWorked.toFixed(1),
          revenueGenerated: formatAmount(t.revenueGenerated),
          effectiveRate: formatAmount(t.effectiveHourlyRate),
        })),
      };

      const { data, error } = await supabase.functions.invoke('send-report-email', {
        body: { 
          to: emails, 
          reportType: 'technician-performance',
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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with filters and export */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2">
            <div className="relative w-full sm:w-auto sm:min-w-[200px]">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search team members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={timeRange} onValueChange={setTimeRange}>
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Time range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="1">Last Month</SelectItem>
                <SelectItem value="3">Last 3 Months</SelectItem>
                <SelectItem value="6">Last 6 Months</SelectItem>
                <SelectItem value="12">Last 12 Months</SelectItem>
                <SelectItem value="ytd">Year to Date</SelectItem>
                <SelectItem value="lastyear">Last Year</SelectItem>
                <SelectItem value="custom">Custom Range</SelectItem>
              </SelectContent>
            </Select>

            {/* Team Member Filter */}
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="min-w-[140px] justify-start">
                  <User className="w-4 h-4 mr-2" />
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
                <div className="max-h-[250px] overflow-y-auto space-y-1">
                  {allTeamMembers.map(member => (
                    <div
                      key={member.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted cursor-pointer"
                      onClick={() => toggleMember(member.id)}
                    >
                      <Checkbox
                        checked={selectedMemberIds.includes(member.id)}
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
                  {allTeamMembers.length === 0 && (
                    <div className="text-sm text-muted-foreground text-center py-4">No team members</div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
            {timeRange === 'custom' && (
              <>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-[130px] justify-start text-left font-normal",
                        !customStartDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customStartDate ? format(customStartDate, "MMM yyyy") : "Start"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-popover" align="end">
                    <Calendar
                      mode="single"
                      selected={customStartDate}
                      onSelect={setCustomStartDate}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-[130px] justify-start text-left font-normal",
                        !customEndDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {customEndDate ? format(customEndDate, "MMM yyyy") : "End"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-popover" align="end">
                    <Calendar
                      mode="single"
                      selected={customEndDate}
                      onSelect={setCustomEndDate}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </>
            )}
          </div>
          <div className="flex items-center justify-center lg:justify-end gap-2">
            <Button onClick={() => setEmailDialogOpen(true)} variant="outline" size="sm" disabled={filteredData.length === 0}>
              <Mail className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Email</span>
            </Button>
            <Button onClick={printReport} variant="outline" size="sm" disabled={filteredData.length === 0}>
              <Printer className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Print/PDF</span>
            </Button>
            <Button onClick={exportToCSV} variant="outline" size="sm" disabled={filteredData.length === 0} className="hidden sm:inline-flex">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Team Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.teamSize || 0}</div>
            <p className="text-xs text-muted-foreground">
              Active with data
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Jobs</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalJobs || 0}</div>
            <p className="text-xs text-muted-foreground">
              Completed jobs
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Hours</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalHours.toFixed(1) || '0'}</div>
            <p className="text-xs text-muted-foreground">
              Hours worked
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              ${formatAmount(stats?.totalRevenue || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              ${formatAmount(stats?.avgEffectiveRate || 0)}/hr effective
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Performance Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Team Performance Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                  formatter={(value: number, name: string) => {
                    if (name === 'revenue') return [`$${formatAmount(value)}`, 'Revenue'];
                    if (name === 'hours') return [`${value}h`, 'Hours'];
                    return [value, 'Jobs'];
                  }}
                />
                <Legend />
                <Bar dataKey="jobs" name="Jobs" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="hours" name="Hours" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
              No performance data available
            </div>
          )}
        </CardContent>
      </Card>

      {/* Team Table */}
      <Card>
        <CardHeader>
          <CardTitle>Team Member Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <SortableTableHeader
                    column="name"
                    label="Team Member"
                    currentSortColumn={sortField}
                    currentSortDirection={sortDirection}
                    onSort={handleSort}
                  />
                  <SortableTableHeader
                    column="jobsCompleted"
                    label="Jobs"
                    currentSortColumn={sortField}
                    currentSortDirection={sortDirection}
                    onSort={handleSort}
                    align="right"
                  />
                  <SortableTableHeader
                    column="hoursWorked"
                    label="Hours"
                    currentSortColumn={sortField}
                    currentSortDirection={sortDirection}
                    onSort={handleSort}
                    align="right"
                    className="hidden sm:table-cell"
                  />
                  <SortableTableHeader
                    column="revenueGenerated"
                    label="Revenue"
                    currentSortColumn={sortField}
                    currentSortDirection={sortDirection}
                    onSort={handleSort}
                    align="right"
                    className="hidden md:table-cell"
                  />
                  <SortableTableHeader
                    column="avgJobValue"
                    label="Avg Job"
                    currentSortColumn={sortField}
                    currentSortDirection={sortDirection}
                    onSort={handleSort}
                    align="right"
                    className="hidden lg:table-cell"
                  />
                  <TableHead className="text-right hidden lg:table-cell">
                    Effective Rate
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No team performance data found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedData.map(t => (
                    <TableRow key={t.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{t.name}</div>
                          <div className="text-xs text-muted-foreground capitalize">{t.role}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{t.jobsCompleted}</TableCell>
                      <TableCell className="text-right hidden sm:table-cell">{t.hoursWorked.toFixed(1)}</TableCell>
                      <TableCell className="text-right hidden md:table-cell font-medium text-green-600">
                        ${formatAmount(t.revenueGenerated)}
                      </TableCell>
                      <TableCell className="text-right hidden lg:table-cell">
                        ${formatAmount(t.avgJobValue)}
                      </TableCell>
                      <TableCell className="text-right hidden lg:table-cell text-muted-foreground">
                        ${formatAmount(t.effectiveHourlyRate)}/hr
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={filteredData.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            itemLabel="team members"
          />
        </CardContent>
      </Card>

      {/* Email Dialog */}
      <ReportEmailDialog
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        onSend={sendReportEmail}
        isSending={isSendingEmail}
        title="Email Technician Performance Report"
      />
    </div>
  );
};

export default TechnicianPerformanceReport;
