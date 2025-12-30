import { useAuth } from '@/hooks/useAuth';
import { useInvoices } from '@/hooks/useInvoices';
import { useQuotes } from '@/hooks/useQuotes';
import { useCustomers } from '@/hooks/useCustomers';
import { useTimeEntries } from '@/hooks/useTimeEntries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, FileText, Users, Clock, TrendingUp, AlertCircle, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

const Dashboard = () => {
  const { profile } = useAuth();
  const { data: invoices = [], isLoading: loadingInvoices } = useInvoices();
  const { data: quotes = [], isLoading: loadingQuotes } = useQuotes();
  const { data: customers = [], isLoading: loadingCustomers } = useCustomers();
  const { data: timeEntries = [], isLoading: loadingTime } = useTimeEntries();

  const isLoading = loadingInvoices || loadingQuotes || loadingCustomers || loadingTime;

  // Calculate stats
  const totalRevenue = invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + Number(i.total), 0);
  const pendingInvoices = invoices.filter(i => i.status === 'sent' || i.status === 'overdue');
  const pendingAmount = pendingInvoices.reduce((sum, inv) => sum + Number(inv.total), 0);
  const activeQuotes = quotes.filter(q => q.status === 'sent' || q.status === 'draft');
  const overdueInvoices = invoices.filter(i => i.status === 'overdue');

  const today = new Date();
  const todayEntries = timeEntries.filter(e => {
    const entryDate = new Date(e.clock_in);
    return entryDate.toDateString() === today.toDateString();
  });

  const stats = [
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
        <p className="text-muted-foreground mt-1">Welcome back, {profile?.full_name || 'User'}. Here's what's happening today.</p>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {overdueInvoices.length > 0 && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-destructive mt-0.5" />
                <div>
                  <p className="font-medium text-destructive">Overdue Invoices</p>
                  <p className="text-sm text-muted-foreground mt-1">You have {overdueInvoices.length} overdue invoice(s).</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Clock className="w-5 h-5" />Today's Time Entries</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {todayEntries.map((entry) => (
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
      </div>
    </div>
  );
};

export default Dashboard;
