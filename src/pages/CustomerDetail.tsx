import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Customer } from '@/hooks/useCustomers';
import { useCustomerJobs, useCustomerQuotes, useCustomerInvoices, useCustomerStats } from '@/hooks/useCustomerHistory';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  ArrowLeft, Mail, Phone, MapPin, User, Loader2, ExternalLink, 
  Briefcase, FileText, Receipt, DollarSign, CheckCircle, Clock,
  Plus
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  scheduled: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  in_progress: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  invoiced: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  paid: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  sent: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  overdue: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

const CustomerDetail = () => {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const [sendingPortalLink, setSendingPortalLink] = useState(false);

  const { data: customer, isLoading } = useQuery({
    queryKey: ['customer', customerId],
    queryFn: async () => {
      if (!customerId) return null;
      const { data, error } = await (supabase as any)
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .maybeSingle();
      if (error) throw error;
      return data as Customer | null;
    },
    enabled: !!customerId,
  });

  const { data: jobs = [], isLoading: jobsLoading } = useCustomerJobs(customerId);
  const { data: quotes = [], isLoading: quotesLoading } = useCustomerQuotes(customerId);
  const { data: invoices = [], isLoading: invoicesLoading } = useCustomerInvoices(customerId);
  const stats = useCustomerStats(customerId);

  const handleSendPortalLink = async () => {
    if (!customer?.email) {
      toast.error('Customer must have an email address');
      return;
    }

    setSendingPortalLink(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal-auth', {
        body: { action: 'send-link', email: customer.email },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
      } else {
        toast.success(`Portal link sent to ${customer.email}`);
      }
    } catch {
      toast.error('Failed to send portal link');
    } finally {
      setSendingPortalLink(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="text-center py-12">
        <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-medium">Customer not found</h3>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/customers')}>
          Back to Customers
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/customers')}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-3xl font-bold">{customer.name}</h1>
          <p className="text-muted-foreground">Customer Details</p>
        </div>
        <div className="flex gap-2">
          {customer.email && (
            <Button variant="outline" onClick={handleSendPortalLink} disabled={sendingPortalLink}>
              {sendingPortalLink ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <ExternalLink className="w-4 h-4 mr-2" />}
              Send Portal Link
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
                <Briefcase className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalJobs}</p>
                <p className="text-xs text-muted-foreground">{stats.completedJobs} completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                <FileText className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalQuotes}</p>
                <p className="text-xs text-muted-foreground">{stats.approvedQuotes} approved</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                <DollarSign className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">${stats.lifetimeValue.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Lifetime value</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
                <Receipt className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">${stats.outstandingBalance.toLocaleString()}</p>
                <p className="text-xs text-muted-foreground">Outstanding</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Customer Info + History Tabs */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Contact Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="w-8 h-8 text-primary" />
              </div>
              <div>
                <p className="font-medium">{customer.name}</p>
                <p className="text-sm text-muted-foreground">Customer since {format(new Date(customer.created_at), 'MMM yyyy')}</p>
              </div>
            </div>
            <div className="space-y-3 pt-4 border-t">
              {customer.email && (
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <a href={`mailto:${customer.email}`} className="hover:underline">{customer.email}</a>
                </div>
              )}
              {customer.phone && (
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <a href={`tel:${customer.phone}`} className="hover:underline">{customer.phone}</a>
                </div>
              )}
              {(customer.address || customer.city || customer.state) && (
                <div className="flex items-start gap-3 text-sm">
                  <MapPin className="w-4 h-4 text-muted-foreground mt-0.5" />
                  <div>
                    {customer.address && <p>{customer.address}</p>}
                    {(customer.city || customer.state || customer.zip) && (
                      <p>{[customer.city, customer.state, customer.zip].filter(Boolean).join(', ')}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
            {customer.notes && (
              <div className="pt-4 border-t">
                <p className="text-sm font-medium mb-1">Notes</p>
                <p className="text-sm text-muted-foreground">{customer.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* History Tabs */}
        <Card className="lg:col-span-2">
          <CardContent className="p-0">
            <Tabs defaultValue="jobs" className="w-full">
              <div className="border-b px-4">
                <TabsList className="h-12 bg-transparent">
                  <TabsTrigger value="jobs" className="gap-2">
                    <Briefcase className="w-4 h-4" />Jobs ({jobs.length})
                  </TabsTrigger>
                  <TabsTrigger value="quotes" className="gap-2">
                    <FileText className="w-4 h-4" />Quotes ({quotes.length})
                  </TabsTrigger>
                  <TabsTrigger value="invoices" className="gap-2">
                    <Receipt className="w-4 h-4" />Invoices ({invoices.length})
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Jobs Tab */}
              <TabsContent value="jobs" className="m-0">
                <div className="p-4 border-b flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">All jobs for this customer</p>
                  <Button size="sm" asChild>
                    <Link to={`/jobs?customer=${customerId}`}>
                      <Plus className="w-4 h-4 mr-1" />New Job
                    </Link>
                  </Button>
                </div>
                <div className="divide-y max-h-96 overflow-y-auto">
                  {jobsLoading ? (
                    <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
                  ) : jobs.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">No jobs yet</div>
                  ) : (
                    jobs.map((job) => (
                      <div key={job.id} className="p-4 hover:bg-muted/50 transition-colors">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium">{job.title}</p>
                            <p className="text-sm text-muted-foreground">{job.job_number}</p>
                          </div>
                          <Badge className={statusColors[job.status] || 'bg-muted'}>{job.status.replace('_', ' ')}</Badge>
                        </div>
                        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {format(new Date(job.created_at), 'MMM d, yyyy')}
                          </span>
                          {job.assignee?.full_name && (
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {job.assignee.full_name}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>

              {/* Quotes Tab */}
              <TabsContent value="quotes" className="m-0">
                <div className="p-4 border-b flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">All quotes for this customer</p>
                  <Button size="sm" asChild>
                    <Link to={`/quotes?customer=${customerId}`}>
                      <Plus className="w-4 h-4 mr-1" />New Quote
                    </Link>
                  </Button>
                </div>
                <div className="divide-y max-h-96 overflow-y-auto">
                  {quotesLoading ? (
                    <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
                  ) : quotes.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">No quotes yet</div>
                  ) : (
                    quotes.map((quote) => (
                      <div key={quote.id} className="p-4 hover:bg-muted/50 transition-colors">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium">{quote.quote_number}</p>
                            <p className="text-sm text-muted-foreground">${Number(quote.total).toLocaleString()}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {quote.signed_at && <CheckCircle className="w-4 h-4 text-green-500" />}
                            <Badge className={statusColors[quote.status] || 'bg-muted'}>{quote.status}</Badge>
                          </div>
                        </div>
                        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                          <span>{format(new Date(quote.created_at), 'MMM d, yyyy')}</span>
                          {quote.valid_until && (
                            <span>Valid until {format(new Date(quote.valid_until), 'MMM d, yyyy')}</span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>

              {/* Invoices Tab */}
              <TabsContent value="invoices" className="m-0">
                <div className="p-4 border-b flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">All invoices for this customer</p>
                  <Button size="sm" asChild>
                    <Link to={`/invoices?customer=${customerId}`}>
                      <Plus className="w-4 h-4 mr-1" />New Invoice
                    </Link>
                  </Button>
                </div>
                <div className="divide-y max-h-96 overflow-y-auto">
                  {invoicesLoading ? (
                    <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
                  ) : invoices.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">No invoices yet</div>
                  ) : (
                    invoices.map((invoice) => (
                      <div key={invoice.id} className="p-4 hover:bg-muted/50 transition-colors">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium">{invoice.invoice_number}</p>
                            <p className="text-sm text-muted-foreground">${Number(invoice.total).toLocaleString()}</p>
                          </div>
                          <Badge className={statusColors[invoice.status] || 'bg-muted'}>{invoice.status}</Badge>
                        </div>
                        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                          <span>{format(new Date(invoice.created_at), 'MMM d, yyyy')}</span>
                          {invoice.due_date && (
                            <span>Due {format(new Date(invoice.due_date), 'MMM d, yyyy')}</span>
                          )}
                          {invoice.paid_at && (
                            <span className="text-green-600">Paid {format(new Date(invoice.paid_at), 'MMM d, yyyy')}</span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CustomerDetail;
