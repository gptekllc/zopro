import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useJobs, useCreateJob, useUpdateJob, useDeleteJob, useUploadJobPhoto, useDeleteJobPhoto, useConvertJobToInvoice, useConvertJobToQuote, useArchiveJob, useUnarchiveJob, useJobRelatedQuotes, Job, JobItem } from '@/hooks/useJobs';
import { useCustomers } from '@/hooks/useCustomers';
import { useQuotes, Quote } from '@/hooks/useQuotes';
import { useProfiles } from '@/hooks/useProfiles';
import { useAuth } from '@/hooks/useAuth';
import { useDownloadDocument, useEmailDocument } from '@/hooks/useDocumentActions';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Plus, Search, Briefcase, Trash2, Edit, Loader2, Camera, Upload, User, Calendar, ChevronRight, FileText, X, Image, List, CalendarDays, Receipt, CheckCircle2, Clock, Archive, ArchiveRestore, Eye, EyeOff, MoreVertical, DollarSign, ArrowDown, ArrowUp, Users } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { toast } from 'sonner';
import JobCalendar from '@/components/jobs/JobCalendar';
import SchedulerView from '@/components/jobs/SchedulerView';
import { CompleteJobDialog } from '@/components/jobs/CompleteJobDialog';
import { JobTimeTracker } from '@/components/jobs/JobTimeTracker';
import { InlineCustomerForm } from '@/components/customers/InlineCustomerForm';
import { QuoteDetailDialog } from '@/components/quotes/QuoteDetailDialog';
import { QuoteCard } from '@/components/quotes/QuoteCard';
import { PhotoGallery } from '@/components/photos/PhotoGallery';

const JOB_STATUSES = ['draft', 'scheduled', 'in_progress', 'completed', 'invoiced', 'paid'] as const;
const JOB_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

const Jobs = () => {
  const { profile, roles } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [showArchived, setShowArchived] = useState(false);
  const [includeArchivedInSearch, setIncludeArchivedInSearch] = useState(false);
  
  // Determine if we need to include archived jobs based on search + toggle
  const needsArchivedData = showArchived || includeArchivedInSearch;
  const { data: jobs = [], isLoading } = useJobs(needsArchivedData);

  // Defensive: some backends/joins can yield null rows; never let that crash rendering.
  const safeJobs = useMemo(() => (jobs ?? []).filter(Boolean) as Job[], [jobs]);

  useEffect(() => {
    // Debug: help catch any null jobs coming from the backend/cache
    // eslint-disable-next-line no-console
    console.log('[Jobs] raw jobs:', jobs);
    // eslint-disable-next-line no-console
    console.log('[Jobs] safeJobs.length:', safeJobs.length);
  }, [jobs, safeJobs.length]);

  const { data: customers = [] } = useCustomers();
  const { data: quotes = [] } = useQuotes();
  const { data: profiles = [] } = useProfiles();

  const safeCustomers = useMemo(
    () => (Array.isArray(customers) ? customers : []).filter((c: any) => c && c.id) as any[],
    [customers]
  );
  const safeQuotes = useMemo(
    () => (Array.isArray(quotes) ? quotes : []).filter((q: any) => q && q.id) as any[],
    [quotes]
  );
  const safeProfiles = useMemo(
    () => (Array.isArray(profiles) ? profiles : []).filter((p: any) => p && p.id) as any[],
    [profiles]
  );

  const createJob = useCreateJob();
  const updateJob = useUpdateJob();
  const deleteJob = useDeleteJob();
  const uploadPhoto = useUploadJobPhoto();
  const deletePhoto = useDeleteJobPhoto();
  const convertToInvoice = useConvertJobToInvoice();
  const convertToQuote = useConvertJobToQuote();
  const archiveJob = useArchiveJob();
  const unarchiveJob = useUnarchiveJob();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [viewingJob, setViewingJob] = useState<Job | null>(null);
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [photoType, setPhotoType] = useState<'before' | 'after' | 'other'>('before');
  const [photoCaption, setPhotoCaption] = useState('');
  const [viewMode, setViewMode] = useState<'list' | 'calendar' | 'scheduler'>('list');
  const [importQuoteId, setImportQuoteId] = useState<string>('');
  const [completingJob, setCompletingJob] = useState<Job | null>(null);
  const [viewingQuote, setViewingQuote] = useState<Quote | null>(null);
  
  const downloadDocument = useDownloadDocument();
  const emailDocument = useEmailDocument();
  const isAdmin = roles.some(r => r.role === 'admin' || r.role === 'manager');
  const technicians = safeProfiles.filter(p => p.role === 'technician' || p.role === 'admin' || p.role === 'manager');

  // Handle URL param to auto-open job detail
  useEffect(() => {
    const viewJobId = searchParams.get('view');
    if (viewJobId && safeJobs.length > 0) {
      const job = safeJobs.find(j => j.id === viewJobId);
      if (job) {
        setViewingJob(job);
        // Clear the URL param after opening
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('view');
        setSearchParams(newParams, { replace: true });
      }
    }
  }, [searchParams, safeJobs, setSearchParams]);

  const [formData, setFormData] = useState({
    customer_id: '',
    quote_id: '' as string | null,
    assigned_to: '' as string | null,
    title: '',
    description: '',
    priority: 'medium' as Job['priority'],
    status: 'draft' as Job['status'],
    scheduled_start: '',
    scheduled_end: '',
    notes: '',
    estimated_duration: 60,
  });

  // Line items state
  const [lineItems, setLineItems] = useState<LineItem[]>([]);

  const addLineItem = () => {
    setLineItems([...lineItems, { id: crypto.randomUUID(), description: '', quantity: 1, unitPrice: 0 }]);
  };

  const removeLineItem = (id: string) => {
    setLineItems(lineItems.filter(item => item.id !== id));
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: string | number) => {
    setLineItems(lineItems.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const calculateSubtotal = () => {
    return lineItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  };

  const calculateTax = () => {
    return calculateSubtotal() * 0.0825;
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTax();
  };

  // Separate active and archived jobs for display
  const activeJobs = useMemo(() => safeJobs.filter(j => !j.archived_at), [safeJobs]);
  const archivedJobs = useMemo(() => safeJobs.filter(j => j.archived_at), [safeJobs]);
  // Check if job is older than 2 years and eligible for archive suggestion
  const isArchiveEligible = (job: Job) => {
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    return new Date(job.created_at) < twoYearsAgo && 
           (job.status === 'paid' || job.status === 'completed') &&
           !job.archived_at;
  };

  const filteredJobs = useMemo(() => {
    return safeJobs.filter((job: any) => {
      if (!job) return false;
      const matchesSearch = String(job.title ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(job.job_number ?? '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        String(job.customer?.name ?? '').toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || job.status === statusFilter;

      // When searching with includeArchivedInSearch, include archived jobs
      // Otherwise, respect showArchived toggle
      let matchesArchiveFilter = true;
      if (searchQuery && includeArchivedInSearch) {
        // Include all jobs (archived and active) when searching with toggle on
        matchesArchiveFilter = true;
      } else if (!showArchived) {
        // Hide archived jobs when not showing archived
        matchesArchiveFilter = !job.archived_at;
      }

      return matchesSearch && matchesStatus && matchesArchiveFilter;
    });
  }, [safeJobs, searchQuery, statusFilter, showArchived, includeArchivedInSearch]);

  const resetForm = () => {
    setFormData({
      customer_id: '',
      quote_id: null,
      assigned_to: null,
      title: '',
      description: '',
      priority: 'medium',
      status: 'draft',
      scheduled_start: '',
      scheduled_end: '',
      notes: '',
      estimated_duration: 60,
    });
    setLineItems([]);
    setEditingJob(null);
    setImportQuoteId('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.customer_id || !formData.title) {
      toast.error('Please fill in required fields');
      return;
    }

    const jobData = {
      customer_id: formData.customer_id,
      quote_id: formData.quote_id || null,
      assigned_to: formData.assigned_to || null,
      title: formData.title,
      description: formData.description || null,
      priority: formData.priority,
      status: formData.status,
      scheduled_start: formData.scheduled_start || null,
      scheduled_end: formData.scheduled_end || null,
      notes: formData.notes || null,
      estimated_duration: formData.estimated_duration || 60,
      items: lineItems.map(item => ({
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unitPrice,
      })),
    };

    try {
      if (editingJob) {
        await updateJob.mutateAsync({ id: editingJob.id, ...jobData });
        // Update viewingJob immediately if it was the edited job
        if (viewingJob?.id === editingJob.id) {
          const customerName = safeCustomers.find(c => c.id === formData.customer_id)?.name || '';
          const assigneeName = technicians.find(t => t.id === formData.assigned_to)?.full_name || null;
          setViewingJob(prev => prev ? {
            ...prev,
            ...jobData,
            customer: prev.customer ? { ...prev.customer, name: customerName } : { name: customerName, email: null, phone: null, address: null, city: null, state: null, zip: null },
            assignee: { full_name: assigneeName },
            items: lineItems.map((item, idx) => ({
              id: item.id || `temp-${idx}`,
              job_id: prev.id,
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unitPrice,
              total: item.quantity * item.unitPrice,
              created_at: new Date().toISOString(),
            })),
          } : null);
        }
      } else {
        await createJob.mutateAsync(jobData);
      }
      setIsDialogOpen(false);
      resetForm();
    } catch (error) {
      // Error handled by hook
    }
  };

  const handleEdit = (job: Job) => {
    setFormData({
      customer_id: job.customer_id,
      quote_id: job.quote_id,
      assigned_to: job.assigned_to,
      title: job.title,
      description: job.description || '',
      priority: job.priority,
      status: job.status,
      scheduled_start: job.scheduled_start ? format(new Date(job.scheduled_start), "yyyy-MM-dd'T'HH:mm") : '',
      scheduled_end: job.scheduled_end ? format(new Date(job.scheduled_end), "yyyy-MM-dd'T'HH:mm") : '',
      notes: job.notes || '',
      estimated_duration: job.estimated_duration ?? 60,
    });
    // Load existing line items
    if (job.items && job.items.length > 0) {
      setLineItems(job.items.map(item => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unit_price,
      })));
    } else {
      setLineItems([]);
    }
    setEditingJob(job);
    setIsDialogOpen(true);
  };

  const handleDelete = async (jobId: string) => {
    await deleteJob.mutateAsync(jobId);
  };

  const handleImportQuote = () => {
    if (!importQuoteId) return;
    const quote: any = safeQuotes.find((q: any) => q?.id === importQuoteId);
    if (quote?.customer_id) {
      setFormData({
        ...formData,
        customer_id: quote.customer_id,
        quote_id: quote.id,
        title: `Job from Quote ${quote.quote_number}`,
        description: quote.notes || '',
      });
      // Import quote items as line items
      if (quote.items && quote.items.length > 0) {
        setLineItems(quote.items.map((item: any) => ({
          id: crypto.randomUUID(),
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unit_price,
        })));
      }
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !viewingJob) return;

    const file = e.target.files[0];
    const result = await uploadPhoto.mutateAsync({
      jobId: viewingJob.id,
      file,
      photoType,
      caption: photoCaption,
    });
    setPhotoDialogOpen(false);
    setPhotoCaption('');
    // Update viewingJob with new photo immediately
    if (result) {
      setViewingJob(prev => prev ? {
        ...prev,
        photos: [...(prev.photos || []), result]
      } : null);
    }
  };

  const handleStatusChange = async (jobId: string, newStatus: Job['status']) => {
    const updates: Partial<Job> = { status: newStatus };
    if (newStatus === 'in_progress' && !safeJobs.find(j => j.id === jobId)?.actual_start) {
      updates.actual_start = new Date().toISOString();
    }
    if (newStatus === 'completed') {
      updates.actual_end = new Date().toISOString();
    }
    await updateJob.mutateAsync({ id: jobId, ...updates });
  };

  const getStatusColor = (status: Job['status']) => {
    switch (status) {
      case 'draft': return 'bg-muted text-muted-foreground';
      case 'scheduled': return 'bg-blue-500/10 text-blue-500';
      case 'in_progress': return 'bg-warning/10 text-warning';
      case 'completed': return 'bg-success/10 text-success';
      case 'invoiced': return 'bg-primary/10 text-primary';
      case 'paid': return 'bg-success/10 text-success';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getPriorityColor = (priority: Job['priority']) => {
    switch (priority) {
      case 'low': return 'bg-muted text-muted-foreground';
      case 'medium': return 'bg-blue-500/10 text-blue-500';
      case 'high': return 'bg-warning/10 text-warning';
      case 'urgent': return 'bg-destructive/10 text-destructive';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getNextStatus = (currentStatus: Job['status']): Job['status'] | null => {
    const index = JOB_STATUSES.indexOf(currentStatus);
    if (index < JOB_STATUSES.length - 1) {
      return JOB_STATUSES[index + 1];
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Jobs</h1>
          <p className="text-muted-foreground mt-1">{safeJobs.length} total jobs</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Create Job
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[100dvh] sm:max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingJob ? 'Edit Job' : 'Create New Job'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Import from Quote */}
              {!editingJob && (
                <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                  <div className="flex-1 space-y-2">
                    <Label>Import from Quote (optional)</Label>
                    <Select value={importQuoteId} onValueChange={setImportQuoteId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a quote" />
                      </SelectTrigger>
                      <SelectContent>
                        {safeQuotes
                          .filter((q: any) => (q?.status === 'accepted' || q?.status === 'sent') && q?.id)
                          .map((q: any) => (
                            <SelectItem key={q.id} value={q.id}>
                              {String(q.quote_number ?? 'Quote')} - {safeCustomers.find((c: any) => c?.id === q?.customer_id)?.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="button" variant="outline" onClick={handleImportQuote} disabled={!importQuoteId} className="w-full sm:w-auto">
                    <FileText className="w-4 h-4 mr-2" />
                    Import
                  </Button>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InlineCustomerForm
                  customers={safeCustomers}
                  selectedCustomerId={formData.customer_id}
                  onCustomerSelect={(value) => setFormData({ ...formData, customer_id: value })}
                />
                
                <div className="space-y-2">
                  <Label>Assign To</Label>
                  <Select
                    value={formData.assigned_to || 'unassigned'}
                    onValueChange={(value) => setFormData({ ...formData, assigned_to: value === 'unassigned' ? null : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select technician" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {technicians.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.full_name || t.email}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Title *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Job title"
                />
              </div>

              <div className="space-y-2">
                <Label>Problem Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                  placeholder="Describe the issue..."
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(value) => setFormData({ ...formData, priority: value as Job['priority'] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {JOB_PRIORITIES.map((p) => (
                        <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(value) => setFormData({ ...formData, status: value as Job['status'] })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {JOB_STATUSES.map((s) => (
                        <SelectItem key={s} value={s} className="capitalize">{s.replace('_', ' ')}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Est. Duration</Label>
                  <Select
                    value={String(formData.estimated_duration)}
                    onValueChange={(value) => setFormData({ ...formData, estimated_duration: parseInt(value) })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="30">30 min</SelectItem>
                      <SelectItem value="60">1 hour</SelectItem>
                      <SelectItem value="90">1.5 hours</SelectItem>
                      <SelectItem value="120">2 hours</SelectItem>
                      <SelectItem value="180">3 hours</SelectItem>
                      <SelectItem value="240">4 hours</SelectItem>
                      <SelectItem value="300">5 hours</SelectItem>
                      <SelectItem value="360">6 hours</SelectItem>
                      <SelectItem value="480">8 hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Scheduled Start</Label>
                  <Input
                    type="datetime-local"
                    value={formData.scheduled_start}
                    onChange={(e) => setFormData({ ...formData, scheduled_start: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Scheduled End</Label>
                  <Input
                    type="datetime-local"
                    value={formData.scheduled_end}
                    onChange={(e) => setFormData({ ...formData, scheduled_end: e.target.value })}
                  />
                </div>
              </div>

              {/* Line Items Section */}
              <Separator />
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Line Items (Parts & Labor)</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                    <Plus className="w-4 h-4 mr-1" />
                    <span className="hidden sm:inline">Add Item</span>
                    <span className="sm:hidden">Add</span>
                  </Button>
                </div>

                {lineItems.length > 0 ? (
                  <div className="space-y-3">
                    {lineItems.map((item, index) => (
                      <div key={item.id} className="space-y-2 sm:space-y-0">
                        {/* Mobile layout */}
                        <div className="sm:hidden space-y-2 p-3 bg-muted/50 rounded-lg">
                          <Input
                            placeholder="Description"
                            value={item.description}
                            onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                          />
                          <div className="flex gap-2">
                            <div className="w-20">
                              <Label className="text-xs text-muted-foreground">Qty</Label>
                              <Input
                                type="number"
                                min="1"
                                value={item.quantity}
                                onChange={(e) => updateLineItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                              />
                            </div>
                            <div className="flex-1">
                              <Label className="text-xs text-muted-foreground">Unit Price</Label>
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={item.unitPrice}
                                onChange={(e) => updateLineItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                              />
                            </div>
                            <div className="flex items-end">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => removeLineItem(item.id)}
                                className="text-destructive"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                          <div className="flex justify-end text-sm font-medium">
                            Total: ${(item.quantity * item.unitPrice).toFixed(2)}
                          </div>
                        </div>
                        {/* Desktop layout */}
                        <div className="hidden sm:grid grid-cols-12 gap-2 items-start">
                          <div className="col-span-5">
                            <Input
                              placeholder="Description"
                              value={item.description}
                              onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                            />
                          </div>
                          <div className="col-span-2">
                            <Input
                              type="number"
                              min="1"
                              placeholder="Qty"
                              value={item.quantity}
                              onChange={(e) => updateLineItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                            />
                          </div>
                          <div className="col-span-3">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              placeholder="Unit Price"
                              value={item.unitPrice}
                              onChange={(e) => updateLineItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                            />
                          </div>
                          <div className="col-span-1 text-right pt-2 text-sm font-medium">
                            ${(item.quantity * item.unitPrice).toFixed(2)}
                          </div>
                          <div className="col-span-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => removeLineItem(item.id)}
                              className="text-destructive"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* Totals */}
                    <div className="border-t pt-3 space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Subtotal:</span>
                        <span>${calculateSubtotal().toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Tax (8.25%):</span>
                        <span>${calculateTax().toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-semibold">
                        <span>Total:</span>
                        <span>${calculateTotal().toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No line items added. Click "Add Item" to add parts or labor.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                />
              </div>
              
              <div className="flex flex-col-reverse sm:flex-row gap-3 pt-4">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1" disabled={createJob.isPending || updateJob.isPending}>
                  {(createJob.isPending || updateJob.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editingJob ? 'Update' : 'Create'} Job
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search jobs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              {JOB_STATUSES.map((s) => (
                <SelectItem key={s} value={s} className="capitalize">{s.replace('_', ' ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant={showArchived ? 'secondary' : 'outline'}
            size="sm"
            onClick={() => setShowArchived(!showArchived)}
            className="gap-2 whitespace-nowrap"
          >
            {showArchived ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            <span className="hidden sm:inline">{showArchived ? 'Hide Archived' : 'Show Archived'}</span>
            <span className="sm:hidden">{showArchived ? 'Hide' : 'Archived'}</span>
          </Button>
          <div className="flex gap-1 border rounded-md p-1">
            <Button
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
              title="List View"
            >
              <List className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'calendar' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('calendar')}
              title="Calendar View"
            >
              <CalendarDays className="w-4 h-4" />
            </Button>
            {isAdmin && (
              <Button
                variant={viewMode === 'scheduler' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('scheduler')}
                title="Scheduler View"
              >
                <Users className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
        
        {/* Include archived in search toggle - shows when searching */}
        {searchQuery && (
          <div className="flex items-center gap-2">
            <Checkbox
              id="include-archived"
              checked={includeArchivedInSearch}
              onCheckedChange={(checked) => setIncludeArchivedInSearch(checked === true)}
            />
            <label
              htmlFor="include-archived"
              className="text-sm text-muted-foreground cursor-pointer"
            >
              Include archived jobs in search
            </label>
          </div>
        )}
      </div>

      {/* Calendar View */}
      {viewMode === 'calendar' && (
        <JobCalendar jobs={safeJobs} onJobClick={setViewingJob} />
      )}

      {/* Scheduler View - Admin/Manager only */}
      {viewMode === 'scheduler' && isAdmin && (
        <SchedulerView 
          jobs={safeJobs} 
          technicians={technicians} 
          onJobClick={setViewingJob} 
        />
      )}

      {/* Job List - Mobile Optimized */}
      {viewMode === 'list' && (
        <div className="space-y-3">
          {filteredJobs.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No jobs found
              </CardContent>
            </Card>
          ) : (
            filteredJobs.map((job) => (
              <Card 
                key={job.id} 
                className={`overflow-hidden hover:shadow-md transition-shadow cursor-pointer ${job.archived_at ? 'opacity-60 border-dashed' : ''}`} 
                onClick={() => setViewingJob(job)}
              >
                <CardContent className="p-4 sm:p-5">
                  {/* Mobile Layout */}
                  <div className="flex flex-col gap-3 sm:hidden">
                    {/* Row 1: Job number + badges */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">{job.job_number}</span>
                        {job.archived_at && (
                          <Badge variant="outline" className="text-muted-foreground text-xs">Archived</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        <Badge className={`${getStatusColor(job.status)} text-xs`} variant="outline">
                          {job.status.replace('_', ' ')}
                        </Badge>
                        <Badge className={`${getPriorityColor(job.priority)} text-xs`} variant="outline">
                          {job.priority}
                        </Badge>
                      </div>
                    </div>
                    
                    {/* Row 2: Title + Total */}
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm line-clamp-1 flex-1">{job.title}</p>
                      {(job.total ?? 0) > 0 && (
                        <span className="text-sm font-medium text-primary ml-2">${Number(job.total).toFixed(2)}</span>
                      )}
                    </div>
                    
                    {/* Row 3: Customer + date */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span className="truncate max-w-[50%]">{job.customer?.name}</span>
                      {job.scheduled_start && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {format(new Date(job.scheduled_start), 'MMM d')}
                        </span>
                      )}
                    </div>
                    
                    {/* Row 4: Actions */}
                    <div className="flex items-center justify-end gap-1 pt-1 border-t" onClick={(e) => e.stopPropagation()}>
                      {job.archived_at ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => unarchiveJob.mutate(job.id)}
                          disabled={unarchiveJob.isPending}
                          className="text-xs h-8"
                        >
                          <ArchiveRestore className="w-3 h-3 mr-1" />
                          Unarchive
                        </Button>
                      ) : (
                        <>
                          {job.status === 'in_progress' && (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => setCompletingJob(job)}
                              className="text-xs h-8"
                            >
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              Complete
                            </Button>
                          )}
                          {job.status === 'completed' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => convertToInvoice.mutate(job)}
                              disabled={convertToInvoice.isPending}
                              className="text-xs h-8"
                            >
                              <Receipt className="w-3 h-3 mr-1" />
                              Invoice
                            </Button>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEdit(job)}>
                                <Edit className="w-4 h-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              {!job.quote_id && (
                                <DropdownMenuItem onClick={() => convertToQuote.mutate(job)}>
                                  <FileText className="w-4 h-4 mr-2" />
                                  Create Quote
                                </DropdownMenuItem>
                              )}
                              {getNextStatus(job.status) && job.status !== 'completed' && job.status !== 'in_progress' && (
                                <DropdownMenuItem onClick={() => handleStatusChange(job.id, getNextStatus(job.status)!)}>
                                  <ChevronRight className="w-4 h-4 mr-2" />
                                  {getNextStatus(job.status)?.replace('_', ' ')}
                                </DropdownMenuItem>
                              )}
                              {(job.status === 'paid' || job.status === 'completed' || job.status === 'invoiced') && (
                                <DropdownMenuItem onClick={() => archiveJob.mutate(job.id)}>
                                  <Archive className="w-4 h-4 mr-2" />
                                  Archive
                                </DropdownMenuItem>
                              )}
                              {isAdmin && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onClick={() => handleDelete(job.id)}
                                    className="text-destructive"
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Desktop Layout */}
                  <div className="hidden sm:flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${job.archived_at ? 'bg-muted' : 'bg-primary/10'}`}>
                        {job.archived_at ? (
                          <Archive className="w-6 h-6 text-muted-foreground" />
                        ) : (
                          <Briefcase className="w-6 h-6 text-primary" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{job.job_number}</h3>
                          {job.archived_at && (
                            <Badge variant="outline" className="text-muted-foreground">Archived</Badge>
                          )}
                          <Badge className={getStatusColor(job.status)} variant="outline">
                            {job.status.replace('_', ' ')}
                          </Badge>
                          <Badge className={getPriorityColor(job.priority)} variant="outline">
                            {job.priority}
                          </Badge>
                          {(job.total ?? 0) > 0 && (
                            <Badge variant="secondary" className="gap-1">
                              <DollarSign className="w-3 h-3" />
                              {Number(job.total).toFixed(2)}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm font-medium">{job.title}</p>
                        <p className="text-sm text-muted-foreground">{job.customer?.name}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        {job.assignee?.full_name && (
                          <p className="text-sm flex items-center gap-1">
                            <User className="w-4 h-4" />
                            {job.assignee.full_name}
                          </p>
                        )}
                        {job.scheduled_start && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(job.scheduled_start), 'MMM d, h:mm a')}
                          </p>
                        )}
                        {job.photos && job.photos.length > 0 && (
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Image className="w-3 h-3" />
                            {job.photos.length} photos
                          </p>
                        )}
                      </div>
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        {job.archived_at ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => unarchiveJob.mutate(job.id)}
                            disabled={unarchiveJob.isPending}
                          >
                            <ArchiveRestore className="w-4 h-4 mr-1" />
                            Unarchive
                          </Button>
                        ) : (
                          <>
                            {job.status === 'in_progress' && (
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => setCompletingJob(job)}
                              >
                                <CheckCircle2 className="w-4 h-4 mr-1" />
                                Complete
                              </Button>
                            )}
                            {job.status === 'completed' && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => convertToInvoice.mutate(job)}
                                disabled={convertToInvoice.isPending}
                              >
                                <Receipt className="w-4 h-4 mr-1" />
                                Invoice
                              </Button>
                            )}
                            {getNextStatus(job.status) && job.status !== 'completed' && job.status !== 'in_progress' && (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleStatusChange(job.id, getNextStatus(job.status)!)}
                              >
                                <ChevronRight className="w-4 h-4 mr-1" />
                                {getNextStatus(job.status)?.replace('_', ' ')}
                              </Button>
                            )}
                            {job.status === 'completed' && (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => handleStatusChange(job.id, 'invoiced')}
                              >
                                <ChevronRight className="w-4 h-4 mr-1" />
                                invoiced
                              </Button>
                            )}
                            {!job.quote_id && (
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => convertToQuote.mutate(job)}
                                disabled={convertToQuote.isPending}
                              >
                                <FileText className="w-4 h-4 mr-1" />
                                Quote
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(job)}>
                              <Edit className="w-4 h-4" />
                            </Button>
                            {isAdmin && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="text-destructive">
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Job?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This will permanently delete {job.job_number}. This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(job.id)}>Delete</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                            {(job.status === 'paid' || job.status === 'completed' || job.status === 'invoiced') && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => archiveJob.mutate(job.id)}
                                disabled={archiveJob.isPending}
                                title="Archive job"
                              >
                                <Archive className="w-4 h-4" />
                              </Button>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}

      {/* Job Detail Modal */}
      <Dialog open={!!viewingJob} onOpenChange={(open) => !open && setViewingJob(null)}>
        <DialogContent className="max-w-4xl max-h-[100dvh] sm:max-h-[90vh] overflow-y-auto">
          {viewingJob && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 pr-8 text-base sm:text-lg">
                  <Briefcase className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                  <span className="truncate">{viewingJob.job_number} - {viewingJob.title}</span>
                </DialogTitle>
              </DialogHeader>
              
              <Tabs defaultValue="details" className="mt-2 sm:mt-4">
                <TabsList className="flex-wrap h-auto gap-1 p-1">
                  <TabsTrigger value="details" className="text-xs sm:text-sm px-2 sm:px-3">Details</TabsTrigger>
                  <TabsTrigger value="quotes" className="text-xs sm:text-sm px-2 sm:px-3">Quotes</TabsTrigger>
                  <TabsTrigger value="photos" className="text-xs sm:text-sm px-2 sm:px-3">Photos ({viewingJob.photos?.length || 0})</TabsTrigger>
                  <TabsTrigger value="time" className="text-xs sm:text-sm px-2 sm:px-3">Time</TabsTrigger>
                </TabsList>
                
                <TabsContent value="details" className="space-y-6 mt-4">
                  {/* Basic Info */}
                  <div className="grid grid-cols-2 gap-3 sm:gap-4">
                    <div>
                      <Label className="text-muted-foreground text-xs sm:text-sm">Customer</Label>
                      <p className="font-medium text-sm sm:text-base truncate">{viewingJob.customer?.name}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs sm:text-sm">Status</Label>
                      <Badge className={`${getStatusColor(viewingJob.status)} text-xs`}>{viewingJob.status}</Badge>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs sm:text-sm">Priority</Label>
                      <Badge className={`${getPriorityColor(viewingJob.priority)} text-xs`}>{viewingJob.priority}</Badge>
                    </div>
                    {viewingJob.assignee?.full_name && (
                      <div>
                        <Label className="text-muted-foreground text-xs sm:text-sm">Assigned To</Label>
                        <p className="font-medium text-sm sm:text-base truncate">{viewingJob.assignee.full_name}</p>
                      </div>
                    )}
                    {viewingJob.scheduled_start && (
                      <div className="col-span-2 sm:col-span-1">
                        <Label className="text-muted-foreground text-xs sm:text-sm">Scheduled Start</Label>
                        <p className="font-medium text-sm sm:text-base">{format(new Date(viewingJob.scheduled_start), 'MMM d, yyyy h:mm a')}</p>
                      </div>
                    )}
                    {viewingJob.scheduled_end && (
                      <div className="col-span-2 sm:col-span-1">
                        <Label className="text-muted-foreground text-xs sm:text-sm">Scheduled End</Label>
                        <p className="font-medium text-sm sm:text-base">{format(new Date(viewingJob.scheduled_end), 'MMM d, yyyy h:mm a')}</p>
                      </div>
                    )}
                  </div>
                  
                  {viewingJob.description && (
                    <div>
                      <Label className="text-muted-foreground text-xs sm:text-sm">Description</Label>
                      <p className="mt-1 text-sm">{viewingJob.description}</p>
                    </div>
                  )}

                  {/* Line Items Section */}
                  <div className="space-y-3">
                    <Label className="text-muted-foreground text-xs sm:text-sm font-medium">Line Items</Label>
                    {viewingJob.items && viewingJob.items.length > 0 ? (
                      <>
                        <div className="rounded-lg border">
                          {/* Desktop header - hidden on mobile */}
                          <div className="hidden sm:grid grid-cols-12 gap-2 p-3 bg-muted/50 font-medium text-sm">
                            <div className="col-span-6">Description</div>
                            <div className="col-span-2 text-center">Qty</div>
                            <div className="col-span-2 text-right">Unit Price</div>
                            <div className="col-span-2 text-right">Total</div>
                          </div>
                          {viewingJob.items.map((item) => (
                            <div key={item.id} className="p-3 border-t text-sm">
                              {/* Mobile layout */}
                              <div className="sm:hidden space-y-1">
                                <p className="font-medium">{item.description}</p>
                                <div className="flex justify-between text-xs text-muted-foreground">
                                  <span>{item.quantity} × ${Number(item.unit_price).toFixed(2)}</span>
                                  <span className="font-medium text-foreground">${Number(item.total).toFixed(2)}</span>
                                </div>
                              </div>
                              {/* Desktop layout */}
                              <div className="hidden sm:grid grid-cols-12 gap-2">
                                <div className="col-span-6">{item.description}</div>
                                <div className="col-span-2 text-center">{item.quantity}</div>
                                <div className="col-span-2 text-right">${Number(item.unit_price).toFixed(2)}</div>
                                <div className="col-span-2 text-right">${Number(item.total).toFixed(2)}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="flex flex-col items-end gap-1 text-sm">
                          <div className="flex justify-between w-full sm:w-48">
                            <span className="text-muted-foreground">Subtotal:</span>
                            <span>${Number(viewingJob.subtotal ?? 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between w-full sm:w-48">
                            <span className="text-muted-foreground">Tax (8.25%):</span>
                            <span>${Number(viewingJob.tax ?? 0).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between w-full sm:w-48 font-semibold text-base">
                            <span>Total:</span>
                            <span>${Number(viewingJob.total ?? 0).toFixed(2)}</span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-6 text-muted-foreground border rounded-lg">
                        <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No line items added</p>
                        <Button variant="outline" size="sm" className="mt-2" onClick={() => handleEdit(viewingJob)}>
                          <Plus className="w-4 h-4 mr-1" />
                          Add Items
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Notes Section */}
                  <div className="space-y-2">
                    <Label className="text-muted-foreground text-xs sm:text-sm font-medium">Notes</Label>
                    {viewingJob.notes ? (
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="whitespace-pre-wrap text-sm">{viewingJob.notes}</p>
                      </div>
                    ) : (
                      <p className="text-muted-foreground text-sm">No notes added</p>
                    )}
                  </div>
                </TabsContent>
                
                <TabsContent value="photos" className="mt-4">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <h4 className="font-medium">Job Photos</h4>
                      <Dialog open={photoDialogOpen} onOpenChange={setPhotoDialogOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline">
                            <Camera className="w-4 h-4 mr-2" />
                            Add Photo
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Upload Photo</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label>Photo Type</Label>
                              <Select value={photoType} onValueChange={(v: any) => setPhotoType(v)}>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="before">Before</SelectItem>
                                  <SelectItem value="after">After</SelectItem>
                                  <SelectItem value="other">Other</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label>Caption (optional)</Label>
                              <Input
                                value={photoCaption}
                                onChange={(e) => setPhotoCaption(e.target.value)}
                                placeholder="Add a caption..."
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Photo</Label>
                              <Input
                                type="file"
                                accept="image/*"
                                onChange={handlePhotoUpload}
                                disabled={uploadPhoto.isPending}
                              />
                            </div>
                            {uploadPhoto.isPending && (
                              <div className="flex items-center gap-2 text-muted-foreground">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Uploading...
                              </div>
                            )}
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                    
                    {viewingJob.photos && viewingJob.photos.length > 0 ? (
                      <PhotoGallery 
                        photos={viewingJob.photos} 
                        deletable={true}
                        editable={true}
                        onDelete={(photoId) => {
                          deletePhoto.mutate(photoId, {
                            onSuccess: () => {
                              // Immediately update local state
                              setViewingJob(prev => prev ? {
                                ...prev,
                                photos: prev.photos?.filter(p => p.id !== photoId) || []
                              } : null);
                            }
                          });
                        }}
                      />
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Image className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p>No photos yet</p>
                      </div>
                    )}
                  </div>
                </TabsContent>
                
                <TabsContent value="time" className="mt-4">
                  <JobTimeTracker jobId={viewingJob.id} jobNumber={viewingJob.job_number} />
                </TabsContent>
                
                
                <TabsContent value="quotes" className="mt-4">
                  <JobRelatedQuotesSection 
                    job={viewingJob} 
                    onViewQuote={(quote) => {
                      setViewingJob(null);
                      setViewingQuote(quote);
                    }}
                    onCreateUpsellQuote={() => {
                      convertToQuote.mutate(viewingJob);
                      setViewingJob(null);
                    }}
                    isCreatingQuote={convertToQuote.isPending}
                  />
                </TabsContent>
              </Tabs>
              
              <DialogFooter className="mt-6 flex-wrap gap-2">
                {!viewingJob.quote_id && (
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      convertToQuote.mutate(viewingJob);
                      setViewingJob(null);
                    }}
                    disabled={convertToQuote.isPending}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Create Quote
                  </Button>
                )}
                <Button variant="outline" onClick={() => handleEdit(viewingJob)}>
                  <Edit className="w-4 h-4 mr-2" />
                  Edit Job
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Complete Job Dialog */}
      <CompleteJobDialog
        job={completingJob}
        open={!!completingJob}
        onOpenChange={(open) => !open && setCompletingJob(null)}
      />

      {/* Quote Detail Dialog */}
      <QuoteDetailDialog
        quote={viewingQuote}
        customerName={viewingQuote ? safeCustomers.find(c => c.id === viewingQuote.customer_id)?.name : undefined}
        open={!!viewingQuote}
        onOpenChange={(open) => !open && setViewingQuote(null)}
        onDownload={(quoteId) => downloadDocument.mutate({ type: 'quote', documentId: quoteId })}
        onEmail={(quoteId) => {
          const customer = safeCustomers.find(c => c.id === viewingQuote?.customer_id);
          if (customer?.email) {
            emailDocument.mutate({ type: 'quote', documentId: quoteId, recipientEmail: customer.email });
          } else {
            toast.error('Customer has no email');
          }
        }}
        onEdit={() => setViewingQuote(null)}
      />
    </div>
  );
};

// Separate component for related quotes to use the hook properly
function JobRelatedQuotesSection({ 
  job, 
  onViewQuote, 
  onCreateUpsellQuote,
  isCreatingQuote 
}: { 
  job: Job; 
  onViewQuote: (quote: Quote) => void;
  onCreateUpsellQuote: () => void;
  isCreatingQuote: boolean;
}) {
  const { data: relatedQuotes, isLoading } = useJobRelatedQuotes(job.id, job.quote_id);

  if (isLoading) {
    return <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Origin Quote (Parent) */}
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
          <ArrowDown className="w-3 h-3" /> Origin Quote (Created This Job)
        </p>
        {relatedQuotes?.originQuote ? (
          <QuoteCard 
            quote={relatedQuotes.originQuote} 
            onView={() => onViewQuote(relatedQuotes.originQuote!)}
          />
        ) : (
          <div className="p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
            No origin quote - job was created directly
          </div>
        )}
      </div>

      {/* Upsell Quotes (Children) */}
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1">
          <ArrowUp className="w-3 h-3" /> Upsell Quotes (Created During Job)
        </p>
        
        {relatedQuotes?.childQuotes && relatedQuotes.childQuotes.length > 0 ? (
          <div className="space-y-2">
            {relatedQuotes.childQuotes.map((quote: Quote) => (
              <QuoteCard 
                key={quote.id} 
                quote={quote} 
                onView={() => onViewQuote(quote)}
              />
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">No upsell quotes yet</p>
            <Button 
              variant="outline" 
              size="sm"
              onClick={onCreateUpsellQuote}
              disabled={isCreatingQuote}
            >
              <Plus className="w-3 h-3 mr-1" />
              Create Upsell Quote
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export default Jobs;
