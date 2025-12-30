import { useStore } from '@/store/useStore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, FileText, Users, Clock, TrendingUp, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

const Dashboard = () => {
  const { invoices, quotes, customers, timeEntries, currentUser, payments } = useStore();

  // Calculate stats
  const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
  const pendingInvoices = invoices.filter(i => i.status === 'sent' || i.status === 'overdue');
  const pendingAmount = pendingInvoices.reduce((sum, inv) => 
    sum + inv.items.reduce((itemSum, item) => itemSum + (item.quantity * item.unitPrice), 0), 0
  );
  const activeQuotes = quotes.filter(q => q.status === 'sent' || q.status === 'draft');
  const overdueInvoices = invoices.filter(i => i.status === 'overdue');

  // Today's time entries
  const today = new Date();
  const todayEntries = timeEntries.filter(e => {
    const entryDate = new Date(e.clockIn);
    return entryDate.toDateString() === today.toDateString();
  });

  const stats = [
    {
      title: 'Total Revenue',
      value: `$${totalRevenue.toLocaleString()}`,
      icon: DollarSign,
      color: 'bg-success/10 text-success',
      iconBg: 'bg-success',
    },
    {
      title: 'Pending Invoices',
      value: pendingInvoices.length,
      subtext: `$${pendingAmount.toLocaleString()}`,
      icon: FileText,
      color: 'bg-warning/10 text-warning',
      iconBg: 'bg-warning',
    },
    {
      title: 'Active Quotes',
      value: activeQuotes.length,
      icon: TrendingUp,
      color: 'bg-primary/10 text-primary',
      iconBg: 'bg-primary',
    },
    {
      title: 'Total Customers',
      value: customers.length,
      icon: Users,
      color: 'bg-accent/10 text-accent',
      iconBg: 'bg-accent',
    },
  ];

  const recentActivity = [
    ...invoices.slice(-3).map(inv => ({
      type: 'invoice',
      title: `Invoice ${inv.invoiceNumber}`,
      description: `${inv.customerName} - $${inv.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)}`,
      status: inv.status,
      date: new Date(inv.createdAt),
    })),
    ...quotes.slice(-2).map(q => ({
      type: 'quote',
      title: `Quote ${q.quoteNumber}`,
      description: `${q.customerName} - $${q.items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)}`,
      status: q.status,
      date: new Date(q.createdAt),
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime()).slice(0, 5);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
      case 'approved':
        return 'bg-success/10 text-success';
      case 'sent':
        return 'bg-primary/10 text-primary';
      case 'overdue':
      case 'rejected':
        return 'bg-destructive/10 text-destructive';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Welcome back, {currentUser?.name}. Here's what's happening today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="overflow-hidden">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                  <p className="text-2xl font-bold mt-2">{stat.value}</p>
                  {stat.subtext && (
                    <p className="text-sm text-muted-foreground mt-1">{stat.subtext}</p>
                  )}
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
        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivity.map((activity, idx) => (
                <div key={idx} className="flex items-center justify-between py-3 border-b last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{activity.title}</p>
                    <p className="text-sm text-muted-foreground truncate">{activity.description}</p>
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getStatusColor(activity.status)}`}>
                      {activity.status}
                    </span>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {format(activity.date, 'MMM d')}
                    </span>
                  </div>
                </div>
              ))}
              {recentActivity.length === 0 && (
                <p className="text-center text-muted-foreground py-8">No recent activity</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Alerts & Time Clock */}
        <div className="space-y-6">
          {/* Overdue Invoices Alert */}
          {overdueInvoices.length > 0 && (
            <Card className="border-destructive/50 bg-destructive/5">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-destructive mt-0.5" />
                  <div>
                    <p className="font-medium text-destructive">Overdue Invoices</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      You have {overdueInvoices.length} overdue invoice(s) requiring attention.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Today's Time Entries */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Today's Time Entries
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {todayEntries.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <div>
                      <p className="font-medium">{entry.userName}</p>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(entry.clockIn), 'h:mm a')}
                        {entry.clockOut && ` - ${format(new Date(entry.clockOut), 'h:mm a')}`}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      entry.clockOut 
                        ? 'bg-muted text-muted-foreground' 
                        : 'bg-success/10 text-success'
                    }`}>
                      {entry.clockOut ? 'Completed' : 'Active'}
                    </span>
                  </div>
                ))}
                {todayEntries.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">No time entries today</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
