import { useMemo, useState } from 'react';
import { format, parseISO, differenceInDays } from 'date-fns';
import { useCustomers } from '@/hooks/useCustomers';
import { useAllPayments } from '@/hooks/usePayments';
import { useInvoices } from '@/hooks/useInvoices';
import { useJobs } from '@/hooks/useJobs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
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
} from 'lucide-react';
import { formatAmount } from '@/lib/formatAmount';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

type SortField = 'name' | 'totalRevenue' | 'jobCount' | 'avgJobValue' | 'ltv';
type SortDirection = 'asc' | 'desc';

const CustomerRevenueReport = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('totalRevenue');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const { data: customers, isLoading: loadingCustomers } = useCustomers();
  const { data: payments, isLoading: loadingPayments } = useAllPayments();
  const { data: invoices, isLoading: loadingInvoices } = useInvoices();
  const { data: jobs, isLoading: loadingJobs } = useJobs();

  const isLoading = loadingCustomers || loadingPayments || loadingInvoices || loadingJobs;

  // Calculate customer metrics
  const customerData = useMemo(() => {
    if (!customers || !payments || !invoices || !jobs) return [];

    return customers.map(customer => {
      // Get all completed payments for this customer
      const customerPayments = payments.filter(p => {
        const invoice = invoices.find(i => i.id === p.invoice_id);
        return invoice?.customer_id === customer.id && p.status === 'completed';
      });

      const totalRevenue = customerPayments.reduce((sum, p) => sum + Number(p.amount), 0);

      // Get customer jobs
      const customerJobs = jobs.filter(j => j.customer_id === customer.id);
      const completedJobs = customerJobs.filter(j => 
        ['completed', 'invoiced', 'paid'].includes(j.status)
      );

      // Calculate average job value
      const avgJobValue = completedJobs.length > 0 
        ? totalRevenue / completedJobs.length 
        : 0;

      // Calculate customer lifetime (days since first job)
      const firstJobDate = customerJobs.length > 0
        ? customerJobs.reduce((earliest, job) => {
            const jobDate = parseISO(job.created_at);
            return jobDate < earliest ? jobDate : earliest;
          }, parseISO(customerJobs[0].created_at))
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
  }, [customers, payments, invoices, jobs]);

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
      {/* Header with search and export */}
      <div className="flex flex-col sm:flex-row justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search customers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button onClick={exportToCSV} variant="outline" size="sm" disabled={filteredData.length === 0}>
          <Download className="w-4 h-4 mr-2" />
          Export CSV
        </Button>
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
    </div>
  );
};

export default CustomerRevenueReport;
