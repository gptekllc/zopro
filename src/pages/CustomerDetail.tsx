import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Customer, useUpdateCustomer } from '@/hooks/useCustomers';
import { 
  useCustomerJobs, useCustomerQuotes, useCustomerInvoices, 
  useCustomerStats, useCustomerActivity, CustomerJob, CustomerQuote, CustomerInvoice 
} from '@/hooks/useCustomerHistory';
import { useDownloadDocument, useEmailDocument, useConvertQuoteToInvoice } from '@/hooks/useDocumentActions';
import { useUpdateInvoice } from '@/hooks/useInvoices';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ArrowLeft, Mail, Phone, MapPin, User, Loader2, ExternalLink, 
  Briefcase, FileText, Receipt, DollarSign, Clock,
  Plus, Edit, PenTool, History, Navigation, Camera, Archive, Eye, EyeOff
} from 'lucide-react';
import { openInMaps, hasAddress } from '@/lib/maps';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { JobDetailDialog } from '@/components/jobs/JobDetailDialog';
import { QuoteDetailDialog } from '@/components/quotes/QuoteDetailDialog';
import { InvoiceDetailDialog } from '@/components/invoices/InvoiceDetailDialog';
import { ViewSignatureDialog } from '@/components/signatures/ViewSignatureDialog';

const statusColors: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  scheduled: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  in_progress: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  invoiced: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  paid: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  approved: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  accepted: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  sent: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  overdue: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
};

const CustomerDetail = () => {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const [sendingPortalLink, setSendingPortalLink] = useState(false);
  const [portalLinkConfirmOpen, setPortalLinkConfirmOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [showArchivedJobs, setShowArchivedJobs] = useState(false);
  
  // Detail dialogs
  const [selectedJob, setSelectedJob] = useState<CustomerJob | null>(null);
  const [selectedQuote, setSelectedQuote] = useState<CustomerQuote | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<CustomerInvoice | null>(null);
  const [selectedSignatureId, setSelectedSignatureId] = useState<string | null>(null);
  
  // Edit form
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    notes: '',
  });

  const { data: customer, isLoading, refetch } = useQuery({
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
  const activities = useCustomerActivity(customerId);
  
  const updateCustomer = useUpdateCustomer();
  const downloadDocument = useDownloadDocument();
  const emailDocument = useEmailDocument();
  const convertToInvoice = useConvertQuoteToInvoice();
  const updateInvoice = useUpdateInvoice();

  const handleSendPortalLink = async () => {
    if (!customer?.email) {
      toast.error('Customer must have an email address');
      return;
    }

    setPortalLinkConfirmOpen(false);
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

  const handleOpenEdit = () => {
    if (customer) {
      setEditForm({
        name: customer.name || '',
        email: customer.email || '',
        phone: customer.phone || '',
        address: customer.address || '',
        city: customer.city || '',
        state: customer.state || '',
        zip: customer.zip || '',
        notes: customer.notes || '',
      });
      setEditDialogOpen(true);
    }
  };

  const handleSaveEdit = async () => {
    if (!customerId) return;
    try {
      await updateCustomer.mutateAsync({
        id: customerId,
        ...editForm,
      });
      setEditDialogOpen(false);
      refetch();
    } catch {
      toast.error('Failed to update customer');
    }
  };

  // Document actions
  const handleDownloadQuote = (quoteId: string) => {
    downloadDocument.mutate({ type: 'quote', documentId: quoteId });
  };

  const handleEmailQuote = (quoteId: string) => {
    if (customer?.email) {
      emailDocument.mutate({ type: 'quote', documentId: quoteId, recipientEmail: customer.email });
    } else {
      toast.error('Customer has no email');
    }
  };

  const handleConvertQuoteToInvoice = async (quoteId: string) => {
    if (confirm('Convert this quote to an invoice?')) {
      await convertToInvoice.mutateAsync({ quoteId });
      setSelectedQuote(null);
    }
  };

  const handleDownloadInvoice = (invoiceId: string) => {
    downloadDocument.mutate({ type: 'invoice', documentId: invoiceId });
  };

  const handleEmailInvoice = (invoiceId: string) => {
    if (customer?.email) {
      emailDocument.mutate({ type: 'invoice', documentId: invoiceId, recipientEmail: customer.email });
    } else {
      toast.error('Customer has no email');
    }
  };

  const handleMarkInvoicePaid = async (invoiceId: string) => {
    try {
      await updateInvoice.mutateAsync({
        id: invoiceId,
        status: 'paid',
        paid_at: new Date().toISOString(),
      });
      setSelectedInvoice(null);
      toast.success('Invoice marked as paid');
    } catch {
      toast.error('Failed to update invoice');
    }
  };

  const handleActivityClick = (activity: typeof activities[0]) => {
    setActivityDialogOpen(false);
    if (activity.type === 'job') {
      const job = jobs.find(j => j.id === activity.id);
      if (job) setSelectedJob(job);
    } else if (activity.type === 'quote') {
      const quote = quotes.find(q => q.id === activity.id);
      if (quote) setSelectedQuote(quote);
    } else if (activity.type === 'invoice') {
      const invoice = invoices.find(i => i.id === activity.id);
      if (invoice) setSelectedInvoice(invoice);
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
    <div className="space-y-4 md:space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/customers')} className="shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </div>
        <div className="flex flex-wrap gap-2 pl-11 sm:pl-0">
          <Button variant="outline" size="sm" onClick={() => setActivityDialogOpen(true)} className="gap-1.5">
            <History className="w-4 h-4" />
            <span className="hidden sm:inline">Activity</span>
          </Button>
          <Button variant="outline" size="sm" onClick={handleOpenEdit} className="gap-1.5">
            <Edit className="w-4 h-4" />
            <span className="hidden sm:inline">Edit</span>
          </Button>
          {customer.email && (
            <Button variant="outline" size="sm" onClick={() => setPortalLinkConfirmOpen(true)} disabled={sendingPortalLink} className="gap-1.5">
              {sendingPortalLink ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
              Send Portal Link
            </Button>
          )}
        </div>
      </div>

      {/* Contact Information - moved to top */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base md:text-lg">Contact Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 md:w-16 md:h-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <User className="w-6 h-6 md:w-8 md:h-8 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="font-medium text-lg truncate">{customer.name}</p>
                <p className="text-xs md:text-sm text-muted-foreground">Customer since {format(new Date(customer.created_at), 'MMM yyyy')}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-4 sm:gap-6 sm:ml-auto">
              {customer.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-muted-foreground shrink-0" />
                  <a href={`mailto:${customer.email}`} className="hover:underline truncate">{customer.email}</a>
                </div>
              )}
              {customer.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-muted-foreground shrink-0" />
                  <a href={`tel:${customer.phone}`} className="hover:underline">{customer.phone}</a>
                </div>
              )}
              {hasAddress(customer) && (
                <button
                  onClick={() => openInMaps(customer)}
                  className="flex items-center gap-2 text-sm hover:text-primary transition-colors group"
                >
                  <MapPin className="w-4 h-4 text-muted-foreground shrink-0 group-hover:text-primary" />
                  <span className="truncate max-w-[200px]">
                    {[customer.address, customer.city, customer.state].filter(Boolean).join(', ')}
                  </span>
                  <Navigation className="w-3 h-3 text-primary opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </button>
              )}
            </div>
          </div>
          {customer.notes && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm font-medium mb-1">Notes</p>
              <p className="text-sm text-muted-foreground">{customer.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <Card>
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-1.5 md:p-2 bg-blue-100 dark:bg-blue-900 rounded-lg shrink-0">
                <Briefcase className="w-4 h-4 md:w-5 md:h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="min-w-0">
                <p className="text-lg md:text-2xl font-bold">{stats.totalJobs}</p>
                <p className="text-[10px] md:text-xs text-muted-foreground truncate">{stats.completedJobs} completed</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-1.5 md:p-2 bg-purple-100 dark:bg-purple-900 rounded-lg shrink-0">
                <FileText className="w-4 h-4 md:w-5 md:h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="min-w-0">
                <p className="text-lg md:text-2xl font-bold">{stats.totalQuotes}</p>
                <p className="text-[10px] md:text-xs text-muted-foreground truncate">{stats.approvedQuotes} approved</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-1.5 md:p-2 bg-green-100 dark:bg-green-900 rounded-lg shrink-0">
                <DollarSign className="w-4 h-4 md:w-5 md:h-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="min-w-0">
                <p className="text-lg md:text-2xl font-bold">${stats.lifetimeValue.toLocaleString()}</p>
                <p className="text-[10px] md:text-xs text-muted-foreground truncate">Lifetime value</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 md:p-4">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="p-1.5 md:p-2 bg-orange-100 dark:bg-orange-900 rounded-lg shrink-0">
                <Receipt className="w-4 h-4 md:w-5 md:h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="min-w-0">
                <p className="text-lg md:text-2xl font-bold">${stats.outstandingBalance.toLocaleString()}</p>
                <p className="text-[10px] md:text-xs text-muted-foreground truncate">Outstanding</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* History Tabs */}
      <Card>
          <CardContent className="p-0">
            <Tabs defaultValue="jobs" className="w-full">
              <div className="border-b px-2 md:px-4 overflow-x-auto">
                <TabsList className="h-10 md:h-12 bg-transparent w-full justify-start">
                  <TabsTrigger value="jobs" className="gap-1 md:gap-2 text-xs md:text-sm px-2 md:px-3">
                    <Briefcase className="w-3.5 h-3.5 md:w-4 md:h-4" />
                    <span className="hidden sm:inline">Jobs</span> ({jobs.length})
                  </TabsTrigger>
                  <TabsTrigger value="quotes" className="gap-1 md:gap-2 text-xs md:text-sm px-2 md:px-3">
                    <FileText className="w-3.5 h-3.5 md:w-4 md:h-4" />
                    <span className="hidden sm:inline">Quotes</span> ({quotes.length})
                  </TabsTrigger>
                  <TabsTrigger value="invoices" className="gap-1 md:gap-2 text-xs md:text-sm px-2 md:px-3">
                    <Receipt className="w-3.5 h-3.5 md:w-4 md:h-4" />
                    <span className="hidden sm:inline">Invoices</span> ({invoices.length})
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Jobs Tab */}
              <TabsContent value="jobs" className="m-0">
                <div className="p-3 md:p-4 border-b flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
                  <div className="flex items-center gap-2">
                    <p className="text-xs md:text-sm text-muted-foreground">
                      {showArchivedJobs ? 'All jobs' : 'Active jobs'}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowArchivedJobs(!showArchivedJobs)}
                      className="gap-1 text-xs h-7 px-2"
                    >
                      {showArchivedJobs ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      {showArchivedJobs ? 'Hide' : 'Show'} Archived
                    </Button>
                  </div>
                  <Button size="sm" asChild className="h-8">
                    <Link to={`/jobs?customer=${customerId}`}>
                      <Plus className="w-4 h-4 mr-1" />New Job
                    </Link>
                  </Button>
                </div>
                <ScrollArea className="h-[300px] md:h-96">
                  <div className="divide-y">
                    {jobsLoading ? (
                      <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
                    ) : jobs.filter(j => showArchivedJobs || !j.archived_at).length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground text-sm">
                        {showArchivedJobs ? 'No jobs yet' : 'No active jobs'}
                      </div>
                    ) : (
                      jobs
                        .filter(j => showArchivedJobs || !j.archived_at)
                        .map((job) => (
                        <div 
                          key={job.id} 
                          className={`p-3 md:p-4 hover:bg-muted/50 transition-colors cursor-pointer ${job.archived_at ? 'opacity-60' : ''}`}
                          onClick={() => setSelectedJob(job)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              {job.archived_at && (
                                <Archive className="w-4 h-4 text-muted-foreground shrink-0" />
                              )}
                              <div className="min-w-0">
                                <p className="font-medium text-sm md:text-base truncate">{job.title}</p>
                                <p className="text-xs md:text-sm text-muted-foreground">{job.job_number}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {job.archived_at && (
                                <Badge variant="outline" className="text-muted-foreground text-[10px] md:text-xs">Archived</Badge>
                              )}
                              {job.completion_signed_at && (
                                <PenTool className="w-3.5 h-3.5 md:w-4 md:h-4 text-green-500" />
                              )}
                              <Badge className={`${statusColors[job.status] || 'bg-muted'} text-[10px] md:text-xs`}>{job.status.replace('_', ' ')}</Badge>
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2 md:gap-4 text-[10px] md:text-xs text-muted-foreground">
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
                            {job.photos && job.photos.length > 0 && (
                              <span className="flex items-center gap-1 text-primary">
                                <Camera className="w-3 h-3" />
                                {job.photos.length}
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Quotes Tab */}
              <TabsContent value="quotes" className="m-0">
                <div className="p-3 md:p-4 border-b flex justify-between items-center">
                  <p className="text-xs md:text-sm text-muted-foreground">All quotes</p>
                  <Button size="sm" asChild className="h-8">
                    <Link to={`/quotes?customer=${customerId}`}>
                      <Plus className="w-4 h-4 mr-1" />New Quote
                    </Link>
                  </Button>
                </div>
                <ScrollArea className="h-[300px] md:h-96">
                  <div className="divide-y">
                    {quotesLoading ? (
                      <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
                    ) : quotes.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground text-sm">No quotes yet</div>
                    ) : (
                      quotes.map((quote) => (
                        <div 
                          key={quote.id} 
                          className="p-3 md:p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() => setSelectedQuote(quote)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-medium text-sm md:text-base">{quote.quote_number}</p>
                              <p className="text-xs md:text-sm text-muted-foreground">${Number(quote.total).toLocaleString()}</p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {quote.signed_at && (
                                <PenTool className="w-3.5 h-3.5 md:w-4 md:h-4 text-green-500" />
                              )}
                              <Badge className={`${statusColors[quote.status] || 'bg-muted'} text-[10px] md:text-xs`}>{quote.status}</Badge>
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2 md:gap-4 text-[10px] md:text-xs text-muted-foreground">
                            <span>{format(new Date(quote.created_at), 'MMM d, yyyy')}</span>
                            {quote.valid_until && (
                              <span>Valid until {format(new Date(quote.valid_until), 'MMM d, yyyy')}</span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Invoices Tab */}
              <TabsContent value="invoices" className="m-0">
                <div className="p-3 md:p-4 border-b flex justify-between items-center">
                  <p className="text-xs md:text-sm text-muted-foreground">All invoices</p>
                  <Button size="sm" asChild className="h-8">
                    <Link to={`/invoices?customer=${customerId}`}>
                      <Plus className="w-4 h-4 mr-1" />New Invoice
                    </Link>
                  </Button>
                </div>
                <ScrollArea className="h-[300px] md:h-96">
                  <div className="divide-y">
                    {invoicesLoading ? (
                      <div className="p-8 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
                    ) : invoices.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground text-sm">No invoices yet</div>
                    ) : (
                      invoices.map((invoice) => (
                        <div 
                          key={invoice.id} 
                          className="p-3 md:p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() => setSelectedInvoice(invoice)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-medium text-sm md:text-base">{invoice.invoice_number}</p>
                              <p className="text-xs md:text-sm text-muted-foreground">${Number(invoice.total).toLocaleString()}</p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              {invoice.signed_at && (
                                <PenTool className="w-3.5 h-3.5 md:w-4 md:h-4 text-green-500" />
                              )}
                              <Badge className={`${statusColors[invoice.status] || 'bg-muted'} text-[10px] md:text-xs`}>{invoice.status}</Badge>
                            </div>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-2 md:gap-4 text-[10px] md:text-xs text-muted-foreground">
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
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

      {/* Portal Link Confirmation Dialog */}
      <Dialog open={portalLinkConfirmOpen} onOpenChange={setPortalLinkConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Send Portal Link</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Send portal link to customer?
          </p>
          <div className="flex gap-2 justify-end pt-4">
            <Button variant="outline" onClick={() => setPortalLinkConfirmOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSendPortalLink}>
              Yes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Activity Modal */}
      <Dialog open={activityDialogOpen} onOpenChange={setActivityDialogOpen}>
        <DialogContent className="max-w-lg max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              Customer Activity
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[400px] -mx-6 px-6">
            <div className="divide-y">
              {activities.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">No activity yet</div>
              ) : (
                activities.map((activity) => (
                  <div 
                    key={`${activity.type}-${activity.id}`} 
                    className="py-3 hover:bg-muted/50 -mx-2 px-2 rounded-md transition-colors cursor-pointer"
                    onClick={() => handleActivityClick(activity)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg shrink-0 ${
                        activity.type === 'job' ? 'bg-blue-100 dark:bg-blue-900' :
                        activity.type === 'quote' ? 'bg-purple-100 dark:bg-purple-900' :
                        'bg-green-100 dark:bg-green-900'
                      }`}>
                        {activity.type === 'job' && <Briefcase className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
                        {activity.type === 'quote' && <FileText className="w-4 h-4 text-purple-600 dark:text-purple-400" />}
                        {activity.type === 'invoice' && <Receipt className="w-4 h-4 text-green-600 dark:text-green-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium capitalize text-sm">{activity.type}</p>
                          {activity.signed && <PenTool className="w-3 h-3 text-green-500" />}
                          <Badge className={`${statusColors[activity.status] || 'bg-muted'} text-xs`} variant="outline">
                            {activity.status.replace('_', ' ')}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">{activity.title}</p>
                        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                          <span>{format(new Date(activity.date), 'MMM d, yyyy')}</span>
                          {activity.amount && (
                            <span className="font-medium">${activity.amount.toLocaleString()}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Edit Customer Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Input
                value={editForm.address}
                onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>City</Label>
                <Input
                  value={editForm.city}
                  onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>State</Label>
                <Input
                  value={editForm.state}
                  onChange={(e) => setEditForm({ ...editForm, state: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>ZIP</Label>
                <Input
                  value={editForm.zip}
                  onChange={(e) => setEditForm({ ...editForm, zip: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                rows={3}
              />
            </div>
            <div className="flex gap-3 pt-4">
              <Button variant="outline" className="flex-1" onClick={() => setEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button 
                className="flex-1" 
                onClick={handleSaveEdit}
                disabled={updateCustomer.isPending || !editForm.name}
              >
                {updateCustomer.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save Changes
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialogs */}
      <JobDetailDialog
        job={selectedJob}
        customerName={customer.name}
        open={!!selectedJob}
        onOpenChange={(open) => !open && setSelectedJob(null)}
        onEdit={(jobId) => navigate(`/jobs?view=${jobId}`)}
      />

      <QuoteDetailDialog
        quote={selectedQuote}
        customerName={customer.name}
        open={!!selectedQuote}
        onOpenChange={(open) => !open && setSelectedQuote(null)}
        onDownload={handleDownloadQuote}
        onEmail={handleEmailQuote}
        onConvertToInvoice={handleConvertQuoteToInvoice}
        onEdit={(quoteId) => navigate(`/quotes?view=${quoteId}`)}
        onViewSignature={(sigId) => setSelectedSignatureId(sigId)}
      />

      <InvoiceDetailDialog
        invoice={selectedInvoice}
        customerName={customer.name}
        open={!!selectedInvoice}
        onOpenChange={(open) => !open && setSelectedInvoice(null)}
        onDownload={handleDownloadInvoice}
        onEmail={handleEmailInvoice}
        onMarkPaid={handleMarkInvoicePaid}
        onEdit={(invoiceId) => navigate(`/invoices?view=${invoiceId}`)}
        onViewSignature={(sigId) => setSelectedSignatureId(sigId)}
      />

      <ViewSignatureDialog
        signatureId={selectedSignatureId}
        open={!!selectedSignatureId}
        onOpenChange={(open) => !open && setSelectedSignatureId(null)}
      />
    </div>
  );
};

export default CustomerDetail;