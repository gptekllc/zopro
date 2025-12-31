import { useAuth } from '@/hooks/useAuth';
import { useInvoices } from '@/hooks/useInvoices';
import { useQuotes } from '@/hooks/useQuotes';
import { useCustomers } from '@/hooks/useCustomers';
import { useTimeEntries } from '@/hooks/useTimeEntries';
import { useJobs } from '@/hooks/useJobs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, FileText, Users, Clock, TrendingUp, AlertCircle, Loader2, Briefcase } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';

const Dashboard = () => {
  const { profile, user, roles, isLoading: authLoading } = useAuth();
  const { data: invoices = [], isLoading: loadingInvoices } = useInvoices();
  const { data: quotes = [], isLoading: loadingQuotes } = useQuotes();
  const { data: customers = [], isLoading: loadingCustomers } = useCustomers();
  const { data: timeEntries = [], isLoading: loadingTime } = useTimeEntries();
  const { data: jobs = [], isLoading: loadingJobs } = useJobs();

  const isLoading =
    authLoading || loadingInvoices || loadingQuotes || loadingCustomers || loadingTime || loadingJobs;

  const isAdminOrManager = roles.some((r) =>
    r.role === 'admin' || r.role === 'manager' || r.role === 'super_admin'
  );

  // Technician-only dashboard view (based on roles table)
  const isTechnician =
    roles.some((r) => r.role === 'technician') &&
    !isAdminOrManager;

  // Filter invoices for technician view - only show invoices they created
  const visibleInvoices = isTechnician 
    ? invoices.filter(i => i.created_by === user?.id)
    : invoices;

  // Calculate stats
  const totalRevenue = visibleInvoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + Number(i.total), 0);
  const pendingInvoices = visibleInvoices.filter(i => i.status === 'sent' || i.status === 'overdue');
  const pendingAmount = pendingInvoices.reduce((sum, inv) => sum + Number(inv.total), 0);
  const activeQuotes = isTechnician 
    ? quotes.filter(q => (q.status === 'sent' || q.status === 'draft') && q.created_by === user?.id)
    : quotes.filter(q => q.status === 'sent' || q.status === 'draft');
  const overdueInvoices = visibleInvoices.filter(i => i.status === 'overdue');

  const today = new Date();
  
  // Filter time entries for technicians - only show their own
  const visibleTimeEntries = isTechnician 
    ? timeEntries.filter(e => e.user_id === user?.id)
    : timeEntries;
    
  const todayEntries = visibleTimeEntries.filter(e => {
    const entryDate = new Date(e.clock_in);
    return entryDate.toDateString() === today.toDateString();
  });

  // Recent activity - technicians see only their own items
  const recentInvoices = isTechnician
    ? invoices.filter(i => i.created_by === user?.id).slice(0, 5)
    : invoices.slice(0, 5);
  
  const recentQuotes = isTechnician
    ? quotes.filter(q => q.created_by === user?.id).slice(0, 5)
    : quotes.slice(0, 5);
  
  const recentJobs = isTechnician
    ? jobs.filter(j => j.created_by === user?.id || j.assigned_to === user?.id).slice(0, 5)
    : jobs.slice(0, 5);

  // Stats for technician vs admin/manager
  const stats = isTechnician ? [
    { title: 'My Revenue', value: `$${totalRevenue.toLocaleString()}`, icon: DollarSign, iconBg: 'bg-success' },
    { title: 'My Pending Invoices', value: pendingInvoices.length, subtext: `$${pendingAmount.toLocaleString()}`, icon: FileText, iconBg: 'bg-warning' },
    { title: 'My Active Quotes', value: activeQuotes.length, icon: TrendingUp, iconBg: 'bg-primary' },
    { title: 'My Jobs', value: jobs.filter(j => j.created_by === user?.id || j.assigned_to === user?.id).length, icon: Briefcase, iconBg: 'bg-accent' },
  ] : [
    { title: 'Total Revenue', value: `$${totalRevenue.toLocaleString()}`, icon: DollarSign, iconBg: 'bg-success' },
    { title: 'Pending Invoices', value: pendingInvoices.length, subtext: `$${pendingAmount.toLocaleString()}`, icon: FileText, iconBg: 'bg-warning' },
    { title: 'Active Quotes', value: activeQuotes.length, icon: TrendingUp, iconBg: 'bg-primary' },
    { title: 'Total Customers', value: customers.length, icon: Users, iconBg: 'bg-accent' },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Welcome back, {profile?.full_name || 'User'}. 
          {isTechnician ? " Here's your personal summary." : " Here's what's happening today."}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold mt-2">{stat.value}</p>
                  {stat.subtext && <p className="text-sm text-muted-foreground mt-1">{stat.subtext}</p>}
                </div>
                <div className={`p-3 rounded-xl ${stat.iconBg}`}>
                  <stat.icon className="w-5 h-5 text-primary-foreground" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {overdueInvoices.length > 0 && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-destructive mt-0.5" />
              <div>
                <p className="font-medium text-destructive">Overdue Invoices</p>
                <p className="text-sm text-muted-foreground mt-1">
                  You have {overdueInvoices.length} overdue invoice(s).
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* Today's Time Entries - Only for Admins/Managers */}
        {isAdminOrManager && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Today's Time Entries
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {todayEntries.slice(0, 5).map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="font-medium">{entry.user?.full_name || 'User'}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(entry.clock_in), 'h:mm a')}
                        {entry.clock_out && ` - ${format(new Date(entry.clock_out), 'h:mm a')}`}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${entry.clock_out ? 'bg-muted text-muted-foreground' : 'bg-success/10 text-success'}`}>
                      {entry.clock_out ? 'Completed' : 'Active'}
                    </span>
                  </div>
                ))}
                {todayEntries.length === 0 && <p className="text-center text-muted-foreground py-4">No time entries today</p>}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Recent Invoices */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="w-5 h-5" />
              {isTechnician ? 'My Recent Invoices' : 'Recent Invoices'}
            </CardTitle>
            <Link to="/invoices" className="text-sm text-primary hover:underline">View all</Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentInvoices.map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="font-medium">{invoice.invoice_number}</p>
                    <p className="text-sm text-muted-foreground">{invoice.customer?.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">${Number(invoice.total).toLocaleString()}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      invoice.status === 'paid' ? 'bg-success/10 text-success' :
                      invoice.status === 'overdue' ? 'bg-destructive/10 text-destructive' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {invoice.status}
                    </span>
                  </div>
                </div>
              ))}
              {recentInvoices.length === 0 && <p className="text-center text-muted-foreground py-4">No invoices yet</p>}
            </div>
          </CardContent>
        </Card>

        {/* Recent Quotes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              {isTechnician ? 'My Recent Quotes' : 'Recent Quotes'}
            </CardTitle>
            <Link to="/quotes" className="text-sm text-primary hover:underline">View all</Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentQuotes.map((quote) => (
                <div key={quote.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="font-medium">{quote.quote_number}</p>
                    <p className="text-sm text-muted-foreground">{quote.customer?.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">${Number(quote.total).toLocaleString()}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      quote.status === 'sent' ? 'bg-primary/10 text-primary' :
                      quote.status === 'rejected' || quote.status === 'expired' ? 'bg-destructive/10 text-destructive' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {quote.status}
                    </span>
                  </div>
                </div>
              ))}
              {recentQuotes.length === 0 && <p className="text-center text-muted-foreground py-4">No quotes yet</p>}
            </div>
          </CardContent>
        </Card>

        {/* Recent Jobs */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Briefcase className="w-5 h-5" />
              {isTechnician ? 'My Recent Jobs' : 'Recent Jobs'}
            </CardTitle>
            <Link to="/jobs" className="text-sm text-primary hover:underline">View all</Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentJobs.map((job) => (
                <div key={job.id} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div>
                    <p className="font-medium">{job.job_number}</p>
                    <p className="text-sm text-muted-foreground">{job.title}</p>
                  </div>
                  <div className="text-right">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      job.status === 'completed' || job.status === 'paid' ? 'bg-success/10 text-success' :
                      job.status === 'in_progress' ? 'bg-primary/10 text-primary' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {job.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))}
              {recentJobs.length === 0 && <p className="text-center text-muted-foreground py-4">No jobs yet</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
