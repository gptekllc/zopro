import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import ZoProLogo from '@/assets/ZoPro_Logo.png';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { Loader2, Mail, FileText, Briefcase, DollarSign, LogOut, Download, CreditCard, CheckCircle, ClipboardList, PenLine, Plus, Trash2, Wallet, Banknote, Phone, MapPin, Calendar, Clock, ChevronDown, ChevronUp, ChevronRight, X, ArrowLeft, Camera, ExternalLink, Bell, Printer, Star, MessageSquare, Edit2, CheckCheck, Receipt, User, Building2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { format, formatDistanceToNow } from 'date-fns';
import { SignatureDialog } from '@/components/signatures/SignatureDialog';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';

interface CustomerData {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: {
    id: string;
    name: string;
    logo_url: string | null;
    address: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
    phone: string | null;
    email: string | null;
    stripe_payments_enabled: boolean | null;
    default_payment_method: string | null;
  } | null;
}

interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface Invoice {
  id: string;
  invoice_number: string;
  status: string;
  total: number;
  subtotal?: number;
  tax?: number;
  created_at: string;
  due_date: string | null;
  notes?: string | null;
  items?: InvoiceItem[];
  signed_at?: string | null;
  signature?: SignatureData;
  company_id?: string;
  company_name?: string;
}

interface JobPhoto {
  id: string;
  photo_url: string;
  photo_type: string;
  caption: string | null;
  created_at: string;
}

interface SignatureData {
  id: string;
  signature_data: string;
  signer_name: string;
  signed_at: string;
  signer_ip: string | null;
}

interface Job {
  id: string;
  job_number: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  notes: string | null;
  created_at: string;
  completion_signed_at: string | null;
  has_feedback?: boolean;
  completion_signed_by: string | null;
  subtotal?: number;
  tax?: number;
  total?: number;
  items?: InvoiceItem[];
  photos?: JobPhoto[];
  signature?: SignatureData;
}

interface QuoteItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface Quote {
  id: string;
  quote_number: string;
  status: string;
  total: number;
  subtotal?: number;
  tax?: number;
  created_at: string;
  valid_until: string | null;
  notes: string | null;
  signed_at: string | null;
  items?: QuoteItem[];
  signature?: SignatureData;
}

interface SigningDocument {
  document: any;
  items: any[];
  company: any;
  customer: any;
  documentType: 'quote' | 'invoice' | 'job';
}

interface PaymentMethod {
  id: string;
  type: 'card' | 'bank';
  brand?: string;
  last4?: string;
  exp_month?: number;
  exp_year?: number;
  bank_name?: string;
  account_type?: string;
}

interface PaymentRecord {
  id: string;
  amount: number;
  method: string;
  payment_date: string;
  status: string;
  notes: string | null;
  invoice_number: string;
  invoice_id: string;
  invoice_total: number;
}

interface CustomerNotification {
  id: string;
  customer_id: string;
  company_id: string;
  type: string;
  title: string;
  message: string;
  data: any;
  is_read: boolean;
  created_at: string;
}

// Initialize Stripe - we need to get the publishable key
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder');

// Card Form Component for adding payment methods
const AddPaymentMethodForm = ({ 
  onSuccess, 
  onCancel,
  customerId,
  token 
}: { 
  onSuccess: () => void; 
  onCancel: () => void;
  customerId: string;
  token: string;
}) => {
  const stripe = useStripe();
  const elements = useElements();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Get setup intent from our edge function
      const { data, error: setupError } = await supabase.functions.invoke('setup-customer-payment-method', {
        body: { customerId, token, action: 'create-setup-intent' },
      });

      if (setupError || !data?.clientSecret) {
        throw new Error(data?.error || 'Failed to create setup intent');
      }

      const cardElement = elements.getElement(CardElement);
      if (!cardElement) throw new Error('Card element not found');

      const { error: confirmError } = await stripe.confirmCardSetup(data.clientSecret, {
        payment_method: {
          card: cardElement,
        },
      });

      if (confirmError) {
        throw new Error(confirmError.message);
      }

      toast.success('Payment method saved successfully!');
      onSuccess();
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message || 'Failed to save payment method');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-4 border rounded-lg bg-muted/50">
        <CardElement 
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: '#424770',
                '::placeholder': { color: '#aab7c4' },
              },
              invalid: { color: '#9e2146' },
            },
          }}
        />
      </div>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting || !stripe}>
          {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Save Card
        </Button>
      </div>
    </form>
  );
};

// Job Card Component with expandable details
const JobCard = ({ 
  job, 
  onSign,
  signingJob 
}: { 
  job: Job; 
  onSign: (job: Job) => void;
  signingJob: string | null;
}) => {
  const [expanded, setExpanded] = useState(false);
  
  const getJobStatusBadge = (status: string) => {
    const statusColors: Record<string, string> = {
      draft: 'bg-muted text-muted-foreground',
      scheduled: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      in_progress: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      invoiced: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      paid: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
    };
    // Capitalize first letter and replace underscores with spaces
    const displayStatus = status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return (
      <Badge className={statusColors[status] || 'bg-muted'}>
        {displayStatus}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const priorityColors: Record<string, string> = {
      low: 'bg-muted text-muted-foreground',
      medium: 'bg-blue-100 text-blue-800',
      high: 'bg-orange-100 text-orange-800',
      urgent: 'bg-red-100 text-red-800',
    };
    if (priority === 'low' || priority === 'medium') return null;
    // Capitalize first letter
    const displayPriority = priority.charAt(0).toUpperCase() + priority.slice(1);
    return (
      <Badge variant="outline" className={priorityColors[priority] || ''}>
        {displayPriority}
      </Badge>
    );
  };

  const isUpcoming = job.status === 'scheduled' && job.scheduled_start && new Date(job.scheduled_start) > new Date();
  
  return (
    <div className={`border rounded-lg overflow-hidden ${isUpcoming ? 'border-blue-300 bg-blue-50/50 dark:bg-blue-950/20' : ''}`}>
      {/* Header - Always visible */}
      <div 
        className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-medium text-sm">{job.job_number}</span>
              {getJobStatusBadge(job.status)}
              {getPriorityBadge(job.priority)}
              {isUpcoming && (
                <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">
                  Upcoming
                </Badge>
              )}
            </div>
            <h3 className="font-semibold truncate">{job.title}</h3>
            {job.scheduled_start && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                <Calendar className="w-4 h-4" />
                <span>{format(new Date(job.scheduled_start), 'EEEE, MMMM d, yyyy')}</span>
                <span className="mx-1">•</span>
                <Clock className="w-4 h-4" />
                <span>{format(new Date(job.scheduled_start), 'h:mm a')}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {job.completion_signed_at && (
              <Badge variant="default" className="bg-emerald-500">
                <CheckCircle className="w-3 h-3 mr-1" />
                Signed
              </Badge>
            )}
            {expanded ? (
              <ChevronUp className="w-5 h-5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
        </div>
      </div>

      {/* Expanded Details */}
      {expanded && (
        <div className="px-4 pb-4 pt-0 border-t bg-muted/30">
          <div className="grid gap-4 md:grid-cols-2 pt-4">
            {/* Description */}
            {job.description && (
              <div className="md:col-span-2">
                <p className="text-sm text-muted-foreground mb-1">Description</p>
                <p className="text-sm whitespace-pre-wrap">{job.description}</p>
              </div>
            )}

            {/* Scheduled Time */}
            {job.scheduled_start && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Scheduled Start</p>
                <p className="text-sm font-medium">
                  {format(new Date(job.scheduled_start), 'EEEE, MMMM d, yyyy')}
                  <br />
                  {format(new Date(job.scheduled_start), 'h:mm a')}
                </p>
              </div>
            )}
            
            {job.scheduled_end && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Scheduled End</p>
                <p className="text-sm font-medium">
                  {format(new Date(job.scheduled_end), 'EEEE, MMMM d, yyyy')}
                  <br />
                  {format(new Date(job.scheduled_end), 'h:mm a')}
                </p>
              </div>
            )}

            {/* Actual Times */}
            {job.actual_start && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Work Started</p>
                <p className="text-sm font-medium">
                  {format(new Date(job.actual_start), 'MMM d, yyyy h:mm a')}
                </p>
              </div>
            )}
            
            {job.actual_end && (
              <div>
                <p className="text-sm text-muted-foreground mb-1">Work Completed</p>
                <p className="text-sm font-medium">
                  {format(new Date(job.actual_end), 'MMM d, yyyy h:mm a')}
                </p>
              </div>
            )}

            {/* Notes */}
            {job.notes && (
              <div className="md:col-span-2">
                <p className="text-sm text-muted-foreground mb-1">Notes</p>
                <p className="text-sm whitespace-pre-wrap">{job.notes}</p>
              </div>
            )}

            {/* Signature Status */}
            {job.completion_signed_at && (
              <div className="md:col-span-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                  <CheckCircle className="w-5 h-5" />
                  <div>
                    <p className="font-medium">Job completion confirmed</p>
                    <p className="text-sm opacity-80">
                      Signed by {job.completion_signed_by} on {format(new Date(job.completion_signed_at), 'MMMM d, yyyy')}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sign Button */}
          {job.status === 'completed' && !job.completion_signed_at && (
            <div className="mt-4 pt-4 border-t">
              <Button
                onClick={(e) => {
                  e.stopPropagation();
                  onSign(job);
                }}
                disabled={signingJob === job.id}
                className="w-full sm:w-auto"
              >
                {signingJob === job.id ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <PenLine className="w-4 h-4 mr-2" />
                )}
                Sign Job Completion
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const CustomerPortal = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [isSendingLink, setIsSendingLink] = useState(false);
  const [downloadingInvoice, setDownloadingInvoice] = useState<string | null>(null);
  const [downloadingQuote, setDownloadingQuote] = useState<string | null>(null);
  const [downloadingJob, setDownloadingJob] = useState<string | null>(null);
  const [payingInvoice, setPayingInvoice] = useState<string | null>(null);
  const [approvingQuote, setApprovingQuote] = useState<string | null>(null);
  const [signingJob, setSigningJob] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [linkSent, setLinkSent] = useState(false);
  const [customerData, setCustomerData] = useState<CustomerData | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isUnassignedCustomer, setIsUnassignedCustomer] = useState(false);
  const [hasCompanyAccess, setHasCompanyAccess] = useState(false);
  
  // Multi-invoice payment selection states
  const [showPaymentSelection, setShowPaymentSelection] = useState(false);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<Set<string>>(new Set());
  const [isPayingMultiple, setIsPayingMultiple] = useState(false);
  
  // Multi-company payment states
  const [paymentStep, setPaymentStep] = useState<'company-select' | 'invoice-select'>('company-select');
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  
  // Payment methods state
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [isLoadingPaymentMethods, setIsLoadingPaymentMethods] = useState(false);
  const [showAddPaymentMethod, setShowAddPaymentMethod] = useState(false);
  const [deletingPaymentMethod, setDeletingPaymentMethod] = useState<string | null>(null);
  
  // Signature dialog states
  const [signatureDialogOpen, setSignatureDialogOpen] = useState(false);
  const [signatureAction, setSignatureAction] = useState<{
    type: 'quote' | 'invoice' | 'invoice-sign-only' | 'job';
    id: string;
    data?: any;
  } | null>(null);
  const [isSubmittingSignature, setIsSubmittingSignature] = useState(false);
  
  // Signing mode state (for magic link signature requests)
  const [signingMode, setSigningMode] = useState<{
    documentType: 'quote' | 'invoice' | 'job';
    documentId: string;
  } | null>(null);
  const [signingDocument, setSigningDocument] = useState<SigningDocument | null>(null);
  const [isLoadingSigningDocument, setIsLoadingSigningDocument] = useState(false);
  
  // Detail view states
  const [viewingQuote, setViewingQuote] = useState<Quote | null>(null);
  const [viewingInvoice, setViewingInvoice] = useState<Invoice | null>(null);
  const [viewingJob, setViewingJob] = useState<Job | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState<string | null>(null);
  
  // Tab control state for programmatic tab switching
  const [activeTab, setActiveTab] = useState('jobs');

  // Feedback form states
  const [showFeedbackDialog, setShowFeedbackDialog] = useState(false);
  const [feedbackJob, setFeedbackJob] = useState<Job | null>(null);
  const [feedbackRating, setFeedbackRating] = useState(5);
  const [feedbackText, setFeedbackText] = useState('');
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [feedbackMode, setFeedbackMode] = useState<'create' | 'edit'>('create');
  const [existingFeedbackId, setExistingFeedbackId] = useState<string | null>(null);
  const [isDeletingFeedback, setIsDeletingFeedback] = useState(false);
  const [viewingJobFeedback, setViewingJobFeedback] = useState<{ rating: number; feedback_text: string | null } | null>(null);
  const [isLoadingViewingFeedback, setIsLoadingViewingFeedback] = useState(false);

  // Notification states
  const [notifications, setNotifications] = useState<CustomerNotification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);

  // Payment history states
  const [paymentHistory, setPaymentHistory] = useState<PaymentRecord[]>([]);
  const [isLoadingPaymentHistory, setIsLoadingPaymentHistory] = useState(false);
  const [downloadingReceipt, setDownloadingReceipt] = useState<string | null>(null);

  // Check for magic link token and payment status in URL
  useEffect(() => {
    const token = searchParams.get('token');
    const customerId = searchParams.get('customer');
    const paymentStatus = searchParams.get('payment');
    const signDocType = searchParams.get('sign') as 'quote' | 'invoice' | 'job' | null;
    const signDocId = searchParams.get('doc');
    
    if (paymentStatus === 'success') {
      toast.success('Payment successful! Thank you.');
      // Clean the URL
      navigate('/customer-portal', { replace: true });
    } else if (paymentStatus === 'cancelled') {
      toast.info('Payment was cancelled.');
      navigate('/customer-portal', { replace: true });
    }
    
    // Check for signing mode params
    if (signDocType && signDocId && ['quote', 'invoice', 'job'].includes(signDocType)) {
      setSigningMode({ documentType: signDocType, documentId: signDocId });
    }
    
    if (token && customerId) {
      verifyToken(token, customerId, signDocType, signDocId);
    } else {
      // Check if already authenticated via sessionStorage (more secure than localStorage)
      const savedCustomerId = sessionStorage.getItem('customer_portal_id');
      const savedToken = sessionStorage.getItem('customer_portal_token');
      if (savedCustomerId && savedToken) {
        verifyToken(savedToken, savedCustomerId, signDocType, signDocId);
      } else {
        setIsLoading(false);
      }
    }
  }, [searchParams]);

  // Play notification sound
  const playNotificationSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (e) {
      console.log('Could not play notification sound');
    }
  };

  // Real-time subscription for new quotes and invoices
  useEffect(() => {
    if (!isAuthenticated || !customerData?.id) return;

    const customerId = customerData.id;

    // Subscribe to new quotes for this customer
    const quotesChannel = supabase
      .channel('customer-portal-quotes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'quotes',
          filter: `customer_id=eq.${customerId}`
        },
        (payload) => {
          const newQuote = payload.new as Quote;
          setQuotes(prev => [newQuote, ...prev]);
          playNotificationSound();
          toast.info('📋 New quote received!', {
            description: `Quote ${newQuote.quote_number} for $${Number(newQuote.total).toFixed(2)}`,
            duration: 5000
          });
        }
      )
      .subscribe();

    // Subscribe to new invoices for this customer
    const invoicesChannel = supabase
      .channel('customer-portal-invoices')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'invoices',
          filter: `customer_id=eq.${customerId}`
        },
        (payload) => {
          const newInvoice = payload.new as Invoice;
          setInvoices(prev => [newInvoice, ...prev]);
          playNotificationSound();
          toast.info('📄 New invoice received!', {
            description: `Invoice ${newInvoice.invoice_number} for $${Number(newInvoice.total).toFixed(2)}`,
            duration: 5000
          });
        }
      )
      .subscribe();

    // Subscribe to new jobs for this customer
    const jobsChannel = supabase
      .channel('customer-portal-jobs')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'jobs',
          filter: `customer_id=eq.${customerId}`
        },
        (payload) => {
          const newJob = payload.new as Job;
          setJobs(prev => [newJob, ...prev]);
          toast.info('🔧 New job scheduled!', {
            description: `${newJob.title}`,
            duration: 5000
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(quotesChannel);
      supabase.removeChannel(invoicesChannel);
      supabase.removeChannel(jobsChannel);
    };
  }, [isAuthenticated, customerData?.id]);

  const verifyToken = async (
    token: string, 
    customerId: string, 
    signDocType?: 'quote' | 'invoice' | 'job' | null, 
    signDocId?: string | null
  ) => {
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
      setIsUnassignedCustomer(data.isUnassigned === true);
      setHasCompanyAccess(data.hasCompanyAccess === true);
      setIsAuthenticated(true);
      
      // If in signing mode, fetch the specific document details
      if (signDocType && signDocId) {
        fetchDocumentForSigning(signDocType, signDocId, customerId, token);
      }
      
      // Clean URL
      navigate('/customer-portal', { replace: true });
    } catch (err) {
      console.error('Token verification error:', err);
      toast.error('Failed to verify access. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDocumentForSigning = async (
    documentType: 'quote' | 'invoice' | 'job',
    documentId: string,
    customerId: string,
    token: string
  ) => {
    setIsLoadingSigningDocument(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal-auth', {
        body: { 
          action: 'get-document-for-signing', 
          documentType, 
          documentId, 
          customerId, 
          token 
        },
      });

      if (error || !data?.success) {
        toast.error('Failed to load document. It may no longer be available.');
        setSigningMode(null);
        return;
      }

      setSigningDocument({
        document: data.document,
        items: data.items,
        company: data.company,
        customer: data.customer,
        documentType: data.documentType,
      });
    } catch (err) {
      console.error('Error fetching document for signing:', err);
      toast.error('Failed to load document');
      setSigningMode(null);
    } finally {
      setIsLoadingSigningDocument(false);
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
        toast.success('Access link sent! Check your email.');
      }
    } catch (err: any) {
      toast.error('Failed to send access link. Please try again.');
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
    setPaymentMethods([]);
    setHasCompanyAccess(false);
  };

  // Handle pay multiple invoices
  const handlePayMultipleInvoices = async () => {
    if (selectedInvoiceIds.size === 0) {
      toast.error('Please select at least one invoice to pay');
      return;
    }
    
    setSignatureAction({ 
      type: 'invoice', 
      id: 'multiple',
      data: { 
        invoiceIds: Array.from(selectedInvoiceIds),
        total: unpaidInvoices
          .filter(i => selectedInvoiceIds.has(i.id))
          .reduce((sum, i) => sum + Number(i.total), 0)
      }
    });
    setSignatureDialogOpen(true);
  };

  // Modified signature complete handler to support multiple invoices
  const handleMultiInvoiceSignatureComplete = async (signatureData: string, signerName: string) => {
    if (!signatureAction?.data?.invoiceIds) return;
    
    setIsPayingMultiple(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-invoice-payment', {
        body: { 
          invoiceIds: signatureAction.data.invoiceIds,
          customerId: customerData?.id,
          token: sessionStorage.getItem('customer_portal_token'),
          signatureData,
          signerName,
        },
      });

      if (error || !data?.url) {
        throw new Error(data?.error || 'Failed to create payment session');
      }

      // Redirect to Stripe checkout
      window.open(data.url, '_blank');
      setShowPaymentSelection(false);
      setSelectedInvoiceIds(new Set());
    } catch (err: any) {
      console.error('Multi-invoice payment error:', err);
      toast.error(err.message || 'Failed to create payment session');
    } finally {
      setIsPayingMultiple(false);
      setSignatureDialogOpen(false);
      setSignatureAction(null);
    }
  };

  // Fetch quote details
  const handleViewQuote = async (quote: Quote) => {
    if (quote.items && quote.items.length > 0 && quote.signature !== undefined) {
      setViewingQuote(quote);
      return;
    }
    
    setIsLoadingDetails(quote.id);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal-auth', {
        body: { 
          action: 'get-document-details', 
          documentType: 'quote',
          documentId: quote.id,
          customerId: customerData?.id,
          token: sessionStorage.getItem('customer_portal_token'),
        },
      });

      if (error) throw error;
      setViewingQuote({ 
        ...quote, 
        items: data?.items || [], 
        notes: data?.document?.notes || quote.notes,
        signature: data?.document?.signature || null,
      });
    } catch (err) {
      console.error('Failed to fetch quote details:', err);
      setViewingQuote(quote);
    } finally {
      setIsLoadingDetails(null);
    }
  };

  // Fetch invoice details
  const handleViewInvoice = async (invoice: Invoice) => {
    if (invoice.items && invoice.items.length > 0 && invoice.signature !== undefined) {
      setViewingInvoice(invoice);
      return;
    }
    
    setIsLoadingDetails(invoice.id);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal-auth', {
        body: { 
          action: 'get-document-details', 
          documentType: 'invoice',
          documentId: invoice.id,
          customerId: customerData?.id,
          token: sessionStorage.getItem('customer_portal_token'),
        },
      });

      if (error) throw error;
      setViewingInvoice({ 
        ...invoice, 
        items: data?.items || [], 
        notes: data?.document?.notes, 
        subtotal: data?.document?.subtotal, 
        tax: data?.document?.tax,
        signed_at: data?.document?.signed_at,
        signature: data?.document?.signature || null,
      });
    } catch (err) {
      console.error('Failed to fetch invoice details:', err);
      setViewingInvoice(invoice);
    } finally {
      setIsLoadingDetails(null);
    }
  };

  // Fetch job details
  const handleViewJob = async (job: Job) => {
    // Reset feedback state when opening a new job
    setViewingJobFeedback(null);
    
    if (job.items && job.items.length > 0 && job.photos !== undefined) {
      setViewingJob(job);
      // Fetch feedback if job has feedback
      if (job.has_feedback) {
        fetchViewingJobFeedback(job.id);
      }
      return;
    }
    
    setIsLoadingDetails(job.id);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal-auth', {
        body: { 
          action: 'get-document-details', 
          documentType: 'job',
          documentId: job.id,
          customerId: customerData?.id,
          token: sessionStorage.getItem('customer_portal_token'),
        },
      });

      if (error) throw error;
      setViewingJob({ 
        ...job, 
        items: data?.items || [], 
        subtotal: data?.document?.subtotal, 
        tax: data?.document?.tax, 
        total: data?.document?.total,
        photos: data?.document?.photos || [],
        signature: data?.document?.signature || null,
      });
      
      // Fetch feedback if job has feedback
      if (job.has_feedback) {
        fetchViewingJobFeedback(job.id);
      }
    } catch (err) {
      console.error('Failed to fetch job details:', err);
      setViewingJob(job);
    } finally {
      setIsLoadingDetails(null);
    }
  };

  // Fetch feedback for viewing job
  const fetchViewingJobFeedback = async (jobId: string) => {
    setIsLoadingViewingFeedback(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal-auth', {
        body: {
          action: 'get-feedback',
          jobId,
          customerId: customerData?.id,
          token: sessionStorage.getItem('customer_portal_token'),
        },
      });

      if (error) throw error;

      if (data?.feedback) {
        setViewingJobFeedback({
          rating: data.feedback.rating,
          feedback_text: data.feedback.feedback_text,
        });
      }
    } catch (err) {
      console.error('Failed to fetch feedback:', err);
    } finally {
      setIsLoadingViewingFeedback(false);
    }
  };

  // Fetch payment methods
  const fetchPaymentMethods = async () => {
    if (!customerData?.id) return;
    
    setIsLoadingPaymentMethods(true);
    try {
      const { data, error } = await supabase.functions.invoke('setup-customer-payment-method', {
        body: {
          customerId: customerData.id,
          token: sessionStorage.getItem('customer_portal_token'),
          action: 'get-payment-methods',
        },
      });

      if (error) throw error;
      setPaymentMethods(data?.paymentMethods || []);
    } catch (err) {
      console.error('Failed to fetch payment methods:', err);
    } finally {
      setIsLoadingPaymentMethods(false);
    }
  };

  // Fetch payment methods when authenticated
  useEffect(() => {
    if (isAuthenticated && customerData?.id) {
      fetchPaymentMethods();
    }
  }, [isAuthenticated, customerData?.id]);

  // Fetch payment history
  const fetchPaymentHistory = async () => {
    if (!customerData?.id) return;
    
    setIsLoadingPaymentHistory(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal-auth', {
        body: {
          action: 'get-payment-history',
          customerId: customerData.id,
          token: sessionStorage.getItem('customer_portal_token'),
        },
      });

      if (error) throw error;
      setPaymentHistory(data?.payments || []);
    } catch (err) {
      console.error('Failed to fetch payment history:', err);
    } finally {
      setIsLoadingPaymentHistory(false);
    }
  };

  // Fetch payment history when authenticated
  useEffect(() => {
    if (isAuthenticated && customerData?.id) {
      fetchPaymentHistory();
    }
  }, [isAuthenticated, customerData?.id]);

  // Handle receipt download
  const handleDownloadReceipt = async (payment: PaymentRecord) => {
    setDownloadingReceipt(payment.id);
    try {
      const { data, error } = await supabase.functions.invoke('generate-payment-receipt', {
        body: {
          paymentId: payment.id,
          action: 'download',
        },
      });

      if (error) throw error;

      if (data?.pdf) {
        // Convert base64 to blob and download
        const binaryString = atob(data.pdf);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `receipt-${payment.invoice_number}-${format(new Date(payment.payment_date), 'yyyy-MM-dd')}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success('Receipt downloaded');
      }
    } catch (err: any) {
      console.error('Failed to download receipt:', err);
      toast.error('Failed to download receipt');
    } finally {
      setDownloadingReceipt(null);
    }
  };

  // Get payment method display label
  const getPaymentMethodLabel = (method: string) => {
    const labels: Record<string, string> = {
      cash: 'Cash',
      check: 'Check',
      credit_card: 'Credit Card',
      bank_transfer: 'Bank Transfer',
      stripe: 'Online Payment',
      other: 'Other',
    };
    return labels[method] || method;
  };

  const handleDeletePaymentMethod = async (paymentMethodId: string) => {
    if (!customerData?.id) return;
    
    setDeletingPaymentMethod(paymentMethodId);
    try {
      const { error } = await supabase.functions.invoke('setup-customer-payment-method', {
        body: {
          customerId: customerData.id,
          token: sessionStorage.getItem('customer_portal_token'),
          action: 'delete-payment-method',
          paymentMethodId,
        },
      });

      if (error) throw error;
      
      toast.success('Payment method removed');
      setPaymentMethods(prev => prev.filter(pm => pm.id !== paymentMethodId));
    } catch (err: any) {
      toast.error(err.message || 'Failed to remove payment method');
    } finally {
      setDeletingPaymentMethod(null);
    }
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

  const handleDownloadQuote = async (quote: Quote) => {
    setDownloadingQuote(quote.id);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal-auth', {
        body: { 
          action: 'download-quote', 
          quoteId: quote.id,
          customerId: customerData?.id,
          token: sessionStorage.getItem('customer_portal_token'),
        },
      });

      if (error || !data?.html) {
        throw new Error(data?.error || 'Failed to generate quote');
      }

      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(data.html);
        printWindow.document.close();
        printWindow.document.title = `Quote ${quote.quote_number}`;
        setTimeout(() => {
          printWindow.print();
        }, 500);
      } else {
        toast.error('Please allow popups to download the quote');
      }
    } catch (err: any) {
      console.error('Download error:', err);
      toast.error('Failed to download quote');
    } finally {
      setDownloadingQuote(null);
    }
  };

  const handleDownloadJob = async (job: Job) => {
    setDownloadingJob(job.id);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal-auth', {
        body: { 
          action: 'download-job', 
          jobId: job.id,
          customerId: customerData?.id,
          token: sessionStorage.getItem('customer_portal_token'),
        },
      });

      if (error || !data?.html) {
        throw new Error(data?.error || 'Failed to generate job details');
      }

      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.write(data.html);
        printWindow.document.close();
        printWindow.document.title = `Job ${job.job_number}`;
        setTimeout(() => {
          printWindow.print();
        }, 500);
      } else {
        toast.error('Please allow popups to download the job details');
      }
    } catch (err: any) {
      console.error('Download error:', err);
      toast.error('Failed to download job details');
    } finally {
      setDownloadingJob(null);
    }
  };

  const handlePayInvoice = async (invoice: Invoice) => {
    // Open signature dialog for invoice payment
    setSignatureAction({ type: 'invoice', id: invoice.id, data: invoice });
    setSignatureDialogOpen(true);
  };

  const handleSignInvoice = (invoice: Invoice) => {
    // Open signature dialog for invoice signing only (no payment)
    setSignatureAction({ type: 'invoice-sign-only', id: invoice.id, data: invoice });
    setSignatureDialogOpen(true);
  };

  const handleApproveQuote = async (quote: Quote) => {
    // Open signature dialog for quote approval
    setSignatureAction({ type: 'quote', id: quote.id, data: quote });
    setSignatureDialogOpen(true);
  };

  const handleSignJobCompletion = (job: Job) => {
    setSignatureAction({ type: 'job', id: job.id, data: job });
    setSignatureDialogOpen(true);
  };

  const handleSignatureComplete = async (signatureData: string, signerName: string) => {
    if (!signatureAction) return;
    
    setIsSubmittingSignature(true);
    
    try {
      if (signatureAction.type === 'quote') {
        setApprovingQuote(signatureAction.id);
        const { data, error } = await supabase.functions.invoke('customer-portal-auth', {
          body: { 
            action: 'approve-quote', 
            quoteId: signatureAction.id,
            customerId: customerData?.id,
            token: sessionStorage.getItem('customer_portal_token'),
            signatureData,
            signerName,
          },
        });

        if (error) {
          throw new Error(data?.error || 'Failed to approve quote');
        }

        toast.success('Quote approved and signed successfully!');
        
        // Update local state
        setQuotes(quotes.map(q => 
          q.id === signatureAction.id ? { ...q, status: 'approved', signed_at: new Date().toISOString() } : q
        ));
        setApprovingQuote(null);
      } else if (signatureAction.type === 'invoice') {
        setPayingInvoice(signatureAction.id);
        const { data, error } = await supabase.functions.invoke('create-invoice-payment', {
          body: { 
            invoiceId: signatureAction.id,
            customerId: customerData?.id,
            token: sessionStorage.getItem('customer_portal_token'),
            signatureData,
            signerName,
          },
        });

        if (error || !data?.url) {
          throw new Error(data?.error || 'Failed to create payment session');
        }

        // Redirect to Stripe checkout
        window.open(data.url, '_blank');
        setPayingInvoice(null);
      } else if (signatureAction.type === 'invoice-sign-only') {
        // Sign invoice without payment
        const { data, error } = await supabase.functions.invoke('customer-portal-auth', {
          body: { 
            action: 'sign-invoice', 
            invoiceId: signatureAction.id,
            customerId: customerData?.id,
            token: sessionStorage.getItem('customer_portal_token'),
            signatureData,
            signerName,
          },
        });

        if (error) {
          throw new Error(data?.error || 'Failed to sign invoice');
        }

        toast.success('Invoice signed successfully!');
        
        // Update local state
        setInvoices(invoices.map(i => 
          i.id === signatureAction.id ? { ...i, signed_at: new Date().toISOString() } : i
        ));
      } else if (signatureAction.type === 'job') {
        setSigningJob(signatureAction.id);
        const { data, error } = await supabase.functions.invoke('customer-portal-auth', {
          body: { 
            action: 'sign-job-completion', 
            jobId: signatureAction.id,
            customerId: customerData?.id,
            token: sessionStorage.getItem('customer_portal_token'),
            signatureData,
            signerName,
          },
        });

        if (error) {
          throw new Error(data?.error || 'Failed to sign job completion');
        }

        toast.success('Job completion confirmed and signed!');
        
        // Update local state
        const signedJob = jobs.find(j => j.id === signatureAction.id);
        setJobs(jobs.map(j => 
          j.id === signatureAction.id ? { ...j, completion_signed_at: new Date().toISOString() } : j
        ));
        setSigningJob(null);
        
        // Prompt for feedback after successful signing
        if (data?.promptFeedback && signedJob && !signedJob.has_feedback) {
          setTimeout(() => {
            setFeedbackJob({ ...signedJob, completion_signed_at: new Date().toISOString() });
            setShowFeedbackDialog(true);
          }, 500);
        }
      }
      
      setSignatureDialogOpen(false);
      setSignatureAction(null);
    } catch (err: any) {
      console.error('Signature action error:', err);
      toast.error(err.message || 'Failed to complete action');
      setApprovingQuote(null);
      setPayingInvoice(null);
      setSigningJob(null);
    } finally {
      setIsSubmittingSignature(false);
    }
  };

  // Handle feedback submission (create or update)
  const handleSubmitFeedback = async () => {
    if (!feedbackJob || !customerData?.id) return;
    
    setIsSubmittingFeedback(true);
    try {
      const action = feedbackMode === 'edit' ? 'update-feedback' : 'submit-feedback';
      const { error } = await supabase.functions.invoke('customer-portal-auth', {
        body: {
          action,
          jobId: feedbackJob.id,
          customerId: customerData.id,
          token: sessionStorage.getItem('customer_portal_token'),
          rating: feedbackRating,
          feedbackText: feedbackText,
        },
      });

      if (error) throw error;

      toast.success(feedbackMode === 'edit' ? 'Feedback updated!' : 'Thank you for your feedback!');
      
      // Update job to show feedback was given
      setJobs(jobs.map(j => 
        j.id === feedbackJob.id ? { ...j, has_feedback: true } : j
      ));
      
      setShowFeedbackDialog(false);
      setFeedbackJob(null);
      setFeedbackRating(5);
      setFeedbackText('');
      setFeedbackMode('create');
      setExistingFeedbackId(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to submit feedback');
    } finally {
      setIsSubmittingFeedback(false);
    }
  };

  // Handle feedback deletion
  const handleDeleteFeedback = async () => {
    if (!feedbackJob || !customerData?.id) return;
    
    setIsDeletingFeedback(true);
    try {
      const { error } = await supabase.functions.invoke('customer-portal-auth', {
        body: {
          action: 'delete-feedback',
          jobId: feedbackJob.id,
          customerId: customerData.id,
          token: sessionStorage.getItem('customer_portal_token'),
        },
      });

      if (error) throw error;

      toast.success('Feedback deleted');
      
      // Update job to show feedback was removed
      setJobs(jobs.map(j => 
        j.id === feedbackJob.id ? { ...j, has_feedback: false } : j
      ));
      
      setShowFeedbackDialog(false);
      setFeedbackJob(null);
      setFeedbackRating(5);
      setFeedbackText('');
      setFeedbackMode('create');
      setExistingFeedbackId(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete feedback');
    } finally {
      setIsDeletingFeedback(false);
    }
  };

  // Handle editing feedback - fetch existing feedback first
  const handleEditFeedback = async (job: Job) => {
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal-auth', {
        body: {
          action: 'get-feedback',
          jobId: job.id,
          customerId: customerData?.id,
          token: sessionStorage.getItem('customer_portal_token'),
        },
      });

      if (error) throw error;

      if (data?.feedback) {
        setFeedbackRating(data.feedback.rating);
        setFeedbackText(data.feedback.feedback_text || '');
        setExistingFeedbackId(data.feedback.id);
        setFeedbackMode('edit');
        setFeedbackJob(job);
        setShowFeedbackDialog(true);
      }
    } catch (err: any) {
      toast.error('Failed to load feedback');
    }
  };

  // Fetch customer notifications
  const fetchNotifications = async () => {
    if (!customerData?.id) return;
    
    setIsLoadingNotifications(true);
    try {
      const { data, error } = await supabase.functions.invoke('customer-portal-auth', {
        body: {
          action: 'get-notifications',
          customerId: customerData.id,
          token: sessionStorage.getItem('customer_portal_token'),
        },
      });

      if (error) throw error;
      setNotifications(data?.notifications || []);
    } catch (err: any) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setIsLoadingNotifications(false);
    }
  };

  // Mark all notifications as read
  const handleMarkAllRead = async () => {
    if (!customerData?.id) return;
    
    try {
      const { error } = await supabase.functions.invoke('customer-portal-auth', {
        body: {
          action: 'mark-all-notifications-read',
          customerId: customerData.id,
          token: sessionStorage.getItem('customer_portal_token'),
        },
      });

      if (error) throw error;
      setNotifications(notifications.map(n => ({ ...n, is_read: true })));
      toast.success('All notifications marked as read');
    } catch (err: any) {
      toast.error('Failed to mark notifications as read');
    }
  };

  // Clear all notifications
  const handleClearAllNotifications = async () => {
    if (!customerData?.id) return;
    
    try {
      const { error } = await supabase.functions.invoke('customer-portal-auth', {
        body: {
          action: 'clear-all-notifications',
          customerId: customerData.id,
          token: sessionStorage.getItem('customer_portal_token'),
        },
      });

      if (error) throw error;
      setNotifications([]);
      toast.success('All notifications cleared');
    } catch (err: any) {
      toast.error('Failed to clear notifications');
    }
  };

  // Fetch notifications when authenticated
  useEffect(() => {
    if (isAuthenticated && customerData?.id) {
      fetchNotifications();
    }
  }, [isAuthenticated, customerData?.id]);

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
    // Capitalize first letter and replace underscores with spaces
    const displayStatus = status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return <Badge variant={variants[status] || 'outline'}>{displayStatus}</Badge>;
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary/5 via-background to-primary/10 p-4">
        <div className="text-center mb-6">
          <img 
            src={ZoProLogo} 
            alt="ZoPro Logo" 
            className="h-16 w-auto mx-auto mb-3"
          />
          <h1 className="text-2xl font-bold text-foreground">ZoPro</h1>
          <p className="text-muted-foreground">Your Service Management Solution</p>
        </div>
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Customer Portal</CardTitle>
            <CardDescription>
              {linkSent 
                ? 'Check your email for the access link'
                : 'Enter your email to receive an access link'
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
                  We've sent an access link to <strong>{email}</strong>. 
                  Click the link in the email to access your portal.
                </p>
              <div className="flex flex-col gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => { setLinkSent(false); setEmail(''); }}
                >
                  Use a different email
                </Button>
                <Button 
                  variant="ghost" 
                  onClick={() => navigate('/login')}
                >
                  Back to Login
                </Button>
              </div>
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
                      Send Access Link
                    </>
                  )}
                </Button>
                <Button 
                  type="button"
                  variant="ghost" 
                  className="w-full"
                  onClick={() => navigate('/login')}
                >
                  Back to Login
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Signing mode view - when customer clicked a signature request link
  if (signingMode && isAuthenticated) {
    const documentTypeLabels: Record<string, string> = {
      quote: 'Quote',
      invoice: 'Invoice',
      job: 'Job Completion',
    };
    
    const handleSigningComplete = async (signatureData: string, signerName: string) => {
      if (!signingDocument) return;
      
      setIsSubmittingSignature(true);
      try {
        const customerId = sessionStorage.getItem('customer_portal_id');
        const token = sessionStorage.getItem('customer_portal_token');
        
        if (signingMode.documentType === 'quote') {
          const { error } = await supabase.functions.invoke('customer-portal-auth', {
            body: {
              action: 'approve-quote',
              quoteId: signingMode.documentId,
              customerId,
              token,
              signatureData,
              signerName,
            },
          });
          if (error) throw error;
          toast.success('Quote approved and signed successfully!');
        } else if (signingMode.documentType === 'invoice') {
          const { data, error } = await supabase.functions.invoke('create-invoice-payment', {
            body: {
              invoiceId: signingMode.documentId,
              customerId,
              token,
              signatureData,
              signerName,
            },
          });
          if (error || !data?.url) throw new Error(data?.error || 'Failed to create payment');
          window.location.href = data.url;
          return;
        } else if (signingMode.documentType === 'job') {
          const { error } = await supabase.functions.invoke('customer-portal-auth', {
            body: {
              action: 'sign-job-completion',
              jobId: signingMode.documentId,
              customerId,
              token,
              signatureData,
              signerName,
            },
          });
          if (error) throw error;
          toast.success('Job completion confirmed and signed!');
        }
        
        setSigningMode(null);
        setSigningDocument(null);
        setSignatureDialogOpen(false);
      } catch (err: any) {
        toast.error(err.message || 'Failed to complete signing');
      } finally {
        setIsSubmittingSignature(false);
      }
    };

    const getDocumentNumber = () => {
      if (!signingDocument?.document) return '';
      if (signingMode.documentType === 'quote') return signingDocument.document.quote_number;
      if (signingMode.documentType === 'invoice') return signingDocument.document.invoice_number;
      if (signingMode.documentType === 'job') return signingDocument.document.job_number;
      return '';
    };

    const isAlreadySigned = () => {
      if (!signingDocument?.document) return false;
      if (signingMode.documentType === 'quote') return !!signingDocument.document.signed_at || signingDocument.document.status === 'approved';
      if (signingMode.documentType === 'invoice') return !!signingDocument.document.signed_at || signingDocument.document.status === 'paid';
      if (signingMode.documentType === 'job') return !!signingDocument.document.completion_signed_at;
      return false;
    };

    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-primary/10">
        {/* Header */}
        <header className="border-b bg-card">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {signingDocument?.company?.logo_url && (
                <img 
                  src={signingDocument.company.logo_url} 
                  alt={signingDocument.company.name}
                  className="h-10 w-auto object-contain"
                />
              )}
              <div>
                <h1 className="font-semibold">{signingDocument?.company?.name || 'Loading...'}</h1>
                <p className="text-sm text-muted-foreground">Document Signing</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={() => { setSigningMode(null); setSigningDocument(null); }}>
              View Full Portal
            </Button>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8 max-w-4xl">
          {isLoadingSigningDocument ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : !signingDocument ? (
            <Card className="text-center py-12">
              <CardContent>
                <p className="text-muted-foreground">Document not found or no longer available.</p>
                <Button className="mt-4" onClick={() => { setSigningMode(null); setSigningDocument(null); }}>
                  Go to Portal
                </Button>
              </CardContent>
            </Card>
          ) : isAlreadySigned() ? (
            <Card className="text-center py-12">
              <CardContent className="space-y-4">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
                  <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
                <h2 className="text-2xl font-bold">Already Signed</h2>
                <p className="text-muted-foreground">
                  This {documentTypeLabels[signingMode.documentType].toLowerCase()} has already been signed.
                </p>
                <Button onClick={() => { setSigningMode(null); setSigningDocument(null); }}>
                  View Full Portal
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-6">
              {/* Document Header */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        {documentTypeLabels[signingMode.documentType]} {getDocumentNumber()}
                      </CardTitle>
                      <CardDescription>
                        Please review and sign this document
                      </CardDescription>
                    </div>
                    <Badge variant="secondary" className="capitalize">{signingDocument.document.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Document Info */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">From</p>
                      <p className="font-medium">{signingDocument.company?.name}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">To</p>
                      <p className="font-medium">{signingDocument.customer?.name}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Date</p>
                      <p className="font-medium">
                        {format(new Date(signingDocument.document.created_at), 'MMM d, yyyy')}
                      </p>
                    </div>
                    {signingDocument.document.total && (
                      <div>
                        <p className="text-muted-foreground">Total</p>
                        <p className="font-medium text-lg">${Number(signingDocument.document.total).toLocaleString()}</p>
                      </div>
                    )}
                  </div>

                  {/* Line Items */}
                  {signingDocument.items && signingDocument.items.length > 0 && (
                    <div className="border rounded-lg overflow-hidden mt-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Description</TableHead>
                            <TableHead className="text-right">Qty</TableHead>
                            <TableHead className="text-right">Price</TableHead>
                            <TableHead className="text-right">Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {signingDocument.items.map((item: any) => (
                            <TableRow key={item.id}>
                              <TableCell>{item.description}</TableCell>
                              <TableCell className="text-right">{item.quantity}</TableCell>
                              <TableCell className="text-right">${Number(item.unit_price).toLocaleString()}</TableCell>
                              <TableCell className="text-right font-medium">${Number(item.total).toLocaleString()}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}

                  {/* Totals */}
                  {signingDocument.document.total && (
                    <div className="flex justify-end pt-4 border-t">
                      <div className="w-48 space-y-1">
                        {signingDocument.document.subtotal && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Subtotal</span>
                            <span>${Number(signingDocument.document.subtotal).toLocaleString()}</span>
                          </div>
                        )}
                        {signingDocument.document.tax && (
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Tax</span>
                            <span>${Number(signingDocument.document.tax).toLocaleString()}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-lg font-semibold pt-2 border-t">
                          <span>Total</span>
                          <span>${Number(signingDocument.document.total).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Notes */}
                  {signingDocument.document.notes && (
                    <div className="pt-4 border-t">
                      <p className="text-sm text-muted-foreground mb-1">Notes</p>
                      <p className="text-sm whitespace-pre-wrap">{signingDocument.document.notes}</p>
                    </div>
                  )}

                  {/* Job-specific content */}
                  {signingMode.documentType === 'job' && (
                    <div className="pt-4 border-t">
                      <p className="text-sm text-muted-foreground mb-1">Job Title</p>
                      <p className="font-medium">{signingDocument.document.title}</p>
                      {signingDocument.document.description && (
                        <>
                          <p className="text-sm text-muted-foreground mt-3 mb-1">Description</p>
                          <p className="text-sm whitespace-pre-wrap">{signingDocument.document.description}</p>
                        </>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Sign Button */}
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center space-y-4">
                    <p className="text-muted-foreground">
                      {signingMode.documentType === 'quote' 
                        ? 'By signing, you approve this quote and authorize the work to proceed.'
                        : signingMode.documentType === 'invoice'
                        ? 'By signing, you acknowledge this invoice and will proceed to payment.'
                        : 'By signing, you confirm that the work has been completed to your satisfaction.'
                      }
                    </p>
                    <Button 
                      size="lg" 
                      className="gap-2"
                      onClick={() => setSignatureDialogOpen(true)}
                    >
                      <PenLine className="w-5 h-5" />
                      Sign {documentTypeLabels[signingMode.documentType]}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </main>

        {/* Signature Dialog for Signing Mode */}
        <SignatureDialog
          open={signatureDialogOpen}
          onOpenChange={setSignatureDialogOpen}
          title={`Sign ${documentTypeLabels[signingMode.documentType]}`}
          description={`Your signature for ${documentTypeLabels[signingMode.documentType]} ${getDocumentNumber()}`}
          signerName={signingDocument?.customer?.name || ''}
          onSignatureComplete={handleSigningComplete}
          isSubmitting={isSubmittingSignature}
        />
      </div>
    );
  }

  // Show welcome view for unassigned customers (not yet linked to a company)
  if (isUnassignedCustomer) {
    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b bg-card">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img 
                src={ZoProLogo} 
                alt="ZoPro"
                className="h-10 w-auto object-contain"
              />
              <div>
                <h1 className="font-semibold">Customer Portal</h1>
                <p className="text-sm text-muted-foreground">Welcome, {customerData?.name}</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </header>

        {/* Welcome Content */}
        <main className="container mx-auto px-4 py-8 max-w-2xl">
          <Card className="text-center">
            <CardHeader>
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <CheckCircle className="w-8 h-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">You're All Set!</CardTitle>
              <CardDescription className="text-base mt-2">
                Your customer account has been created successfully.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-muted/50 rounded-lg p-6 text-left space-y-4">
                <h3 className="font-semibold">What's Next?</h3>
                <ul className="space-y-3 text-sm text-muted-foreground">
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <span>When a service provider adds you as a customer, you'll see their quotes, invoices, and job history here.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <span>You'll receive email notifications when new documents are available for your review.</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <span>You can approve quotes, pay invoices, and sign job completions directly from this portal.</span>
                  </li>
                </ul>
              </div>

              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-4">
                  Your registered email: <span className="font-medium text-foreground">{customerData?.email}</span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Service providers will find you by this email address when they create quotes or invoices for you.
                </p>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // Portal dashboard
  const unpaidInvoices = invoices.filter(i => i.status !== 'paid');
  const pendingQuotes = quotes.filter(q => q.status === 'sent' || q.status === 'pending' || q.status === 'draft');

  // Group unpaid invoices by company for multi-company payment flow
  const unpaidInvoicesByCompany = useMemo(() => {
    const grouped: Record<string, { 
      companyId: string; 
      companyName: string; 
      invoices: Invoice[]; 
      total: number;
      stripeEnabled: boolean;
    }> = {};
    
    unpaidInvoices.forEach(invoice => {
      const companyId = invoice.company_id || customerData?.company?.id || 'default';
      const companyName = invoice.company_name || customerData?.company?.name || 'Unknown Company';
      if (!grouped[companyId]) {
        grouped[companyId] = { 
          companyId, 
          companyName, 
          invoices: [], 
          total: 0,
          stripeEnabled: customerData?.company?.stripe_payments_enabled !== false,
        };
      }
      grouped[companyId].invoices.push(invoice);
      grouped[companyId].total += Number(invoice.total);
    });
    
    return Object.values(grouped);
  }, [unpaidInvoices, customerData?.company]);

  const hasMultipleCompanies = unpaidInvoicesByCompany.length > 1;

  // Handle opening payment selection - checks for multi-company
  const handleOpenPaymentSelection = () => {
    if (unpaidInvoices.length === 0) {
      setActiveTab('invoices');
      return;
    }
    
    if (hasMultipleCompanies) {
      // Multi-company: show company selection first
      setPaymentStep('company-select');
      setSelectedCompanyId(null);
      setSelectedInvoiceIds(new Set());
    } else {
      // Single company: go straight to invoice selection
      setPaymentStep('invoice-select');
      setSelectedInvoiceIds(new Set(unpaidInvoices.map(i => i.id)));
    }
    setShowPaymentSelection(true);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {customerData?.company?.logo_url && (
              <img 
                src={customerData?.company?.logo_url} 
                alt={customerData?.company?.name || 'Company'}
                className="h-10 w-auto object-contain"
              />
            )}
            <div>
              <h1 className="font-semibold">{customerData?.company?.name || 'Customer Portal'}</h1>
              <p className="text-sm text-muted-foreground">Customer Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Notification Dropdown */}
            <Popover open={showNotifications} onOpenChange={setShowNotifications}>
              <PopoverTrigger asChild>
                <div className="relative cursor-pointer">
                  <div className="p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                    <Bell className="w-5 h-5 text-muted-foreground" />
                  </div>
                  {notifications.filter(n => !n.is_read).length > 0 && (
                    <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                      {notifications.filter(n => !n.is_read).length > 9 ? '9+' : notifications.filter(n => !n.is_read).length}
                    </span>
                  )}
                </div>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 p-0">
                <div className="flex items-center justify-between px-4 py-3 border-b">
                  <h4 className="font-semibold text-sm">Notifications</h4>
                  {notifications.length > 0 && (
                    <div className="flex items-center gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 text-xs"
                        onClick={handleMarkAllRead}
                      >
                        <CheckCheck className="w-3 h-3 mr-1" />
                        Mark Read
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 text-xs text-destructive hover:text-destructive"
                        onClick={handleClearAllNotifications}
                      >
                        <Trash2 className="w-3 h-3 mr-1" />
                        Clear
                      </Button>
                    </div>
                  )}
                </div>
                <ScrollArea className="max-h-80">
                  {isLoadingNotifications ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground text-sm">
                      <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>No notifications yet</p>
                    </div>
                  ) : (
                    <div className="divide-y">
                      {notifications.map((notification) => (
                        <div 
                          key={notification.id} 
                          className={`px-4 py-3 hover:bg-muted/50 transition-colors ${!notification.is_read ? 'bg-primary/5' : ''}`}
                        >
                          <div className="flex items-start gap-3">
                            <div className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${!notification.is_read ? 'bg-primary' : 'bg-transparent'}`} />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-sm truncate">{notification.title}</p>
                              <p className="text-xs text-muted-foreground line-clamp-2">{notification.message}</p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </PopoverContent>
            </Popover>
            {/* Profile Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  <User className="w-4 h-4" />
                  <span className="hidden sm:inline">{customerData?.name}</span>
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span className="font-medium">{customerData?.name}</span>
                    <span className="text-xs text-muted-foreground">{customerData?.email}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {hasCompanyAccess && (
                  <>
                    <DropdownMenuItem onClick={() => navigate('/dashboard')}>
                      <Building2 className="w-4 h-4 mr-2" />
                      Switch to Company Portal
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign Out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold">Welcome back, {customerData?.name}!</h2>
          <p className="text-muted-foreground">View your quotes, invoices, and service history below.</p>
        </div>

        {/* Stats Cards - Reordered: Pending Quotes, Service Jobs, Total Invoices, Outstanding */}
        <div className="grid gap-4 md:grid-cols-4 mb-8">
          {/* Pending Quotes Card */}
          <Card 
            className="cursor-pointer hover:bg-muted/50 transition-colors group"
            onClick={() => setActiveTab('quotes')}
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <ClipboardList className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{pendingQuotes.length}</p>
                    <p className="text-sm text-muted-foreground">Pending Quotes</p>
                  </div>
                </div>
                <span className="text-xs text-primary group-hover:underline font-medium">View All →</span>
              </div>
            </CardContent>
          </Card>
          
          {/* Service Jobs Card - Moved next to Pending Quotes */}
          <Card 
            className="cursor-pointer hover:bg-muted/50 transition-colors group"
            onClick={() => setActiveTab('jobs')}
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-emerald-500/10 rounded-lg">
                    <Briefcase className="w-6 h-6 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{jobs.length}</p>
                    <p className="text-sm text-muted-foreground">Service Jobs</p>
                  </div>
                </div>
                <span className="text-xs text-emerald-600 group-hover:underline font-medium">View All →</span>
              </div>
            </CardContent>
          </Card>
          
          {/* Total Invoices Card */}
          <Card 
            className="cursor-pointer hover:bg-muted/50 transition-colors group"
            onClick={() => setActiveTab('invoices')}
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <FileText className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{invoices.length}</p>
                    <p className="text-sm text-muted-foreground">Total Invoices</p>
                  </div>
                </div>
                <span className="text-xs text-primary group-hover:underline font-medium">View All →</span>
              </div>
            </CardContent>
          </Card>
          
          {/* Outstanding Card - Opens payment selection */}
          <Card 
            className="cursor-pointer hover:bg-muted/50 transition-colors group"
            onClick={handleOpenPaymentSelection}
          >
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-amber-500/10 rounded-lg">
                    <CreditCard className="w-6 h-6 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      ${unpaidInvoices.reduce((sum, i) => sum + Number(i.total), 0).toFixed(2)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Outstanding
                      {hasMultipleCompanies && (
                        <span className="text-xs ml-1">({unpaidInvoicesByCompany.length} companies)</span>
                      )}
                    </p>
                  </div>
                </div>
                <span className="text-xs text-amber-600 group-hover:underline font-medium">Pay Now →</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs - Reordered: Jobs, Quotes, Invoices, Payment History (removed Payment Methods) */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="flex-wrap h-auto gap-1">
            <TabsTrigger value="jobs" className="flex items-center gap-2">
              Jobs
              {jobs.length > 0 && (
                <Badge variant="secondary" className="ml-1">{jobs.length}</Badge>
              )}
            </TabsTrigger>
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
            <TabsTrigger value="payment-history" className="flex items-center gap-2">
              <Receipt className="w-4 h-4" />
              Payment History
            </TabsTrigger>
          </TabsList>

          {/* Jobs Tab - Now First */}
          <TabsContent value="jobs">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="w-5 h-5" />
                  Your Jobs
                </CardTitle>
                <CardDescription>
                  View your upcoming appointments and completed jobs. Click a job to view details.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {jobs.length > 0 ? (
                  <div className="space-y-3">
                    {jobs.map((job) => (
                      <div
                        key={job.id}
                        className={`border rounded-lg p-4 cursor-pointer hover:bg-muted/50 transition-colors ${
                          job.status === 'scheduled' && job.scheduled_start && new Date(job.scheduled_start) > new Date()
                            ? 'border-blue-300 bg-blue-50/50 dark:bg-blue-950/20'
                            : ''
                        }`}
                        onClick={() => handleViewJob(job)}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="font-medium text-sm">{job.job_number}</span>
                              {getStatusBadge(job.status)}
                              {job.status === 'scheduled' && job.scheduled_start && new Date(job.scheduled_start) > new Date() && (
                                <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">
                                  Upcoming
                                </Badge>
                              )}
                            </div>
                            <h3 className="font-semibold truncate">{job.title}</h3>
                            {job.scheduled_start && (
                              <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                                <Calendar className="w-4 h-4" />
                                <span>{format(new Date(job.scheduled_start), 'EEEE, MMMM d, yyyy')}</span>
                                <span className="mx-1">•</span>
                                <Clock className="w-4 h-4" />
                                <span>{format(new Date(job.scheduled_start), 'h:mm a')}</span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {job.completion_signed_at && (
                              <Badge variant="default" className="bg-emerald-500">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Signed
                              </Badge>
                            )}
                            {isLoadingDetails === job.id ? (
                              <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Briefcase className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No service history yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="quotes">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="w-5 h-5" />
                  Your Quotes
                </CardTitle>
                <CardDescription>
                  Review and approve quotes to proceed with services. Click a quote to view details.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {quotes.length > 0 ? (
                  <div className="space-y-3">
                    {quotes.map((quote) => (
                      <div
                        key={quote.id}
                        className="border rounded-lg p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                        onClick={() => handleViewQuote(quote)}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="font-medium">{quote.quote_number}</span>
                              {getStatusBadge(quote.status)}
                              {quote.signed_at && (
                                <Badge variant="default" className="bg-emerald-500">
                                  <CheckCircle className="w-3 h-3 mr-1" />
                                  Signed
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                              <span>{format(new Date(quote.created_at), 'MMM d, yyyy')}</span>
                              {quote.valid_until && (
                                <>
                                  <span>•</span>
                                  <span>Valid until {format(new Date(quote.valid_until), 'MMM d, yyyy')}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="font-semibold text-lg">${Number(quote.total).toFixed(2)}</span>
                            {isLoadingDetails === quote.id ? (
                              <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
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
                  {customerData?.company?.stripe_payments_enabled !== false 
                    ? 'View and pay your invoices online. Click an invoice to view details.'
                    : 'View your invoices and payment instructions. Click an invoice to view details.'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Show payment instructions when online payments are disabled */}
                {customerData?.company?.stripe_payments_enabled === false && unpaidInvoices.length > 0 && (
                  <div className="p-4 bg-muted/50 rounded-lg border">
                    <div className="flex items-start gap-3">
                      <Banknote className="w-5 h-5 text-primary mt-0.5" />
                      <div className="space-y-2">
                        <h4 className="font-medium">Payment Instructions</h4>
                        <p className="text-sm text-muted-foreground">
                          {customerData?.company?.default_payment_method === 'cash' && 
                            'Please pay in cash upon service completion or at our office.'}
                          {customerData?.company?.default_payment_method === 'check' && 
                            'Please mail a check to the address below.'}
                          {customerData?.company?.default_payment_method === 'bank_transfer' && 
                            'Please arrange a bank transfer. Contact us for account details.'}
                          {(!customerData?.company?.default_payment_method || customerData?.company?.default_payment_method === 'any') && 
                            'Please contact us for payment arrangements. We accept cash, check, or bank transfer.'}
                        </p>
                        {customerData?.company?.address && (
                          <div className="flex items-start gap-2 text-sm text-muted-foreground mt-2">
                            <MapPin className="w-4 h-4 mt-0.5" />
                            <span>
                              {customerData?.company?.name}<br />
                              {customerData?.company?.address}
                              {customerData?.company?.city && `, ${customerData?.company?.city}`}
                              {customerData?.company?.state && `, ${customerData?.company?.state}`}
                              {customerData?.company?.zip && ` ${customerData?.company?.zip}`}
                            </span>
                          </div>
                        )}
                        {customerData?.company?.phone && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Phone className="w-4 h-4" />
                            <span>{customerData?.company?.phone}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                
                {invoices.length > 0 ? (
                  <div className="space-y-3">
                    {invoices.map((invoice) => (
                      <div
                        key={invoice.id}
                        className={`border rounded-lg p-4 cursor-pointer hover:bg-muted/50 transition-colors ${
                          invoice.status === 'overdue' ? 'border-destructive/50 bg-destructive/5' : ''
                        }`}
                        onClick={() => handleViewInvoice(invoice)}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="font-medium">{invoice.invoice_number}</span>
                              {getStatusBadge(invoice.status)}
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                              <span>{format(new Date(invoice.created_at), 'MMM d, yyyy')}</span>
                              {invoice.due_date && (
                                <>
                                  <span>•</span>
                                  <span>Due {format(new Date(invoice.due_date), 'MMM d, yyyy')}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className={`font-semibold text-lg ${invoice.status === 'overdue' ? 'text-destructive' : ''}`}>
                              ${Number(invoice.total).toFixed(2)}
                            </span>
                            {isLoadingDetails === invoice.id ? (
                              <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No invoices yet</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payment-history">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="w-5 h-5" />
                  Payment History
                </CardTitle>
                <CardDescription>
                  View your payment history and download receipts for your records.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingPaymentHistory ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : paymentHistory.length > 0 ? (
                  <div className="space-y-3">
                    {paymentHistory.map((payment) => (
                      <div
                        key={payment.id}
                        className="border rounded-lg p-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="font-medium text-lg">
                                ${Number(payment.amount).toFixed(2)}
                              </span>
                              <Badge variant="default" className="bg-emerald-500">
                                <CheckCircle className="w-3 h-3 mr-1" />
                                Paid
                              </Badge>
                            </div>
                            <div className="space-y-1 text-sm text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <Calendar className="w-4 h-4" />
                                <span>{format(new Date(payment.payment_date), 'MMMM d, yyyy')}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <CreditCard className="w-4 h-4" />
                                <span>{getPaymentMethodLabel(payment.method)}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <FileText className="w-4 h-4" />
                                <span>Invoice: {payment.invoice_number}</span>
                              </div>
                            </div>
                            {payment.notes && (
                              <p className="text-sm text-muted-foreground mt-2 italic">
                                {payment.notes}
                              </p>
                            )}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadReceipt(payment)}
                            disabled={downloadingReceipt === payment.id}
                          >
                            {downloadingReceipt === payment.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <Download className="w-4 h-4 mr-2" />
                                Receipt
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Receipt className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>No payment history yet</p>
                    <p className="text-sm mt-1">Your payment records will appear here</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>

        {/* Multi-Invoice Payment Selection Dialog */}
        <Dialog open={showPaymentSelection} onOpenChange={(open) => {
          if (!open) {
            setPaymentStep('company-select');
            setSelectedCompanyId(null);
            setSelectedInvoiceIds(new Set());
          }
          setShowPaymentSelection(open);
        }}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                {paymentStep === 'company-select' && hasMultipleCompanies
                  ? 'Select Company to Pay'
                  : 'Pay Selected Invoices'
                }
              </DialogTitle>
              <DialogDescription>
                {paymentStep === 'company-select' && hasMultipleCompanies
                  ? `You have outstanding invoices from ${unpaidInvoicesByCompany.length} companies. Select which company's invoices you'd like to pay first.`
                  : 'Select which invoices you want to pay. You can deselect any invoices you don\'t want to pay now.'
                }
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              {/* Step 1: Company Selection (for multi-company) */}
              {paymentStep === 'company-select' && hasMultipleCompanies && (
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2">
                    {unpaidInvoicesByCompany.map((group) => (
                      <div
                        key={group.companyId}
                        onClick={() => {
                          setSelectedCompanyId(group.companyId);
                          setPaymentStep('invoice-select');
                          // Pre-select all invoices for this company
                          setSelectedInvoiceIds(new Set(group.invoices.map(i => i.id)));
                        }}
                        className="flex items-center justify-between p-4 rounded-lg border cursor-pointer hover:bg-primary/5 hover:border-primary/30 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/10 rounded-lg">
                            <Building2 className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{group.companyName}</p>
                            <p className="text-sm text-muted-foreground">
                              {group.invoices.length} invoice{group.invoices.length > 1 ? 's' : ''}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <p className="font-bold">${group.total.toFixed(2)}</p>
                          </div>
                          <ChevronRight className="w-5 h-5 text-muted-foreground" />
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              )}

              {/* Step 2: Invoice Selection */}
              {paymentStep === 'invoice-select' && (
                <>
                  {/* Back button for multi-company */}
                  {hasMultipleCompanies && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => {
                        setPaymentStep('company-select');
                        setSelectedCompanyId(null);
                        setSelectedInvoiceIds(new Set());
                      }}
                      className="mb-2 -mt-2"
                    >
                      <ArrowLeft className="w-4 h-4 mr-1" />
                      Back to companies
                    </Button>
                  )}
                  
                  <ScrollArea className="h-[300px]">
                    <div className="space-y-2">
                      {unpaidInvoices
                        .filter(inv => !selectedCompanyId || (inv.company_id || customerData?.company?.id) === selectedCompanyId)
                        .map((invoice) => (
                          <div
                            key={invoice.id}
                            className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                              selectedInvoiceIds.has(invoice.id) ? 'bg-primary/5 border-primary/30' : 'bg-muted/30'
                            }`}
                          >
                            <Checkbox
                              checked={selectedInvoiceIds.has(invoice.id)}
                              onCheckedChange={(checked) => {
                                const newSelected = new Set(selectedInvoiceIds);
                                if (checked) {
                                  newSelected.add(invoice.id);
                                } else {
                                  newSelected.delete(invoice.id);
                                }
                                setSelectedInvoiceIds(newSelected);
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium">{invoice.invoice_number}</span>
                                  {hasMultipleCompanies && invoice.company_name && (
                                    <Badge variant="outline" className="text-xs">
                                      {invoice.company_name}
                                    </Badge>
                                  )}
                                </div>
                                <span className="font-semibold">${Number(invoice.total).toFixed(2)}</span>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {invoice.due_date ? `Due ${format(new Date(invoice.due_date), 'MMM d, yyyy')}` : 'No due date'}
                              </p>
                            </div>
                          </div>
                        ))}
                    </div>
                  </ScrollArea>
                  
                  <div className="flex items-center justify-between pt-4 border-t">
                    <div>
                      <p className="text-sm text-muted-foreground">Selected Total</p>
                      <p className="text-2xl font-bold">
                        ${unpaidInvoices
                          .filter(i => selectedInvoiceIds.has(i.id))
                          .reduce((sum, i) => sum + Number(i.total), 0)
                          .toFixed(2)}
                      </p>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {selectedInvoiceIds.size} invoice{selectedInvoiceIds.size !== 1 ? 's' : ''} selected
                    </div>
                  </div>
                </>
              )}
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPaymentSelection(false)}>
                Cancel
              </Button>
              {paymentStep === 'invoice-select' && (
                <Button
                  onClick={handlePayMultipleInvoices}
                  disabled={selectedInvoiceIds.size === 0 || isPayingMultiple}
                >
                  {isPayingMultiple ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <CreditCard className="w-4 h-4 mr-2" />
                  )}
                  Proceed to Payment
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>

      {/* Quote Detail Sheet */}
      <Sheet open={!!viewingQuote} onOpenChange={(open) => !open && setViewingQuote(null)}>
        <SheetContent className="w-[95vw] sm:max-w-lg overflow-y-auto rounded-l-lg" side="right">
          <SheetHeader className="mb-4">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5" />
                Quote {viewingQuote?.quote_number}
              </SheetTitle>
              {viewingQuote && getStatusBadge(viewingQuote.status)}
            </div>
            <SheetDescription>
              Created {viewingQuote && format(new Date(viewingQuote.created_at), 'MMMM d, yyyy')}
              {viewingQuote?.valid_until && ` • Valid until ${format(new Date(viewingQuote.valid_until), 'MMMM d, yyyy')}`}
            </SheetDescription>
          </SheetHeader>
          
          {viewingQuote && (
            <div className="space-y-4">
              {/* Line Items */}
              {viewingQuote.items && viewingQuote.items.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewingQuote.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-sm">{item.description}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">${Number(item.unit_price).toFixed(2)}</TableCell>
                          <TableCell className="text-right font-medium">${Number(item.total).toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Totals */}
              <div className="flex justify-end pt-2">
                <div className="w-48 space-y-1">
                  {viewingQuote.subtotal && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>${Number(viewingQuote.subtotal).toFixed(2)}</span>
                    </div>
                  )}
                  {viewingQuote.tax && Number(viewingQuote.tax) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tax</span>
                      <span>${Number(viewingQuote.tax).toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-semibold pt-2 border-t">
                    <span>Total</span>
                    <span>${Number(viewingQuote.total).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {viewingQuote.notes && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm whitespace-pre-wrap">{viewingQuote.notes}</p>
                </div>
              )}

              {/* Signed Status with Signature Image */}
              {viewingQuote.signed_at && (
                <div className="pt-4 border-t space-y-3">
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                    <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-medium">Approved & Signed on {format(new Date(viewingQuote.signed_at), 'MMMM d, yyyy')}</span>
                    </div>
                  </div>
                  {viewingQuote.signature?.signature_data && (
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-sm text-muted-foreground mb-2">Signature</p>
                      <img 
                        src={viewingQuote.signature.signature_data} 
                        alt="Customer Signature" 
                        className="max-h-24 object-contain bg-white rounded border p-2"
                      />
                      <p className="text-xs text-muted-foreground mt-2">
                        Signed by {viewingQuote.signature.signer_name}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <SheetFooter className="pt-4 flex-col gap-2">
                {(viewingQuote.status === 'sent' || viewingQuote.status === 'pending' || viewingQuote.status === 'draft') && (
                  <Button
                    className="w-full"
                    onClick={() => {
                      handleApproveQuote(viewingQuote);
                      setViewingQuote(null);
                    }}
                    disabled={approvingQuote === viewingQuote.id}
                  >
                    {approvingQuote === viewingQuote.id ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <PenLine className="w-4 h-4 mr-2" />
                    )}
                    Sign & Approve Quote
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => handleDownloadQuote(viewingQuote)}
                  disabled={downloadingQuote === viewingQuote.id}
                >
                  {downloadingQuote === viewingQuote.id ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Printer className="w-4 h-4 mr-2" />
                  )}
                  Print / Download Quote
                </Button>
              </SheetFooter>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Invoice Detail Sheet */}
      <Sheet open={!!viewingInvoice} onOpenChange={(open) => !open && setViewingInvoice(null)}>
        <SheetContent className="w-[95vw] sm:max-w-lg overflow-y-auto rounded-l-lg" side="right">
          <SheetHeader className="mb-4">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Invoice {viewingInvoice?.invoice_number}
              </SheetTitle>
              {viewingInvoice && getStatusBadge(viewingInvoice.status)}
            </div>
            <SheetDescription>
              Created {viewingInvoice && format(new Date(viewingInvoice.created_at), 'MMMM d, yyyy')}
              {viewingInvoice?.due_date && ` • Due ${format(new Date(viewingInvoice.due_date), 'MMMM d, yyyy')}`}
            </SheetDescription>
          </SheetHeader>
          
          {viewingInvoice && (
            <div className="space-y-4">
              {/* Line Items */}
              {viewingInvoice.items && viewingInvoice.items.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewingInvoice.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-sm">{item.description}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">${Number(item.unit_price).toFixed(2)}</TableCell>
                          <TableCell className="text-right font-medium">${Number(item.total).toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Totals */}
              <div className="flex justify-end pt-2">
                <div className="w-48 space-y-1">
                  {viewingInvoice.subtotal && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span>${Number(viewingInvoice.subtotal).toFixed(2)}</span>
                    </div>
                  )}
                  {viewingInvoice.tax && Number(viewingInvoice.tax) > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tax</span>
                      <span>${Number(viewingInvoice.tax).toFixed(2)}</span>
                    </div>
                  )}
                  <div className={`flex justify-between text-lg font-semibold pt-2 border-t ${viewingInvoice.status === 'overdue' ? 'text-destructive' : ''}`}>
                    <span>Total</span>
                    <span>${Number(viewingInvoice.total).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {viewingInvoice.notes && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm whitespace-pre-wrap">{viewingInvoice.notes}</p>
                </div>
              )}

              {/* Signed/Paid Status with Signature */}
              {viewingInvoice.status === 'paid' && (
                <div className="pt-4 border-t space-y-3">
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                    <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                      <CheckCircle className="w-5 h-5" />
                      <span className="font-medium">Paid</span>
                    </div>
                  </div>
                  {/* Show signature if available, otherwise show "Paid Online" message */}
                  {viewingInvoice.signature?.signature_data ? (
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-sm text-muted-foreground mb-2">Signature</p>
                      <img 
                        src={viewingInvoice.signature.signature_data} 
                        alt="Customer Signature" 
                        className="max-h-24 object-contain bg-white rounded border p-2"
                      />
                      <p className="text-xs text-muted-foreground mt-2">
                        Signed by {viewingInvoice.signature.signer_name} on {format(new Date(viewingInvoice.signature.signed_at), 'MMMM d, yyyy')}
                      </p>
                    </div>
                  ) : (
                    <div className="bg-emerald-50/50 dark:bg-emerald-900/10 rounded-lg p-3 border border-emerald-200 dark:border-emerald-800">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-800 flex items-center justify-center">
                          <CreditCard className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Paid Online via Stripe</p>
                          <p className="text-xs text-muted-foreground">No signature required for online payments</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              {viewingInvoice.status !== 'paid' && (
                <SheetFooter className="pt-4 flex-col gap-2">
                  {customerData?.company?.stripe_payments_enabled !== false ? (
                    <Button
                      className="w-full"
                      onClick={() => {
                        handlePayInvoice(viewingInvoice);
                        setViewingInvoice(null);
                      }}
                      disabled={payingInvoice === viewingInvoice.id}
                    >
                      {payingInvoice === viewingInvoice.id ? (
                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <PenLine className="w-4 h-4 mr-2" />
                      )}
                      Sign and Pay Now
                    </Button>
                  ) : (
                    <>
                      {/* Sign Invoice Button when Stripe is disabled */}
                      {!viewingInvoice.signed_at && (
                        <Button
                          className="w-full"
                          onClick={() => {
                            handleSignInvoice(viewingInvoice);
                            setViewingInvoice(null);
                          }}
                        >
                          <PenLine className="w-4 h-4 mr-2" />
                          Sign Invoice
                        </Button>
                      )}
                      <div className="p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                        <p className="font-medium text-foreground mb-1">Payment Instructions</p>
                        <p>
                          {customerData?.company?.default_payment_method === 'cash' && 
                            'Please pay in cash upon service completion or at our office.'}
                          {customerData?.company?.default_payment_method === 'check' && 
                            'Please mail a check to our office address.'}
                          {customerData?.company?.default_payment_method === 'bank_transfer' && 
                            'Please arrange a bank transfer. Contact us for account details.'}
                          {(!customerData?.company?.default_payment_method || customerData?.company?.default_payment_method === 'any') && 
                            'Please contact us for payment arrangements.'}
                        </p>
                      </div>
                    </>
                  )}
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => handleDownloadInvoice(viewingInvoice)}
                    disabled={downloadingInvoice === viewingInvoice.id}
                  >
                    {downloadingInvoice === viewingInvoice.id ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <Download className="w-4 h-4 mr-2" />
                    )}
                    Download Invoice
                  </Button>
                </SheetFooter>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Job Detail Sheet */}
      <Sheet open={!!viewingJob} onOpenChange={(open) => !open && setViewingJob(null)}>
        <SheetContent className="w-[95vw] sm:max-w-lg overflow-y-auto rounded-l-lg" side="right">
          <SheetHeader className="mb-4">
            <div className="flex items-center justify-between">
              <SheetTitle className="flex items-center gap-2">
                <Briefcase className="w-5 h-5" />
                Job {viewingJob?.job_number}
              </SheetTitle>
              {viewingJob && getStatusBadge(viewingJob.status)}
            </div>
            <SheetDescription>
              {viewingJob?.title}
            </SheetDescription>
          </SheetHeader>
          
          {viewingJob && (
            <div className="space-y-4">
              {/* Schedule */}
              {viewingJob.scheduled_start && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                    <div>
                      <p className="font-medium text-blue-900 dark:text-blue-100">
                        {format(new Date(viewingJob.scheduled_start), 'EEEE, MMMM d, yyyy')}
                      </p>
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        {format(new Date(viewingJob.scheduled_start), 'h:mm a')}
                        {viewingJob.scheduled_end && ` - ${format(new Date(viewingJob.scheduled_end), 'h:mm a')}`}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Description */}
              {viewingJob.description && (
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Description</p>
                  <p className="text-sm whitespace-pre-wrap">{viewingJob.description}</p>
                </div>
              )}

              {/* Line Items */}
              {viewingJob.items && viewingJob.items.length > 0 && (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Price</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {viewingJob.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-sm">{item.description}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                          <TableCell className="text-right">${Number(item.unit_price).toFixed(2)}</TableCell>
                          <TableCell className="text-right font-medium">${Number(item.total).toFixed(2)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Totals */}
              {viewingJob.total && Number(viewingJob.total) > 0 && (
                <div className="flex justify-end pt-2">
                  <div className="w-48 space-y-1">
                    {viewingJob.subtotal && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal</span>
                        <span>${Number(viewingJob.subtotal).toFixed(2)}</span>
                      </div>
                    )}
                    {viewingJob.tax && Number(viewingJob.tax) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Tax</span>
                        <span>${Number(viewingJob.tax).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-lg font-semibold pt-2 border-t">
                      <span>Total</span>
                      <span>${Number(viewingJob.total).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Actual Times */}
              {(viewingJob.actual_start || viewingJob.actual_end) && (
                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  {viewingJob.actual_start && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Work Started</p>
                      <p className="text-sm font-medium">
                        {format(new Date(viewingJob.actual_start), 'MMM d, yyyy h:mm a')}
                      </p>
                    </div>
                  )}
                  {viewingJob.actual_end && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Work Completed</p>
                      <p className="text-sm font-medium">
                        {format(new Date(viewingJob.actual_end), 'MMM d, yyyy h:mm a')}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Notes */}
              {viewingJob.notes && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-muted-foreground mb-1">Notes</p>
                  <p className="text-sm whitespace-pre-wrap">{viewingJob.notes}</p>
                </div>
              )}

              {/* Signature Status with Signature Image */}
              {viewingJob.completion_signed_at && (
                <div className="pt-4 border-t space-y-3">
                  <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg">
                    <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                      <CheckCircle className="w-5 h-5" />
                      <div>
                        <p className="font-medium">Job Completion Confirmed</p>
                        <p className="text-sm opacity-80">
                          Signed by {viewingJob.completion_signed_by} on {format(new Date(viewingJob.completion_signed_at), 'MMMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                  </div>
                  {viewingJob.signature?.signature_data && (
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-sm text-muted-foreground mb-2">Customer Signature</p>
                      <img 
                        src={viewingJob.signature.signature_data} 
                        alt="Customer Signature" 
                        className="max-h-24 object-contain bg-white rounded border p-2"
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Photos Section - Collapsible with categories */}
              {viewingJob.photos && viewingJob.photos.length > 0 && (() => {
                const beforePhotos = viewingJob.photos.filter(p => p.photo_type === 'before');
                const afterPhotos = viewingJob.photos.filter(p => p.photo_type === 'after');
                const otherPhotos = viewingJob.photos.filter(p => !['before', 'after'].includes(p.photo_type));
                
                return (
                  <div className="pt-4 border-t">
                    <details className="group" open>
                      <summary className="flex items-center justify-between cursor-pointer list-none">
                        <div className="flex items-center gap-2">
                          <Camera className="w-4 h-4 text-muted-foreground" />
                          <p className="text-sm font-medium">Job Photos ({viewingJob.photos.length})</p>
                        </div>
                        <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform group-open:rotate-180" />
                      </summary>
                      <div className="mt-3 space-y-4">
                        {/* Before Photos */}
                        {beforePhotos.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Before</p>
                            <div className="grid grid-cols-3 gap-2">
                              {beforePhotos.map((photo) => (
                                <a 
                                  key={photo.id} 
                                  href={photo.photo_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="group/photo relative aspect-square rounded-lg overflow-hidden border hover:border-primary transition-colors"
                                >
                                  <img 
                                    src={photo.photo_url} 
                                    alt={photo.caption || 'Before photo'} 
                                    className="w-full h-full object-cover"
                                  />
                                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/photo:opacity-100 transition-opacity flex items-center justify-center">
                                    <ExternalLink className="w-4 h-4 text-white" />
                                  </div>
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* After Photos */}
                        {afterPhotos.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">After</p>
                            <div className="grid grid-cols-3 gap-2">
                              {afterPhotos.map((photo) => (
                                <a 
                                  key={photo.id} 
                                  href={photo.photo_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="group/photo relative aspect-square rounded-lg overflow-hidden border hover:border-primary transition-colors"
                                >
                                  <img 
                                    src={photo.photo_url} 
                                    alt={photo.caption || 'After photo'} 
                                    className="w-full h-full object-cover"
                                  />
                                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/photo:opacity-100 transition-opacity flex items-center justify-center">
                                    <ExternalLink className="w-4 h-4 text-white" />
                                  </div>
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Other Photos */}
                        {otherPhotos.length > 0 && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Other</p>
                            <div className="grid grid-cols-3 gap-2">
                              {otherPhotos.map((photo) => (
                                <a 
                                  key={photo.id} 
                                  href={photo.photo_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="group/photo relative aspect-square rounded-lg overflow-hidden border hover:border-primary transition-colors"
                                >
                                  <img 
                                    src={photo.photo_url} 
                                    alt={photo.caption || 'Job photo'} 
                                    className="w-full h-full object-cover"
                                  />
                                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover/photo:opacity-100 transition-opacity flex items-center justify-center">
                                    <ExternalLink className="w-4 h-4 text-white" />
                                  </div>
                                </a>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </details>
                  </div>
                );
              })()}

              {/* Leave Feedback Section - Only show for completed/invoiced jobs */}
              {(viewingJob.status === 'completed' || viewingJob.status === 'invoiced') && !viewingJob.has_feedback && (
                <div className="pt-4 border-t">
                  <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                    <div className="flex items-start gap-3">
                      <MessageSquare className="w-5 h-5 text-primary mt-0.5" />
                      <div className="flex-1">
                        <p className="font-medium text-sm">How was your experience?</p>
                        <p className="text-xs text-muted-foreground mt-1 mb-3">
                          We'd love to hear your feedback about this job
                        </p>
                        <Button
                          size="sm"
                          onClick={() => {
                            setFeedbackMode('create');
                            setFeedbackRating(5);
                            setFeedbackText('');
                            setExistingFeedbackId(null);
                            setFeedbackJob(viewingJob);
                            setShowFeedbackDialog(true);
                            setViewingJob(null);
                          }}
                        >
                          <Star className="w-4 h-4 mr-2" />
                          Leave Feedback
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Feedback Already Submitted - Show existing feedback (only for completed/invoiced jobs) */}
              {(viewingJob.status === 'completed' || viewingJob.status === 'invoiced') && viewingJob.has_feedback && (
                <div className="pt-4 border-t">
                  <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="w-4 h-4 text-primary" />
                        <p className="font-medium text-sm">Your Feedback</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            handleEditFeedback(viewingJob);
                            setViewingJob(null);
                          }}
                        >
                          <Edit2 className="w-3 h-3 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-destructive hover:bg-destructive hover:text-destructive-foreground"
                          onClick={() => {
                            setFeedbackJob(viewingJob);
                            setFeedbackMode('edit');
                            setShowFeedbackDialog(true);
                            setViewingJob(null);
                            // Pre-fetch feedback to get the ID for deletion
                            handleEditFeedback(viewingJob);
                          }}
                        >
                          <Trash2 className="w-3 h-3 mr-1" />
                          Delete
                        </Button>
                      </div>
                    </div>
                    
                    {isLoadingViewingFeedback ? (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Loading feedback...</span>
                      </div>
                    ) : viewingJobFeedback ? (
                      <>
                        {/* Star Rating Display */}
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`w-5 h-5 ${
                                star <= viewingJobFeedback.rating
                                  ? 'fill-yellow-400 text-yellow-400'
                                  : 'text-muted-foreground/30'
                              }`}
                            />
                          ))}
                          <span className="ml-2 text-sm text-muted-foreground">
                            {viewingJobFeedback.rating}/5
                          </span>
                        </div>
                        
                        {/* Feedback Text */}
                        {viewingJobFeedback.feedback_text && (
                          <p className="text-sm text-muted-foreground bg-background/50 p-3 rounded border">
                            "{viewingJobFeedback.feedback_text}"
                          </p>
                        )}
                      </>
                    ) : (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <CheckCircle className="w-4 h-4" />
                        <p className="text-sm">Feedback submitted</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <SheetFooter className="pt-4 flex-col gap-2">
                {viewingJob.status === 'completed' && !viewingJob.completion_signed_at && (
                  <Button
                    className="w-full"
                    onClick={() => {
                      handleSignJobCompletion(viewingJob);
                      setViewingJob(null);
                    }}
                    disabled={signingJob === viewingJob.id}
                  >
                    {signingJob === viewingJob.id ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <PenLine className="w-4 h-4 mr-2" />
                    )}
                    Sign Job Completion
                  </Button>
                )}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => handleDownloadJob(viewingJob)}
                  disabled={downloadingJob === viewingJob.id}
                >
                  {downloadingJob === viewingJob.id ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Printer className="w-4 h-4 mr-2" />
                  )}
                  Print / Download Job Details
                </Button>
              </SheetFooter>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Signature Dialog */}
      <SignatureDialog
        open={signatureDialogOpen}
        onOpenChange={(open) => {
          setSignatureDialogOpen(open);
          if (!open) setSignatureAction(null);
        }}
        title={
          signatureAction?.type === 'quote' ? 'Sign & Approve Quote' :
          signatureAction?.type === 'invoice' ? 'Sign & Pay Invoice' :
          signatureAction?.type === 'invoice-sign-only' ? 'Sign Invoice' :
          'Confirm Job Completion'
        }
        description={
          signatureAction?.type === 'quote' 
            ? `Please sign to approve Quote ${signatureAction?.data?.quote_number} for $${Number(signatureAction?.data?.total || 0).toFixed(2)}`
            : signatureAction?.type === 'invoice'
            ? `Please sign to proceed with payment for Invoice ${signatureAction?.data?.invoice_number}`
            : signatureAction?.type === 'invoice-sign-only'
            ? `Please sign Invoice ${signatureAction?.data?.invoice_number} for $${Number(signatureAction?.data?.total || 0).toFixed(2)}`
            : `Please sign to confirm completion of Job ${signatureAction?.data?.job_number}`
        }
        signerName={customerData?.name || ''}
        onSignatureComplete={handleSignatureComplete}
        isSubmitting={isSubmittingSignature}
      />

      {/* Feedback Dialog */}
      <Dialog open={showFeedbackDialog} onOpenChange={setShowFeedbackDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              How was your experience?
            </DialogTitle>
            <DialogDescription>
              Your feedback helps us improve our service. 
              {feedbackRating <= 3 && (
                <span className="block mt-2 text-amber-600 dark:text-amber-400">
                  Note: Any concerns will be sent directly to management for review. 
                  The technician will not see this feedback.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Star Rating */}
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-3">Rate your experience with Job {feedbackJob?.job_number}</p>
              <div className="flex justify-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setFeedbackRating(star)}
                    className="p-1 transition-transform hover:scale-110 focus:outline-none"
                  >
                    <Star
                      className={`w-8 h-8 ${
                        star <= feedbackRating
                          ? 'fill-yellow-400 text-yellow-400'
                          : 'text-muted-foreground/30'
                      }`}
                    />
                  </button>
                ))}
              </div>
              <p className="text-sm mt-2 font-medium">
                {feedbackRating === 1 && 'Very Poor'}
                {feedbackRating === 2 && 'Poor'}
                {feedbackRating === 3 && 'Average'}
                {feedbackRating === 4 && 'Good'}
                {feedbackRating === 5 && 'Excellent'}
              </p>
            </div>

            {/* Feedback Text */}
            <div className="space-y-2">
              <Label htmlFor="feedback-text">Comments (optional)</Label>
              <Textarea
                id="feedback-text"
                placeholder="Tell us about your experience..."
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                rows={4}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 flex-col sm:flex-row">
            {feedbackMode === 'edit' && (
              <Button
                variant="destructive"
                onClick={handleDeleteFeedback}
                disabled={isDeletingFeedback || isSubmittingFeedback}
                className="w-full sm:w-auto"
              >
                {isDeletingFeedback ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Trash2 className="w-4 h-4 mr-2" />
                )}
                Delete
              </Button>
            )}
            <div className="flex gap-2 w-full sm:w-auto sm:ml-auto">
              <Button
                variant="outline"
                onClick={() => {
                  setShowFeedbackDialog(false);
                  setFeedbackJob(null);
                  setFeedbackRating(5);
                  setFeedbackText('');
                  setFeedbackMode('create');
                  setExistingFeedbackId(null);
                }}
                className="flex-1 sm:flex-none"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmitFeedback}
                disabled={isSubmittingFeedback || isDeletingFeedback}
                className="flex-1 sm:flex-none"
              >
                {isSubmittingFeedback ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Star className="w-4 h-4 mr-2" />
                )}
                {feedbackMode === 'edit' ? 'Update' : 'Submit'}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CustomerPortal;
