import { useAuth } from "@/hooks/useAuth";
import { useCustomers } from "@/hooks/useCustomers";
import { useInvoices } from "@/hooks/useInvoices";
import { useJobs } from "@/hooks/useJobs";
import { useQuotes } from "@/hooks/useQuotes";
import { useTimeEntries } from "@/hooks/useTimeEntries";
import { useProfiles } from "@/hooks/useProfiles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertCircle,
  Briefcase,
  Clock,
  DollarSign,
  FileText,
  Loader2,
  TrendingUp,
  Users,
} from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { useDashboardAccess } from "./useDashboardAccess";
import { SchedulerWidget } from "@/components/dashboard/SchedulerWidget";
import PageContainer from "@/components/layout/PageContainer";

export default function DashboardPage() {
  const { profile, user, isLoading: authLoading } = useAuth();
  const { isTechnicianDashboardScoped, canSeeTimeEntriesWidget } = useDashboardAccess();

  const { data: invoices = [], isLoading: loadingInvoices } = useInvoices();
  const { data: quotes = [], isLoading: loadingQuotes } = useQuotes();
  const { data: customers = [], isLoading: loadingCustomers } = useCustomers();
  const { data: timeEntries = [], isLoading: loadingTime } = useTimeEntries();
  const { data: jobs = [], isLoading: loadingJobs } = useJobs();
  const { data: profiles = [] } = useProfiles();
  
  const technicians = profiles.filter(p => p.role === 'technician' || p.role === 'admin' || p.role === 'manager');

  const isLoading =
    authLoading || loadingInvoices || loadingQuotes || loadingCustomers || loadingTime || loadingJobs;

  // Dashboard scoping rules:
  // - Technicians: dashboard shows only “my” items.
  // - Admin/Manager: dashboard shows all items.
  const visibleInvoices = isTechnicianDashboardScoped
    ? invoices.filter((i) => i.created_by === user?.id)
    : invoices;

  const totalRevenue = visibleInvoices
    .filter((i) => i.status === "paid")
    .reduce((sum, i) => sum + Number(i.total), 0);

  const pendingInvoices = visibleInvoices.filter(
    (i) => i.status === "sent" || i.status === "overdue"
  );
  const pendingAmount = pendingInvoices.reduce((sum, inv) => sum + Number(inv.total), 0);

  const activeQuotes = isTechnicianDashboardScoped
    ? quotes.filter(
        (q) => (q.status === "sent" || q.status === "draft") && q.created_by === user?.id
      )
    : quotes.filter((q) => q.status === "sent" || q.status === "draft");

  const overdueInvoices = visibleInvoices.filter((i) => i.status === "overdue");

  const today = new Date();

  const visibleTimeEntries = isTechnicianDashboardScoped
    ? timeEntries.filter((e) => e.user_id === user?.id)
    : timeEntries;

  const todayEntries = visibleTimeEntries.filter((e) => {
    const entryDate = new Date(e.clock_in);
    return entryDate.toDateString() === today.toDateString();
  });

  const recentInvoices = isTechnicianDashboardScoped
    ? invoices.filter((i) => i.created_by === user?.id).slice(0, 5)
    : invoices.slice(0, 5);

  const recentQuotes = isTechnicianDashboardScoped
    ? quotes.filter((q) => q.created_by === user?.id).slice(0, 5)
    : quotes.slice(0, 5);

  const recentJobs = isTechnicianDashboardScoped
    ? jobs
        .filter((j) => j.created_by === user?.id || j.assigned_to === user?.id)
        .slice(0, 5)
    : jobs.slice(0, 5);

  const stats = isTechnicianDashboardScoped
    ? [
        {
          title: "My Revenue",
          value: `$${totalRevenue.toLocaleString()}`,
          icon: DollarSign,
          iconBg: "bg-success",
        },
        {
          title: "My Pending Invoices",
          value: pendingInvoices.length,
          subtext: `$${pendingAmount.toLocaleString()}`,
          icon: FileText,
          iconBg: "bg-warning",
        },
        {
          title: "My Active Quotes",
          value: activeQuotes.length,
          icon: TrendingUp,
          iconBg: "bg-primary",
        },
        {
          title: "My Jobs",
          value: jobs.filter((j) => j.created_by === user?.id || j.assigned_to === user?.id).length,
          icon: Briefcase,
          iconBg: "bg-accent",
        },
      ]
    : [
        {
          title: "Total Revenue",
          value: `$${totalRevenue.toLocaleString()}`,
          icon: DollarSign,
          iconBg: "bg-success",
        },
        {
          title: "Pending Invoices",
          value: pendingInvoices.length,
          subtext: `$${pendingAmount.toLocaleString()}`,
          icon: FileText,
          iconBg: "bg-warning",
        },
        {
          title: "Active Quotes",
          value: activeQuotes.length,
          icon: TrendingUp,
          iconBg: "bg-primary",
        },
        {
          title: "Total Customers",
          value: customers.length,
          icon: Users,
          iconBg: "bg-accent",
        },
      ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <PageContainer>
      <header>
        <h1 className="text-2xl sm:text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">
          Welcome back, {profile?.full_name || "User"}.
          {isTechnicianDashboardScoped
            ? " Here's your personal summary."
            : " Here's what's happening today."}
        </p>
      </header>

      <section aria-label="Key metrics">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {stats.map((stat) => (
            <Card key={stat.title} className="overflow-hidden">
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div className="order-2 sm:order-1">
                    <p className="text-xs sm:text-sm font-medium text-muted-foreground">{stat.title}</p>
                    <p className="text-xl sm:text-2xl font-bold mt-1 sm:mt-2">{stat.value}</p>
                    {stat.subtext && (
                      <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">{stat.subtext}</p>
                    )}
                  </div>
                  <div className={`p-2 sm:p-3 rounded-xl ${stat.iconBg} order-1 sm:order-2 self-start`}>
                    <stat.icon className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {overdueInvoices.length > 0 && (
        <section aria-label="Overdue invoices">
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
        </section>
      )}

      <section aria-label="Dashboard widgets">
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
          {/* Today's Time Entries - only for Admin/Manager, never for technicians */}
          {canSeeTimeEntriesWidget && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  Today&apos;s Time Entries
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {todayEntries.slice(0, 5).map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between py-2 border-b last:border-0"
                    >
                      <div>
                        <p className="font-medium">{entry.user?.full_name || "User"}</p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(entry.clock_in), "h:mm a")}
                          {entry.clock_out &&
                            ` - ${format(new Date(entry.clock_out), "h:mm a")}`}
                        </p>
                      </div>
                      <span
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          entry.clock_out
                            ? "bg-muted text-muted-foreground"
                            : "bg-success/10 text-success"
                        }`}
                      >
                        {entry.clock_out ? "Completed" : "Active"}
                      </span>
                    </div>
                  ))}
                  {todayEntries.length === 0 && (
                    <p className="text-center text-muted-foreground py-4">No time entries today</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Invoices */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="w-5 h-5" />
                {isTechnicianDashboardScoped ? "My Recent Invoices" : "Recent Invoices"}
              </CardTitle>
              <Link to="/invoices" className="text-sm text-primary hover:underline">
                View all
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentInvoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div>
                      <p className="font-medium">{invoice.invoice_number}</p>
                      <p className="text-sm text-muted-foreground">{invoice.customer?.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">${Number(invoice.total).toLocaleString()}</p>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          invoice.status === "paid"
                            ? "bg-success/10 text-success"
                            : invoice.status === "overdue"
                              ? "bg-destructive/10 text-destructive"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {invoice.status}
                      </span>
                    </div>
                  </div>
                ))}
                {recentInvoices.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">No invoices yet</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recent Quotes */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                {isTechnicianDashboardScoped ? "My Recent Quotes" : "Recent Quotes"}
              </CardTitle>
              <Link to="/quotes" className="text-sm text-primary hover:underline">
                View all
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentQuotes.map((quote) => (
                  <div
                    key={quote.id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div>
                      <p className="font-medium">{quote.quote_number}</p>
                      <p className="text-sm text-muted-foreground">{quote.customer?.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">${Number(quote.total).toLocaleString()}</p>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          quote.status === "sent"
                            ? "bg-primary/10 text-primary"
                            : quote.status === "rejected" || quote.status === "expired"
                              ? "bg-destructive/10 text-destructive"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {quote.status}
                      </span>
                    </div>
                  </div>
                ))}
                {recentQuotes.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">No quotes yet</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recent Jobs */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Briefcase className="w-5 h-5" />
                {isTechnicianDashboardScoped ? "My Recent Jobs" : "Recent Jobs"}
              </CardTitle>
              <Link to="/jobs" className="text-sm text-primary hover:underline">
                View all
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentJobs.map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div>
                      <p className="font-medium">{job.job_number}</p>
                      <p className="text-sm text-muted-foreground">{job.title}</p>
                    </div>
                    <div className="text-right">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          job.status === "completed" || job.status === "paid"
                            ? "bg-success/10 text-success"
                            : job.status === "in_progress"
                              ? "bg-primary/10 text-primary"
                              : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {job.status.replace("_", " ")}
                      </span>
                    </div>
                  </div>
                ))}
                {recentJobs.length === 0 && (
                  <p className="text-center text-muted-foreground py-4">No jobs yet</p>
                )}
              </div>
            </CardContent>
          </Card>
          {/* Scheduler Widget - Admin/Manager only */}
          {!isTechnicianDashboardScoped && (
            <SchedulerWidget jobs={jobs} technicians={technicians} />
          )}
        </div>
      </section>
    </PageContainer>
  );
}
