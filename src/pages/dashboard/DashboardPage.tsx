import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useCustomers } from "@/hooks/useCustomers";
import { useInvoices } from "@/hooks/useInvoices";
import { useJobs } from "@/hooks/useJobs";
import { useQuotes } from "@/hooks/useQuotes";
import { useTimeEntries } from "@/hooks/useTimeEntries";
import { useProfiles } from "@/hooks/useProfiles";
import { useAllPayments } from "@/hooks/usePayments";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Briefcase, CheckCircle, Clock, DollarSign, FileText, Filter, Info, Loader2, Percent, TrendingUp } from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subWeeks, subMonths, subYears, isWithinInterval } from "date-fns";
import { Link } from "react-router-dom";
import { useDashboardAccess } from "./useDashboardAccess";
import { SchedulerWidget } from "@/components/dashboard/SchedulerWidget";
import { RecentTransactionsWidget } from "@/components/dashboard/RecentTransactionsWidget";
import { DraggableWidgetContainer } from "@/components/dashboard/DraggableWidgetContainer";
import PageContainer from "@/components/layout/PageContainer";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type DateFilter = "this-week" | "last-week" | "this-month" | "last-month" | "last-3-months" | "this-year" | "last-year" | "all-time";

const DATE_FILTER_LABELS: Record<DateFilter, string> = {
  "this-week": "This Week",
  "last-week": "Last Week",
  "this-month": "This Month",
  "last-month": "Last Month",
  "last-3-months": "Last 3 Months",
  "this-year": "This Year",
  "last-year": "Last Year",
  "all-time": "All Time",
};

function getDateRange(filter: DateFilter): { start: Date | null; end: Date | null } {
  const now = new Date();
  
  switch (filter) {
    case "this-week":
      return { start: startOfWeek(now, { weekStartsOn: 0 }), end: endOfWeek(now, { weekStartsOn: 0 }) };
    case "last-week": {
      const lastWeek = subWeeks(now, 1);
      return { start: startOfWeek(lastWeek, { weekStartsOn: 0 }), end: endOfWeek(lastWeek, { weekStartsOn: 0 }) };
    }
    case "this-month":
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case "last-month": {
      const lastMonth = subMonths(now, 1);
      return { start: startOfMonth(lastMonth), end: endOfMonth(lastMonth) };
    }
    case "last-3-months":
      return { start: startOfMonth(subMonths(now, 2)), end: endOfMonth(now) };
    case "this-year":
      return { start: startOfYear(now), end: endOfYear(now) };
    case "last-year": {
      const lastYear = subYears(now, 1);
      return { start: startOfYear(lastYear), end: endOfYear(lastYear) };
    }
    case "all-time":
    default:
      return { start: null, end: null };
  }
}

function isWithinDateRange(dateStr: string | null | undefined, start: Date | null, end: Date | null): boolean {
  if (!dateStr) return false;
  if (!start || !end) return true; // All time
  const date = new Date(dateStr);
  return isWithinInterval(date, { start, end });
}

export default function DashboardPage() {
  const [dateFilter, setDateFilter] = useState<DateFilter>("all-time");
  const {
    profile,
    user,
    isLoading: authLoading
  } = useAuth();
  const {
    isTechnicianDashboardScoped,
    canSeeTimeEntriesWidget
  } = useDashboardAccess();
  const {
    data: invoices = [],
    isLoading: loadingInvoices
  } = useInvoices();
  const {
    data: quotes = [],
    isLoading: loadingQuotes
  } = useQuotes();
  const {
    data: customers = [],
    isLoading: loadingCustomers
  } = useCustomers();
  const {
    data: timeEntries = [],
    isLoading: loadingTime
  } = useTimeEntries();
  const {
    data: jobs = [],
    isLoading: loadingJobs
  } = useJobs();
  const {
    data: profiles = []
  } = useProfiles();
  const {
    data: payments = [],
    isLoading: loadingPayments
  } = useAllPayments();
  const technicians = profiles.filter(p => p.role === 'technician' || p.role === 'admin' || p.role === 'manager');
  const isLoading = authLoading || loadingInvoices || loadingQuotes || loadingCustomers || loadingTime || loadingJobs || loadingPayments;

  // Dashboard scoping rules:
  // - Technicians: dashboard shows only "my" items.
  // - Admin/Manager: dashboard shows all items.
  
  // Date filter range
  const { start: filterStart, end: filterEnd } = getDateRange(dateFilter);
  
  const visibleInvoices = isTechnicianDashboardScoped ? invoices.filter(i => i.created_by === user?.id) : invoices;
  
  // Filtered stats based on date range
  const filteredPaidInvoices = visibleInvoices.filter(i => 
    i.status === "paid" && isWithinDateRange(i.paid_at || i.updated_at, filterStart, filterEnd)
  );
  const totalRevenue = filteredPaidInvoices.reduce((sum, i) => sum + Number(i.total), 0);
  
  const filteredPendingInvoices = visibleInvoices.filter(i => 
    (i.status === "sent" || i.status === "overdue") && isWithinDateRange(i.created_at, filterStart, filterEnd)
  );
  const pendingAmount = filteredPendingInvoices.reduce((sum, inv) => sum + Number(inv.total), 0);
  
  const filteredActiveQuotes = (isTechnicianDashboardScoped 
    ? quotes.filter(q => (q.status === "sent" || q.status === "draft") && q.created_by === user?.id)
    : quotes.filter(q => q.status === "sent" || q.status === "draft")
  ).filter(q => isWithinDateRange(q.created_at, filterStart, filterEnd));
  
  // Non-filtered for other uses
  const overdueInvoices = visibleInvoices.filter(i => i.status === "overdue");
  const today = new Date();
  const visibleTimeEntries = isTechnicianDashboardScoped ? timeEntries.filter(e => e.user_id === user?.id) : timeEntries;
  const todayEntries = visibleTimeEntries.filter(e => {
    const entryDate = new Date(e.clock_in);
    return entryDate.toDateString() === today.toDateString();
  });
  const recentInvoices = isTechnicianDashboardScoped ? invoices.filter(i => i.created_by === user?.id).slice(0, 5) : invoices.slice(0, 5);
  const recentQuotes = isTechnicianDashboardScoped ? quotes.filter(q => q.created_by === user?.id).slice(0, 5) : quotes.slice(0, 5);
  const recentJobs = isTechnicianDashboardScoped ? jobs.filter(j => j.created_by === user?.id || j.assigned_to === user?.id).slice(0, 5) : jobs.slice(0, 5);
  
  // My Revenue: paid invoices where user is the assigned technician (filtered by date)
  const myAssignedPaidInvoices = invoices.filter(i => 
    i.assigned_to === user?.id && i.status === "paid" && isWithinDateRange(i.paid_at || i.updated_at, filterStart, filterEnd)
  );
  const myTotalRevenue = myAssignedPaidInvoices.reduce((sum, i) => sum + Number(i.total), 0);
  const myPaidInvoicesCount = myAssignedPaidInvoices.length;

  // Jobs completed within the date range
  const visibleJobs = isTechnicianDashboardScoped 
    ? jobs.filter(j => j.created_by === user?.id || j.assigned_to === user?.id)
    : jobs;
  const completedJobs = visibleJobs.filter(j => 
    (j.status === "completed" || j.status === "invoiced" || j.status === "paid") && 
    isWithinDateRange(j.actual_end || j.updated_at, filterStart, filterEnd)
  );

  // Quote conversion rate: quotes that have been converted to jobs or invoices
  const visibleQuotesForConversion = isTechnicianDashboardScoped 
    ? quotes.filter(q => q.created_by === user?.id)
    : quotes;
  const quotesInRange = visibleQuotesForConversion.filter(q => 
    isWithinDateRange(q.created_at, filterStart, filterEnd)
  );
  const convertedQuotes = quotesInRange.filter(q => 
    q.job_id !== null || invoices.some(inv => inv.quote_id === q.id)
  );
  const conversionRate = quotesInRange.length > 0 
    ? Math.round((convertedQuotes.length / quotesInRange.length) * 100) 
    : 0;

  const stats = isTechnicianDashboardScoped ? [{
    title: "My Total Revenue",
    value: `$${myTotalRevenue.toLocaleString()}`,
    subtext: `${myPaidInvoicesCount} paid invoice${myPaidInvoicesCount !== 1 ? 's' : ''}`,
    icon: DollarSign,
    iconBg: "bg-success",
    hasTooltip: true,
    tooltipText: "Revenue from paid invoices where you are listed as the assigned technician"
  }, {
    title: "My Pending Invoices",
    value: filteredPendingInvoices.length,
    subtext: `$${pendingAmount.toLocaleString()}`,
    icon: FileText,
    iconBg: "bg-warning"
  }, {
    title: "My Active Quotes",
    value: filteredActiveQuotes.length,
    icon: TrendingUp,
    iconBg: "bg-primary"
  }, {
    title: "Jobs Completed",
    value: completedJobs.length,
    icon: CheckCircle,
    iconBg: "bg-success"
  }, {
    title: "Quote Conversion",
    value: `${conversionRate}%`,
    subtext: `${convertedQuotes.length} of ${quotesInRange.length} quotes`,
    icon: Percent,
    iconBg: "bg-primary",
    hasTooltip: true,
    tooltipText: "Percentage of quotes converted to jobs or invoices"
  }] : [{
    title: "Total Revenue",
    value: `$${totalRevenue.toLocaleString()}`,
    icon: DollarSign,
    iconBg: "bg-success"
  }, {
    title: "My Total Revenue",
    value: `$${myTotalRevenue.toLocaleString()}`,
    subtext: `${myPaidInvoicesCount} paid invoice${myPaidInvoicesCount !== 1 ? 's' : ''}`,
    icon: DollarSign,
    iconBg: "bg-success",
    hasTooltip: true,
    tooltipText: "Revenue from paid invoices where you are listed as the assigned technician"
  }, {
    title: "Pending Invoices",
    value: filteredPendingInvoices.length,
    subtext: `$${pendingAmount.toLocaleString()}`,
    icon: FileText,
    iconBg: "bg-warning"
  }, {
    title: "Active Quotes",
    value: filteredActiveQuotes.length,
    icon: TrendingUp,
    iconBg: "bg-primary"
  }, {
    title: "Jobs Completed",
    value: completedJobs.length,
    icon: CheckCircle,
    iconBg: "bg-success"
  }, {
    title: "Quote Conversion",
    value: `${conversionRate}%`,
    subtext: `${convertedQuotes.length} of ${quotesInRange.length} quotes`,
    icon: Percent,
    iconBg: "bg-primary",
    hasTooltip: true,
    tooltipText: "Percentage of quotes converted to jobs or invoices"
  }];

  if (isLoading) {
    return <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>;
  }

  return (
    <PageContainer>
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Welcome back, {profile?.full_name || "User"}.
            {isTechnicianDashboardScoped ? " Here's your personal summary." : " Here's what's happening today."}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 self-start">
              <Filter className="w-4 h-4" />
              {DATE_FILTER_LABELS[dateFilter]}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {(Object.keys(DATE_FILTER_LABELS) as DateFilter[]).map((key) => (
              <DropdownMenuItem
                key={key}
                onClick={() => setDateFilter(key)}
                className={dateFilter === key ? "bg-accent" : ""}
              >
                {DATE_FILTER_LABELS[key]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <section aria-label="Key metrics">
        <TooltipProvider>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-[20px] px-0 pt-[10px]">
            {stats.map(stat => (
              <Card key={stat.title} className="overflow-hidden">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div className="order-2 sm:order-1">
                      <p className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center gap-1">
                        {stat.title}
                        {stat.hasTooltip && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="w-3 h-3 text-muted-foreground cursor-help" />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[250px]">
                              <p>{stat.tooltipText}</p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </p>
                      <p className="text-xl sm:text-2xl font-bold mt-1 sm:mt-2">{stat.value}</p>
                      {stat.subtext && <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">{stat.subtext}</p>}
                    </div>
                    <div className={`p-2 sm:p-3 rounded-xl ${stat.iconBg} order-1 sm:order-2 self-start`}>
                      <stat.icon className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TooltipProvider>
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
        <DraggableWidgetContainer 
          storageKey="dashboard-widget-order"
          className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6"
          widgets={[
            {
              id: 'todays-schedule',
              visible: !isTechnicianDashboardScoped,
              component: (
                <SchedulerWidget jobs={jobs} technicians={technicians} />
              )
            },
            {
              id: 'todays-time-entries',
              visible: canSeeTimeEntriesWidget && !isTechnicianDashboardScoped,
              component: (
                <Card className="h-full">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Clock className="w-5 h-5" />
                      Today&apos;s Time Entries
                    </CardTitle>
                    <Link to="/timeclock" className="text-sm text-primary hover:underline">
                      View all
                    </Link>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {todayEntries.slice(0, 5).map(entry => (
                        <div key={entry.id} className="flex items-center justify-between py-2 border-b last:border-0">
                          <div>
                            <p className="font-medium">{entry.user?.full_name || "User"}</p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(entry.clock_in), "h:mm a")}
                              {entry.clock_out && ` - ${format(new Date(entry.clock_out), "h:mm a")}`}
                            </p>
                          </div>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${entry.clock_out ? "bg-muted text-muted-foreground" : "bg-success/10 text-success"}`}>
                            {entry.clock_out ? "Completed" : "Active"}
                          </span>
                        </div>
                      ))}
                      {todayEntries.length === 0 && <p className="text-center text-muted-foreground py-4">No time entries today</p>}
                    </div>
                  </CardContent>
                </Card>
              )
            },
            {
              id: 'recent-transactions',
              visible: true,
              component: (
                <RecentTransactionsWidget 
                  payments={payments} 
                  isTechnicianScoped={isTechnicianDashboardScoped} 
                />
              )
            },
            {
              id: 'recent-invoices',
              visible: true,
              component: (
                <Card className="h-full">
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
                      {recentInvoices.map(invoice => (
                        <div key={invoice.id} className="flex items-center justify-between py-2 border-b last:border-0">
                          <div>
                            <p className="font-medium">{invoice.invoice_number}</p>
                            <p className="text-sm text-muted-foreground">{invoice.customer?.name}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">${Number(invoice.total).toLocaleString()}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${invoice.status === "paid" ? "bg-success/10 text-success" : invoice.status === "overdue" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>
                              {invoice.status.replace('_', ' ')}
                            </span>
                          </div>
                        </div>
                      ))}
                      {recentInvoices.length === 0 && <p className="text-center text-muted-foreground py-4">No invoices yet</p>}
                    </div>
                  </CardContent>
                </Card>
              )
            },
            {
              id: 'recent-jobs',
              visible: true,
              component: (
                <Card className="h-full">
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
                      {recentJobs.map(job => (
                        <div key={job.id} className="flex items-center justify-between py-2 border-b last:border-0">
                          <div>
                            <p className="font-medium">{job.job_number}</p>
                            <p className="text-sm text-muted-foreground">{job.title}</p>
                          </div>
                          <div className="text-right">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${job.status === "completed" || job.status === "paid" ? "bg-success/10 text-success" : job.status === "in_progress" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                              {job.status.replace("_", " ")}
                            </span>
                          </div>
                        </div>
                      ))}
                      {recentJobs.length === 0 && <p className="text-center text-muted-foreground py-4">No jobs yet</p>}
                    </div>
                  </CardContent>
                </Card>
              )
            },
            {
              id: 'recent-quotes',
              visible: true,
              component: (
                <Card className="h-full">
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
                      {recentQuotes.map(quote => (
                        <div key={quote.id} className="flex items-center justify-between py-2 border-b last:border-0">
                          <div>
                            <p className="font-medium">{quote.quote_number}</p>
                            <p className="text-sm text-muted-foreground">{quote.customer?.name}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">${Number(quote.total).toLocaleString()}</p>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${quote.status === "sent" ? "bg-primary/10 text-primary" : quote.status === "rejected" || quote.status === "expired" ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>
                              {quote.status}
                            </span>
                          </div>
                        </div>
                      ))}
                      {recentQuotes.length === 0 && <p className="text-center text-muted-foreground py-4">No quotes yet</p>}
                    </div>
                  </CardContent>
                </Card>
              )
            }
          ]}
        />
      </section>
    </PageContainer>
  );
}
