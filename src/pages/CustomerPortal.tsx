import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { Loader2, Mail, FileText, Briefcase, DollarSign, LogOut, Download, CreditCard, CheckCircle, ClipboardList } from 'lucide-react';
import { format } from 'date-fns';

interface CustomerData {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: {
    id: string;
    name: string;
    logo_url: string | null;
  };
}

interface Invoice {
  id: string;
  invoice_number: string;
  status: string;
  total: number;
  created_at: string;
  due_date: string | null;
}

interface Job {
  id: string;
  job_number: string;
  title: string;
  status: string;
  scheduled_start: string | null;
  created_at: string;
}

interface Quote {
  id: string;
  quote_number: string;
  status: string;
  total: number;
  created_at: string;
  valid_until: string | null;
  notes: string | null;
}

const CustomerPortal = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [isSendingLink, setIsSendingLink] = useState(false);
  const [downloadingInvoice, setDownloadingInvoice] = useState<string | null>(null);
  const [payingInvoice, setPayingInvoice] = useState<string | null>(null);
  const [approvingQuote, setApprovingQuote] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [linkSent, setLinkSent] = useState(false);
  const [customerData, setCustomerData] = useState<CustomerData | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  // Check for magic link token and payment status in URL
  useEffect(() => {
    const token = searchParams.get('token');
    const customerId = searchParams.get('customer');
    const paymentStatus = searchParams.get('payment');
    
    if (paymentStatus === 'success') {
      toast.success('Payment successful! Thank you.');
      // Clean the URL
      navigate('/customer-portal', { replace: true });
    } else if (paymentStatus === 'cancelled') {
      toast.info('Payment was cancelled.');
      navigate('/customer-portal', { replace: true });
    }
    
    if (token && customerId) {
      verifyToken(token, customerId);
    } else {
      // Check if already authenticated via sessionStorage (more secure than localStorage)
      const savedCustomerId = sessionStorage.getItem('customer_portal_id');
      const savedToken = sessionStorage.getItem('customer_portal_token');
      if (savedCustomerId && savedToken) {
        verifyToken(savedToken, savedCustomerId);
      } else {
        setIsLoading(false);
      }
    }
  }, [searchParams]);

  const verifyToken = async (token: string, customerId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal-auth', {
        body: { action: 'verify', token, customerId },
      });

      if (error || !data?.valid) {
        toast.error('Invalid or expired link. Please request a new one.');
        sessionStorage.removeItem('customer_portal_id');
        sessionStorage.removeItem('customer_portal_token');
        setIsLoading(false);
        return;
      }

      // Save to sessionStorage for session persistence (more secure - cleared when browser closes)
      sessionStorage.setItem('customer_portal_id', customerId);
      sessionStorage.setItem('customer_portal_token', token);
      
      setCustomerData(data.customer);
      setInvoices(data.invoices || []);
      setJobs(data.jobs || []);
      setQuotes(data.quotes || []);
      setIsAuthenticated(true);
      
      // Clean URL
      navigate('/customer-portal', { replace: true });
    } catch (err) {
      console.error('Token verification error:', err);
      toast.error('Failed to verify access. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Please enter your email address');
      return;
    }

    setIsSendingLink(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal-auth', {
        body: { action: 'send-link', email: email.trim() },
      });

      if (error) throw error;
      
      if (data?.error) {
        toast.error(data.error);
      } else {
        setLinkSent(true);
        toast.success('Magic link sent! Check your email.');
      }
    } catch (err: any) {
      toast.error('Failed to send magic link. Please try again.');
    } finally {
      setIsSendingLink(false);
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('customer_portal_id');
    sessionStorage.removeItem('customer_portal_token');
    setIsAuthenticated(false);
    setCustomerData(null);
    setInvoices([]);
    setJobs([]);
    setQuotes([]);
  };

  const handleDownloadInvoice = async (invoice: Invoice) => {
    setDownloadingInvoice(invoice.id);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal-auth', {
        body: { 
          action: 'download-invoice', 
          invoiceId: invoice.id,
          customerId: customerData?.id,
          token: sessionStorage.getItem('customer_portal_token'),
        },
      });

      if (error || !data?.html) {
        throw new Error(data?.error || 'Failed to generate invoice');
      }

      // Create a new window with the invoice HTML for printing/saving as PDF
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(data.html);
        printWindow.document.close();
        
        // Add print styles and trigger print dialog
        printWindow.document.title = `Invoice ${invoice.invoice_number}`;
        
        // Wait for content to load then trigger print
        setTimeout(() => {
          printWindow.print();
        }, 500);
      } else {
        toast.error('Please allow popups to download the invoice');
      }
    } catch (err: any) {
      console.error('Download error:', err);
      toast.error('Failed to download invoice');
    } finally {
      setDownloadingInvoice(null);
    }
  };

  const handlePayInvoice = async (invoice: Invoice) => {
    setPayingInvoice(invoice.id);
    try {
      const { data, error } = await supabase.functions.invoke('create-invoice-payment', {
        body: { 
          invoiceId: invoice.id,
          customerId: customerData?.id,
          token: sessionStorage.getItem('customer_portal_token'),
        },
      });

      if (error || !data?.url) {
        throw new Error(data?.error || 'Failed to create payment session');
      }

      // Redirect to Stripe checkout
      window.open(data.url, '_blank');
    } catch (err: any) {
      console.error('Payment error:', err);
      toast.error(err.message || 'Failed to initiate payment');
    } finally {
      setPayingInvoice(null);
    }
  };

  const handleApproveQuote = async (quote: Quote) => {
    setApprovingQuote(quote.id);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal-auth', {
        body: { 
          action: 'approve-quote', 
          quoteId: quote.id,
          customerId: customerData?.id,
          token: sessionStorage.getItem('customer_portal_token'),
        },
      });

      if (error) {
        throw new Error(data?.error || 'Failed to approve quote');
      }

      toast.success('Quote approved successfully!');
      
      // Update local state
      setQuotes(quotes.map(q => 
        q.id === quote.id ? { ...q, status: 'approved' } : q
      ));
    } catch (err: any) {
      console.error('Approval error:', err);
      toast.error(err.message || 'Failed to approve quote');
    } finally {
      setApprovingQuote(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      paid: 'default',
      completed: 'default',
      approved: 'default',
      sent: 'secondary',
      scheduled: 'secondary',
      in_progress: 'secondary',
      pending: 'secondary',
      draft: 'outline',
      overdue: 'destructive',
      rejected: 'destructive',
      expired: 'destructive',
    };
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Login screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Customer Portal</CardTitle>
            <CardDescription>
              {linkSent 
                ? 'Check your email for the magic link'
                : 'Enter your email to receive a magic link'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {linkSent ? (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto">
                  <Mail className="w-8 h-8 text-primary" />
                </div>
                <p className="text-muted-foreground">
                  We've sent a magic link to <strong>{email}</strong>. 
                  Click the link in the email to access your portal.
                </p>
                <Button 
                  variant="outline" 
                  onClick={() => { setLinkSent(false); setEmail(''); }}
                >
                  Use a different email
                </Button>
              </div>
            ) : (
              <form onSubmit={handleRequestMagicLink} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isSendingLink}>
                  {isSendingLink ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4 mr-2" />
                      Send Magic Link
                    </>
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Portal dashboard
  const unpaidInvoices = invoices.filter(i => i.status !== 'paid');
  const pendingQuotes = quotes.filter(q => q.status === 'sent' || q.status === 'pending' || q.status === 'draft');

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {customerData?.company.logo_url && (
              <img 
                src={customerData.company.logo_url} 
                alt={customerData.company.name}
                className="h-10 w-auto object-contain"
              />
            )}
            <div>
              <h1 className="font-semibold">{customerData?.company.name}</h1>
              <p className="text-sm text-muted-foreground">Customer Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              {customerData?.name}
            </span>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold">Welcome back, {customerData?.name}!</h2>
          <p className="text-muted-foreground">View your quotes, invoices, and service history below.</p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <ClipboardList className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{pendingQuotes.length}</p>
                  <p className="text-sm text-muted-foreground">Pending Quotes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                  <FileText className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{invoices.length}</p>
                  <p className="text-sm text-muted-foreground">Total Invoices</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-500/10 rounded-lg">
                  <CreditCard className="w-6 h-6 text-amber-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    ${unpaidInvoices.reduce((sum, i) => sum + Number(i.total), 0).toFixed(2)}
                  </p>
                  <p className="text-sm text-muted-foreground">Outstanding</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-emerald-500/10 rounded-lg">
                  <Briefcase className="w-6 h-6 text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{jobs.length}</p>
                  <p className="text-sm text-muted-foreground">Service Jobs</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="quotes" className="space-y-4">
          <TabsList>
            <TabsTrigger value="quotes" className="flex items-center gap-2">
              Quotes
              {pendingQuotes.length > 0 && (
                <Badge variant="secondary" className="ml-1">{pendingQuotes.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="invoices" className="flex items-center gap-2">
              Invoices
              {unpaidInvoices.length > 0 && (
                <Badge variant="secondary" className="ml-1">{unpaidInvoices.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="jobs">Service History</TabsTrigger>
          </TabsList>

          <TabsContent value="quotes">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="w-5 h-5" />
                  Your Quotes
                </CardTitle>
                <CardDescription>
                  Review and approve quotes to proceed with services
                </CardDescription>
              </CardHeader>
              <CardContent>
                {quotes.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Quote #</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Valid Until</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {quotes.map((quote) => (
                        <TableRow key={quote.id}>
                          <TableCell className="font-medium">{quote.quote_number}</TableCell>
                          <TableCell>{format(new Date(quote.created_at), 'MMM d, yyyy')}</TableCell>
                          <TableCell>
                            {quote.valid_until ? format(new Date(quote.valid_until), 'MMM d, yyyy') : '-'}
                          </TableCell>
                          <TableCell>{getStatusBadge(quote.status)}</TableCell>
                          <TableCell className="text-right font-medium">
                            ${Number(quote.total).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            {(quote.status === 'sent' || quote.status === 'pending' || quote.status === 'draft') && (
                              <Button
                                size="sm"
                                onClick={() => handleApproveQuote(quote)}
                                disabled={approvingQuote === quote.id}
                              >
                                {approvingQuote === quote.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <>
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    Approve
                                  </>
                                )}
                              </Button>
                            )}
                            {quote.status === 'approved' && (
                              <Badge variant="default" className="bg-emerald-500">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Approved
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <ClipboardList className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No quotes yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="invoices">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Your Invoices
                </CardTitle>
                <CardDescription>
                  View and pay your invoices online
                </CardDescription>
              </CardHeader>
              <CardContent>
                {invoices.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Invoice #</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.map((invoice) => (
                        <TableRow key={invoice.id}>
                          <TableCell className="font-medium">{invoice.invoice_number}</TableCell>
                          <TableCell>{format(new Date(invoice.created_at), 'MMM d, yyyy')}</TableCell>
                          <TableCell>
                            {invoice.due_date ? format(new Date(invoice.due_date), 'MMM d, yyyy') : '-'}
                          </TableCell>
                          <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                          <TableCell className="text-right font-medium">
                            ${Number(invoice.total).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDownloadInvoice(invoice)}
                                disabled={downloadingInvoice === invoice.id}
                              >
                                {downloadingInvoice === invoice.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Download className="w-4 h-4" />
                                )}
                              </Button>
                              {invoice.status !== 'paid' && (
                                <Button
                                  size="sm"
                                  onClick={() => handlePayInvoice(invoice)}
                                  disabled={payingInvoice === invoice.id}
                                >
                                  {payingInvoice === invoice.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <>
                                      <CreditCard className="w-4 h-4 mr-2" />
                                      Pay Now
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No invoices yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="jobs">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="w-5 h-5" />
                  Service History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {jobs.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Job #</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Scheduled</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {jobs.map((job) => (
                        <TableRow key={job.id}>
                          <TableCell className="font-medium">{job.job_number}</TableCell>
                          <TableCell>{job.title}</TableCell>
                          <TableCell>
                            {job.scheduled_start 
                              ? format(new Date(job.scheduled_start), 'MMM d, yyyy')
                              : '-'
                            }
                          </TableCell>
                          <TableCell>{getStatusBadge(job.status)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Briefcase className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No service history yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default CustomerPortal;
