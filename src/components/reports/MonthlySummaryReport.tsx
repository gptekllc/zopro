import { useState, useMemo } from 'react';
import { format, subMonths, startOfMonth, endOfMonth, eachMonthOfInterval, parseISO, startOfYear, subYears } from 'date-fns';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Mail } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useJobs } from '@/hooks/useJobs';
import { useQuotes } from '@/hooks/useQuotes';
import { useInvoices } from '@/hooks/useInvoices';
import { useAllPayments } from '@/hooks/usePayments';
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
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Briefcase,
  FileText,
  Receipt,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Download,
  Printer,
} from 'lucide-react';
import { formatAmount } from '@/lib/formatAmount';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ReportEmailDialog } from './ReportEmailDialog';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

const MonthlySummaryReport = () => {
  const [timeRange, setTimeRange] = useState('6');
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  
  const { data: jobs, isLoading: loadingJobs } = useJobs();
  const { data: quotes, isLoading: loadingQuotes } = useQuotes();
  const { data: invoices, isLoading: loadingInvoices } = useInvoices();
  const { data: payments, isLoading: loadingPayments } = useAllPayments();

  const isLoading = loadingJobs || loadingQuotes || loadingInvoices || loadingPayments;

  // Generate months for the selected range
  const months = useMemo(() => {
    const now = new Date();
    
    if (timeRange === 'custom' && customStartDate && customEndDate) {
      return eachMonthOfInterval({ 
        start: startOfMonth(customStartDate), 
        end: endOfMonth(customEndDate) 
      });
    }
    
    if (timeRange === 'ytd') {
      return eachMonthOfInterval({ 
        start: startOfYear(now), 
        end: endOfMonth(now) 
      });
    }
    
    if (timeRange === 'lastyear') {
      const lastYear = subYears(now, 1);
      return eachMonthOfInterval({ 
        start: startOfYear(lastYear), 
        end: endOfMonth(new Date(lastYear.getFullYear(), 11, 31))
      });
    }
    
    const endDate = endOfMonth(now);
    const startDate = startOfMonth(subMonths(now, parseInt(timeRange) - 1));
    return eachMonthOfInterval({ start: startDate, end: endDate });
  }, [timeRange, customStartDate, customEndDate]);

  // Calculate monthly data
  const monthlyData = useMemo(() => {
    if (!jobs || !quotes || !invoices || !payments) return [];

    return months.map(month => {
      const monthStart = startOfMonth(month);
      const monthEnd = endOfMonth(month);

      // Jobs completed this month
      const completedJobs = jobs.filter(j => {
        if (j.status !== 'completed' && j.status !== 'invoiced' && j.status !== 'paid') return false;
        const date = j.actual_end ? parseISO(j.actual_end) : parseISO(j.updated_at);
        return date >= monthStart && date <= monthEnd;
      }).length;

      // Quotes sent this month
      const sentQuotes = quotes.filter(q => {
        if (q.status === 'draft') return false;
        const date = parseISO(q.created_at);
        return date >= monthStart && date <= monthEnd;
      }).length;

      // Quotes accepted this month
      const acceptedQuotes = quotes.filter(q => {
        // Check for accepted status (the status enum may not include 'approved')
        if (q.status !== 'accepted' && q.status !== 'sent') return false;
        if (q.status === 'sent') return false; // Only count accepted
        const date = parseISO(q.updated_at);
        return date >= monthStart && date <= monthEnd;
      }).length;

      // Invoices generated this month
      const generatedInvoices = invoices.filter(i => {
        const date = parseISO(i.created_at);
        return date >= monthStart && date <= monthEnd;
      }).length;

      // Revenue collected this month (completed payments only)
      const monthlyRevenue = payments
        .filter(p => {
          if (p.status !== 'completed') return false;
          const date = parseISO(p.payment_date);
          return date >= monthStart && date <= monthEnd;
        })
        .reduce((sum, p) => sum + Number(p.amount), 0);

      // Invoice total generated this month
      const invoicedAmount = invoices
        .filter(i => {
          const date = parseISO(i.created_at);
          return date >= monthStart && date <= monthEnd;
        })
        .reduce((sum, i) => sum + Number(i.total), 0);

      return {
        month: format(month, 'MMM yyyy'),
        shortMonth: format(month, 'MMM'),
        completedJobs,
        sentQuotes,
        acceptedQuotes,
        generatedInvoices,
        revenue: monthlyRevenue,
        invoiced: invoicedAmount,
      };
    });
  }, [months, jobs, quotes, invoices, payments]);

  // Calculate totals and comparisons
  const stats = useMemo(() => {
    if (monthlyData.length === 0) return null;

    const totalJobs = monthlyData.reduce((sum, m) => sum + m.completedJobs, 0);
    const totalQuotes = monthlyData.reduce((sum, m) => sum + m.sentQuotes, 0);
    const totalInvoices = monthlyData.reduce((sum, m) => sum + m.generatedInvoices, 0);
    const totalRevenue = monthlyData.reduce((sum, m) => sum + m.revenue, 0);

    // Compare current month with previous month
    const currentMonth = monthlyData[monthlyData.length - 1];
    const previousMonth = monthlyData.length > 1 ? monthlyData[monthlyData.length - 2] : null;

    const revenueChange = previousMonth && previousMonth.revenue > 0
      ? ((currentMonth.revenue - previousMonth.revenue) / previousMonth.revenue) * 100
      : 0;

    return {
      totalJobs,
      totalQuotes,
      totalInvoices,
      totalRevenue,
      currentMonthRevenue: currentMonth.revenue,
      revenueChange,
    };
  }, [monthlyData]);

  // Job status distribution
  const jobStatusData = useMemo(() => {
    if (!jobs) return [];
    
    const statusCounts: Record<string, number> = {};
    jobs.forEach(job => {
      statusCounts[job.status] = (statusCounts[job.status] || 0) + 1;
    });

    return Object.entries(statusCounts).map(([status, count]) => ({
      name: status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' '),
      value: count,
    }));
  }, [jobs]);

  // Quote conversion rate
  const quoteConversionRate = useMemo(() => {
    if (!quotes || quotes.length === 0) return 0;
    // For conversion, count quotes that resulted in jobs or were explicitly accepted
    const accepted = quotes.filter(q => q.job_id !== null).length;
    const total = quotes.filter(q => q.status !== 'draft').length;
    return total > 0 ? (accepted / total) * 100 : 0;
  }, [quotes]);

  // Export to CSV
  const exportToCSV = () => {
    if (monthlyData.length === 0) return;

    const headers = ['Month', 'Jobs Completed', 'Quotes Sent', 'Quotes Accepted', 'Invoices Generated', 'Revenue', 'Invoiced Amount'];
    
    const rows = monthlyData.map(m => [
      m.month,
      m.completedJobs,
      m.sentQuotes,
      m.acceptedQuotes,
      m.generatedInvoices,
      `$${formatAmount(m.revenue)}`,
      `$${formatAmount(m.invoiced)}`,
    ]);

    // Add totals row
    rows.push([
      'TOTAL',
      stats?.totalJobs || 0,
      stats?.totalQuotes || 0,
      monthlyData.reduce((sum, m) => sum + m.acceptedQuotes, 0),
      stats?.totalInvoices || 0,
      `$${formatAmount(stats?.totalRevenue || 0)}`,
      `$${formatAmount(monthlyData.reduce((sum, m) => sum + m.invoiced, 0))}`,
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `monthly-summary-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // Print/PDF export
  const printReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const timeRangeLabel = timeRange === 'custom' 
      ? `${customStartDate ? format(customStartDate, 'MMM yyyy') : ''} - ${customEndDate ? format(customEndDate, 'MMM yyyy') : ''}`
      : timeRange === 'ytd' 
        ? 'Year to Date'
        : timeRange === 'lastyear'
          ? 'Last Year'
          : timeRange === '1'
            ? 'Last Month'
            : `Last ${timeRange} Months`;

    const tableRows = monthlyData.map(m => `
      <tr>
        <td style="border: 1px solid #ddd; padding: 8px;">${m.month}</td>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${m.completedJobs}</td>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${m.sentQuotes}</td>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${m.generatedInvoices}</td>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">$${formatAmount(m.revenue)}</td>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">$${formatAmount(m.invoiced)}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Monthly Summary Report</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; color: #333; }
          h1 { color: #1a1a2e; margin-bottom: 5px; }
          .subtitle { color: #666; margin-bottom: 20px; }
          .summary-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px; }
          .card { border: 1px solid #ddd; border-radius: 8px; padding: 15px; }
          .card-title { font-size: 12px; color: #666; margin-bottom: 5px; }
          .card-value { font-size: 24px; font-weight: bold; }
          .green { color: #16a34a; }
          table { border-collapse: collapse; width: 100%; margin-top: 20px; }
          th { background-color: #f5f5f5; border: 1px solid #ddd; padding: 10px; text-align: left; }
          .totals { font-weight: bold; background-color: #f9f9f9; }
          @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
        </style>
      </head>
      <body>
        <h1>Monthly Summary Report</h1>
        <p class="subtitle">${timeRangeLabel} • Generated on ${format(new Date(), 'MMMM d, yyyy')}</p>
        
        <div class="summary-cards">
          <div class="card">
            <div class="card-title">Jobs Completed</div>
            <div class="card-value">${stats?.totalJobs || 0}</div>
          </div>
          <div class="card">
            <div class="card-title">Quotes Sent</div>
            <div class="card-value">${stats?.totalQuotes || 0}</div>
          </div>
          <div class="card">
            <div class="card-title">Invoices Generated</div>
            <div class="card-value">${stats?.totalInvoices || 0}</div>
          </div>
          <div class="card">
            <div class="card-title">Total Revenue</div>
            <div class="card-value green">$${formatAmount(stats?.totalRevenue || 0)}</div>
          </div>
        </div>

        <h2>Monthly Breakdown</h2>
        <table>
          <thead>
            <tr>
              <th>Month</th>
              <th style="text-align: right;">Jobs</th>
              <th style="text-align: right;">Quotes</th>
              <th style="text-align: right;">Invoices</th>
              <th style="text-align: right;">Revenue</th>
              <th style="text-align: right;">Invoiced</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
            <tr class="totals">
              <td style="border: 1px solid #ddd; padding: 8px;">TOTAL</td>
              <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${stats?.totalJobs || 0}</td>
              <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${stats?.totalQuotes || 0}</td>
              <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${stats?.totalInvoices || 0}</td>
              <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">$${formatAmount(stats?.totalRevenue || 0)}</td>
              <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">$${formatAmount(monthlyData.reduce((sum, m) => sum + m.invoiced, 0))}</td>
            </tr>
          </tbody>
        </table>
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const getTimeRangeLabel = () => {
    if (timeRange === 'custom' && customStartDate && customEndDate) {
      return `${format(customStartDate, 'MMM yyyy')} - ${format(customEndDate, 'MMM yyyy')}`;
    }
    if (timeRange === 'ytd') return 'Year to Date';
    if (timeRange === 'lastyear') return 'Last Year';
    if (timeRange === '1') return 'Last Month';
    return `Last ${timeRange} Months`;
  };

  // Send email
  const sendReportEmail = async (emails: string[]): Promise<{ successful: string[]; failed: { email: string; reason: string }[] }> => {
    setIsSendingEmail(true);
    try {
      const reportData = {
        title: 'Monthly Summary Report',
        timeRange: getTimeRangeLabel(),
        generatedAt: format(new Date(), 'MMMM d, yyyy'),
        stats: {
          totalJobs: stats?.totalJobs || 0,
          totalQuotes: stats?.totalQuotes || 0,
          totalInvoices: stats?.totalInvoices || 0,
          totalRevenue: formatAmount(stats?.totalRevenue || 0),
        },
        months: monthlyData.map(m => ({
          month: m.month,
          completedJobs: m.completedJobs,
          sentQuotes: m.sentQuotes,
          generatedInvoices: m.generatedInvoices,
          revenue: formatAmount(m.revenue),
          invoiced: formatAmount(m.invoiced),
        })),
      };

      const { data, error } = await supabase.functions.invoke('send-report-email', {
        body: { 
          to: emails, 
          reportType: 'monthly-summary',
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
      {/* Time Range Selector and Export */}
      <div className="flex flex-wrap justify-end gap-2">
        <Button onClick={() => setEmailDialogOpen(true)} variant="outline" size="sm" disabled={monthlyData.length === 0}>
          <Mail className="w-4 h-4 mr-2" />
          Email
        </Button>
        <Button onClick={printReport} variant="outline" size="sm" disabled={monthlyData.length === 0}>
          <Printer className="w-4 h-4 mr-2" />
          Print/PDF
        </Button>
        <Button onClick={exportToCSV} variant="outline" size="sm" disabled={monthlyData.length === 0}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Select range" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">Last Month</SelectItem>
            <SelectItem value="3">Last 3 months</SelectItem>
            <SelectItem value="6">Last 6 months</SelectItem>
            <SelectItem value="12">Last 12 months</SelectItem>
            <SelectItem value="ytd">Year to Date</SelectItem>
            <SelectItem value="lastyear">Last Year</SelectItem>
            <SelectItem value="custom">Custom Range</SelectItem>
          </SelectContent>
        </Select>
        {timeRange === 'custom' && (
          <>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[140px] justify-start text-left font-normal",
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
                />
              </PopoverContent>
            </Popover>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[140px] justify-start text-left font-normal",
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
                />
              </PopoverContent>
            </Popover>
          </>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Jobs Completed</CardTitle>
            <Briefcase className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalJobs || 0}</div>
            <p className="text-xs text-muted-foreground">
              {timeRange === 'custom' ? 'In selected range' : timeRange === 'ytd' ? 'Year to date' : timeRange === 'lastyear' ? 'Last year' : `In the last ${timeRange === '1' ? 'month' : `${timeRange} months`}`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quotes Sent</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalQuotes || 0}</div>
            <p className="text-xs text-muted-foreground">
              {quoteConversionRate.toFixed(0)}% conversion rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Invoices Generated</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalInvoices || 0}</div>
            <p className="text-xs text-muted-foreground">
              {timeRange === 'custom' ? 'In selected range' : timeRange === 'ytd' ? 'Year to date' : timeRange === 'lastyear' ? 'Last year' : `In the last ${timeRange === '1' ? 'month' : `${timeRange} months`}`}
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
            <div className="flex items-center text-xs">
              {stats?.revenueChange !== undefined && stats.revenueChange !== 0 && (
                <>
                  {stats.revenueChange > 0 ? (
                    <TrendingUp className="h-3 w-3 text-green-600 mr-1" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-600 mr-1" />
                  )}
                  <span className={stats.revenueChange > 0 ? 'text-green-600' : 'text-red-600'}>
                    {Math.abs(stats.revenueChange).toFixed(0)}%
                  </span>
                  <span className="text-muted-foreground ml-1">vs last month</span>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Revenue Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="shortMonth" className="text-xs" />
              <YAxis 
                className="text-xs"
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip 
                formatter={(value: number) => [`$${formatAmount(value)}`, 'Revenue']}
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Line 
                type="monotone" 
                dataKey="revenue" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--primary))' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Activity Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Monthly Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="shortMonth" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Bar dataKey="completedJobs" name="Jobs Completed" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="sentQuotes" name="Quotes Sent" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="generatedInvoices" name="Invoices" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Job Status Distribution */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Job Status Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {jobStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={jobStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {jobStatusData.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                No job data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Quote Conversion</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Conversion Rate</span>
                <span className="text-2xl font-bold">{quoteConversionRate.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-3">
                <div 
                  className="bg-primary h-3 rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(quoteConversionRate, 100)}%` }}
                />
              </div>
              <div className="grid grid-cols-2 gap-4 pt-4">
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold">{quotes?.filter(q => q.status !== 'draft').length || 0}</div>
                  <div className="text-xs text-muted-foreground">Total Sent</div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">
                    {quotes?.filter(q => q.job_id !== null).length || 0}
                  </div>
                  <div className="text-xs text-muted-foreground">Converted to Jobs</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Email Dialog */}
      <ReportEmailDialog
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        onSend={sendReportEmail}
        isSending={isSendingEmail}
        title="Email Monthly Summary Report"
      />
    </div>
  );
};

export default MonthlySummaryReport;
