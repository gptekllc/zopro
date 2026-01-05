import { useMemo, useState } from 'react';
import { format, parseISO, differenceInDays, subMonths, startOfMonth, endOfMonth, startOfYear, subYears, isWithinInterval } from 'date-fns';
import { useCustomers } from '@/hooks/useCustomers';
import { useAllPayments } from '@/hooks/usePayments';
import { useInvoices } from '@/hooks/useInvoices';
import { useJobs } from '@/hooks/useJobs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import {
  Users,
  DollarSign,
  TrendingUp,
  Download,
  Search,
  ArrowUpDown,
  Printer,
  CalendarIcon,
  Mail,
} from 'lucide-react';
import { formatAmount } from '@/lib/formatAmount';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ReportEmailDialog } from './ReportEmailDialog';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

type SortField = 'name' | 'totalRevenue' | 'jobCount' | 'avgJobValue' | 'ltv';
type SortDirection = 'asc' | 'desc';

const CustomerRevenueReport = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('totalRevenue');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [timeRange, setTimeRange] = useState('all');
  const [customStartDate, setCustomStartDate] = useState<Date | undefined>(undefined);
  const [customEndDate, setCustomEndDate] = useState<Date | undefined>(undefined);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const { data: customers, isLoading: loadingCustomers } = useCustomers();
  const { data: payments, isLoading: loadingPayments } = useAllPayments();
  const { data: invoices, isLoading: loadingInvoices } = useInvoices();
  const { data: jobs, isLoading: loadingJobs } = useJobs();

  const isLoading = loadingCustomers || loadingPayments || loadingInvoices || loadingJobs;

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
    
    // Months
    const months = parseInt(timeRange);
    return { start: startOfMonth(subMonths(now, months - 1)), end: now };
  }, [timeRange, customStartDate, customEndDate]);

  // Calculate customer metrics
  const customerData = useMemo(() => {
    if (!customers || !payments || !invoices || !jobs) return [];

    return customers.map(customer => {
      // Get all completed payments for this customer (filtered by date range)
      const customerPayments = payments.filter(p => {
        const invoice = invoices.find(i => i.id === p.invoice_id);
        if (invoice?.customer_id !== customer.id || p.status !== 'completed') return false;
        
        // Apply date filter
        if (dateRange) {
          const paymentDate = parseISO(p.payment_date);
          if (!isWithinInterval(paymentDate, { start: dateRange.start, end: dateRange.end })) {
            return false;
          }
        }
        return true;
      });

      const totalRevenue = customerPayments.reduce((sum, p) => sum + Number(p.amount), 0);

      // Get customer jobs (filtered by date range for job count)
      const customerJobs = jobs.filter(j => j.customer_id === customer.id);
      const completedJobs = customerJobs.filter(j => {
        if (!['completed', 'invoiced', 'paid'].includes(j.status)) return false;
        
        // Apply date filter based on completion/update date
        if (dateRange) {
          const jobDate = j.actual_end ? parseISO(j.actual_end) : parseISO(j.updated_at);
          if (!isWithinInterval(jobDate, { start: dateRange.start, end: dateRange.end })) {
            return false;
          }
        }
        return true;
      });

      // Calculate average job value
      const avgJobValue = completedJobs.length > 0 
        ? totalRevenue / completedJobs.length 
        : 0;

      // Calculate customer lifetime (days since first job) - use all jobs, not filtered
      const allCustomerJobs = jobs.filter(j => j.customer_id === customer.id);
      const firstJobDate = allCustomerJobs.length > 0
        ? allCustomerJobs.reduce((earliest, job) => {
            const jobDate = parseISO(job.created_at);
            return jobDate < earliest ? jobDate : earliest;
          }, parseISO(allCustomerJobs[0].created_at))
        : null;

      const customerLifetimeDays = firstJobDate 
        ? differenceInDays(new Date(), firstJobDate) 
        : 0;

      // Calculate LTV (simple: total revenue, could be more complex with projections)
      // Using a simple model: if customer has been active for X days, project annual value
      const annualizedRevenue = customerLifetimeDays > 30
        ? (totalRevenue / customerLifetimeDays) * 365
        : totalRevenue * 12; // Assume monthly for new customers

      // Get last payment date
      const lastPaymentDate = customerPayments.length > 0
        ? customerPayments.reduce((latest, p) => {
            const pDate = parseISO(p.payment_date);
            return pDate > latest ? pDate : latest;
          }, parseISO(customerPayments[0].payment_date))
        : null;

      return {
        id: customer.id,
        name: customer.name,
        email: customer.email,
        totalRevenue,
        jobCount: completedJobs.length,
        avgJobValue,
        ltv: annualizedRevenue,
        customerLifetimeDays,
        lastPaymentDate,
        paymentCount: customerPayments.length,
      };
    }).filter(c => c.totalRevenue > 0 || c.jobCount > 0);
  }, [customers, payments, invoices, jobs, dateRange]);

  // Filter and sort
  const filteredData = useMemo(() => {
    let result = customerData.filter(c =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.email && c.email.toLowerCase().includes(searchQuery.toLowerCase()))
    );

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
  }, [customerData, searchQuery, sortField, sortDirection]);

  // Calculate summary stats
  const stats = useMemo(() => {
    if (filteredData.length === 0) return null;

    const totalRevenue = filteredData.reduce((sum, c) => sum + c.totalRevenue, 0);
    const avgRevenue = totalRevenue / filteredData.length;
    const topCustomer = filteredData.reduce((top, c) => 
      c.totalRevenue > (top?.totalRevenue || 0) ? c : top, filteredData[0]
    );
    const avgLTV = filteredData.reduce((sum, c) => sum + c.ltv, 0) / filteredData.length;

    return {
      totalCustomers: filteredData.length,
      totalRevenue,
      avgRevenue,
      topCustomer,
      avgLTV,
    };
  }, [filteredData]);

  // Top 10 customers for chart
  const topCustomersChart = useMemo(() => {
    return filteredData
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 10)
      .map(c => ({
        name: c.name.length > 15 ? c.name.substring(0, 15) + '...' : c.name,
        revenue: c.totalRevenue,
      }));
  }, [filteredData]);

  // Revenue distribution for pie chart
  const revenueDistribution = useMemo(() => {
    const sorted = [...filteredData].sort((a, b) => b.totalRevenue - a.totalRevenue);
    const top5 = sorted.slice(0, 5);
    const others = sorted.slice(5);
    const othersTotal = others.reduce((sum, c) => sum + c.totalRevenue, 0);

    const result = top5.map(c => ({
      name: c.name.length > 12 ? c.name.substring(0, 12) + '...' : c.name,
      value: c.totalRevenue,
    }));

    if (othersTotal > 0) {
      result.push({ name: 'Others', value: othersTotal });
    }

    return result;
  }, [filteredData]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    if (filteredData.length === 0) return;

    const headers = ['Customer', 'Email', 'Total Revenue', 'Jobs Completed', 'Avg Job Value', 'Est. Annual LTV', 'Last Payment'];
    
    const rows = filteredData.map(c => [
      c.name,
      c.email || '',
      `$${formatAmount(c.totalRevenue)}`,
      c.jobCount,
      `$${formatAmount(c.avgJobValue)}`,
      `$${formatAmount(c.ltv)}`,
      c.lastPaymentDate ? format(c.lastPaymentDate, 'yyyy-MM-dd') : '-',
    ]);

    // Add summary
    rows.push([]);
    rows.push(['Summary', '', '', '', '', '', '']);
    rows.push(['Total Customers', stats?.totalCustomers || 0, '', '', '', '', '']);
    rows.push(['Total Revenue', `$${formatAmount(stats?.totalRevenue || 0)}`, '', '', '', '', '']);
    rows.push(['Average Revenue per Customer', `$${formatAmount(stats?.avgRevenue || 0)}`, '', '', '', '', '']);
    rows.push(['Average LTV', `$${formatAmount(stats?.avgLTV || 0)}`, '', '', '', '', '']);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `customer-revenue-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // Print/PDF export
  const printReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const timeRangeLabel = timeRange === 'all' 
      ? 'All Time'
      : timeRange === 'custom' && customStartDate && customEndDate
        ? `${format(customStartDate, 'MMM yyyy')} - ${format(customEndDate, 'MMM yyyy')}`
        : timeRange === 'ytd' 
          ? 'Year to Date'
          : timeRange === 'lastyear'
            ? 'Last Year'
            : timeRange === '1'
              ? 'Last Month'
              : `Last ${timeRange} Months`;

    const tableRows = filteredData.slice(0, 50).map(c => `
      <tr>
        <td style="border: 1px solid #ddd; padding: 8px;">${c.name}</td>
        <td style="border: 1px solid #ddd; padding: 8px;">${c.email || '-'}</td>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">$${formatAmount(c.totalRevenue)}</td>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${c.jobCount}</td>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">$${formatAmount(c.avgJobValue)}</td>
        <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">$${formatAmount(c.ltv)}</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Customer Revenue Report</title>
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
        <h1>Customer Revenue Report</h1>
        <p class="subtitle">${timeRangeLabel} • Generated on ${format(new Date(), 'MMMM d, yyyy')}</p>
        
        <div class="summary-cards">
          <div class="card">
            <div class="card-title">Active Customers</div>
            <div class="card-value">${stats?.totalCustomers || 0}</div>
          </div>
          <div class="card">
            <div class="card-title">Total Revenue</div>
            <div class="card-value green">$${formatAmount(stats?.totalRevenue || 0)}</div>
          </div>
          <div class="card">
            <div class="card-title">Avg per Customer</div>
            <div class="card-value">$${formatAmount(stats?.avgRevenue || 0)}</div>
          </div>
          <div class="card">
            <div class="card-title">Avg Annual LTV</div>
            <div class="card-value">$${formatAmount(stats?.avgLTV || 0)}</div>
          </div>
        </div>

        <h2>Customer Details${filteredData.length > 50 ? ' (Top 50)' : ''}</h2>
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th>Email</th>
              <th style="text-align: right;">Total Revenue</th>
              <th style="text-align: right;">Jobs</th>
              <th style="text-align: right;">Avg Job</th>
              <th style="text-align: right;">Est. LTV</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
        ${filteredData.length > 50 ? `<p style="margin-top: 10px; color: #666; font-size: 12px;">Showing top 50 of ${filteredData.length} customers. Export CSV for complete data.</p>` : ''}
      </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
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

  // Send email
  const sendReportEmail = async (emails: string[]): Promise<{ successful: string[]; failed: { email: string; reason: string }[] }> => {
    setIsSendingEmail(true);
    try {
      const reportData = {
        title: 'Customer Revenue Report',
        timeRange: getTimeRangeLabel(),
        generatedAt: format(new Date(), 'MMMM d, yyyy'),
        stats: {
          totalCustomers: stats?.totalCustomers || 0,
          totalRevenue: formatAmount(stats?.totalRevenue || 0),
          avgRevenue: formatAmount(stats?.avgRevenue || 0),
          avgLTV: formatAmount(stats?.avgLTV || 0),
        },
        customers: filteredData.slice(0, 20).map(c => ({
          name: c.name,
          email: c.email || '-',
          totalRevenue: formatAmount(c.totalRevenue),
          jobCount: c.jobCount,
          avgJobValue: formatAmount(c.avgJobValue),
          ltv: formatAmount(c.ltv),
        })),
      };

      const { data, error } = await supabase.functions.invoke('send-report-email', {
        body: { 
          to: emails, 
          reportType: 'customer-revenue',
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
        <div className="flex flex-wrap justify-between gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search customers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex flex-wrap gap-2">
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
            <Button onClick={() => setEmailDialogOpen(true)} variant="outline" size="sm" disabled={filteredData.length === 0}>
              <Mail className="w-4 h-4 mr-2" />
              Email
            </Button>
            <Button onClick={printReport} variant="outline" size="sm" disabled={filteredData.length === 0}>
              <Printer className="w-4 h-4 mr-2" />
              Print/PDF
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
            <CardTitle className="text-sm font-medium">Active Customers</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalCustomers || 0}</div>
            <p className="text-xs text-muted-foreground">
              With revenue or jobs
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
              From all customers
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg per Customer</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${formatAmount(stats?.avgRevenue || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Average revenue
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Annual LTV</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${formatAmount(stats?.avgLTV || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Estimated lifetime value
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top 10 Customers by Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            {topCustomersChart.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topCustomersChart} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    type="number" 
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
                    className="text-xs"
                  />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    width={100}
                    className="text-xs"
                  />
                  <Tooltip 
                    formatter={(value: number) => [`$${formatAmount(value)}`, 'Revenue']}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar 
                    dataKey="revenue" 
                    fill="hsl(var(--primary))" 
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No customer data available
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Revenue Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {revenueDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={revenueDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {revenueDistribution.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => [`$${formatAmount(value)}`, 'Revenue']}
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                No revenue data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Customer Table */}
      <Card>
        <CardHeader>
          <CardTitle>Customer Revenue Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-ml-3 h-8"
                      onClick={() => handleSort('name')}
                    >
                      Customer
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-mr-3 h-8"
                      onClick={() => handleSort('totalRevenue')}
                    >
                      Total Revenue
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right hidden sm:table-cell">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-mr-3 h-8"
                      onClick={() => handleSort('jobCount')}
                    >
                      Jobs
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right hidden md:table-cell">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-mr-3 h-8"
                      onClick={() => handleSort('avgJobValue')}
                    >
                      Avg Job
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right hidden lg:table-cell">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="-mr-3 h-8"
                      onClick={() => handleSort('ltv')}
                    >
                      Est. LTV
                      <ArrowUpDown className="ml-2 h-4 w-4" />
                    </Button>
                  </TableHead>
                  <TableHead className="text-right hidden xl:table-cell">
                    Last Payment
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      No customers found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredData.map((customer) => (
                    <TableRow key={customer.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{customer.name}</div>
                          {customer.email && (
                            <div className="text-xs text-muted-foreground">{customer.email}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium text-green-600">
                        ${formatAmount(customer.totalRevenue)}
                      </TableCell>
                      <TableCell className="text-right hidden sm:table-cell">
                        {customer.jobCount}
                      </TableCell>
                      <TableCell className="text-right hidden md:table-cell">
                        ${formatAmount(customer.avgJobValue)}
                      </TableCell>
                      <TableCell className="text-right hidden lg:table-cell">
                        ${formatAmount(customer.ltv)}
                      </TableCell>
                      <TableCell className="text-right hidden xl:table-cell text-muted-foreground">
                        {customer.lastPaymentDate 
                          ? format(customer.lastPaymentDate, 'MMM d, yyyy')
                          : '-'
                        }
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Email Dialog */}
      <ReportEmailDialog
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        onSend={sendReportEmail}
        isSending={isSendingEmail}
        title="Email Customer Revenue Report"
      />
    </div>
  );
};

export default CustomerRevenueReport;
