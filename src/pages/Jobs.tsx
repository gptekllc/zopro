import { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useScrollRestoration } from '@/hooks/useScrollRestoration';
import { useJobs, useCreateJob, useUpdateJob, Job } from '@/hooks/useJobs';
import { useJobTemplates, JobTemplate } from '@/hooks/useJobTemplates';
import { useCustomers } from '@/hooks/useCustomers';
import { useQuotes } from '@/hooks/useQuotes';
import { useInvoices } from '@/hooks/useInvoices';
import { useProfiles } from '@/hooks/useProfiles';
import { useAuth } from '@/hooks/useAuth';
import { useCompany } from '@/hooks/useCompany';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Plus, Loader2, List, CalendarDays, FileText, ChevronsUpDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { toast } from 'sonner';
import JobCalendar from '@/components/jobs/JobCalendar';
import { InlineCustomerForm } from '@/components/customers/InlineCustomerForm';
import { SaveAsTemplateDialog } from '@/components/jobs/SaveAsTemplateDialog';
import { DiscountInput, calculateDiscountAmount, formatDiscount } from "@/components/ui/discount-input";
import { LineItemsEditor, LineItem } from '@/components/line-items/LineItemsEditor';
import { JobListManager } from '@/components/jobs/JobListManager';
import { JobListControls } from '@/components/jobs/JobListControls';
import PageContainer from '@/components/layout/PageContainer';
import { UsageLimitWarning, UsageLimitBadge } from '@/components/UsageLimitWarning';
import { useUsageLimits } from '@/hooks/useUsageLimits';
import { formatAmount } from '@/lib/formatAmount';
import { PullToRefresh, ListSkeleton } from '@/components/ui/pull-to-refresh';
const JOB_STATUSES_EDITABLE = ['draft', 'scheduled', 'in_progress', 'completed', 'invoiced'] as const;
const JOB_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
const Jobs = () => {
  const {
    profile,
    roles
  } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const {
    saveScrollPosition,
    restoreScrollPosition
  } = useScrollRestoration();
  const {
    isAtJobLimit,
    isNearJobLimit
  } = useUsageLimits();

  // Determine if we need to include archived jobs
  const [includeArchived, setIncludeArchived] = useState(false);
  const {
    data: jobs = [],
    isLoading,
    refetch: refetchJobs
  } = useJobs(includeArchived);

  const handleRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['jobs'] });
  }, [queryClient]);

  // Safe arrays
  const safeJobs = useMemo(() => (jobs ?? []).filter(Boolean) as Job[], [jobs]);
  const {
    data: customers = []
  } = useCustomers();
  const {
    data: quotes = []
  } = useQuotes();
  const {
    data: invoices = []
  } = useInvoices();
  const {
    data: profiles = []
  } = useProfiles();
  const {
    data: company
  } = useCompany();
  const {
    data: templates = []
  } = useJobTemplates();
  const taxRate = company?.tax_rate ?? 8.25;
  const safeCustomers = useMemo(() => (Array.isArray(customers) ? customers : []).filter((c: any) => c && c.id), [customers]);
  const safeQuotes = useMemo(() => (Array.isArray(quotes) ? quotes : []).filter((q: any) => q && q.id), [quotes]);
  const safeProfiles = useMemo(() => (Array.isArray(profiles) ? profiles : []).filter((p: any) => p && p.id), [profiles]);

  // Filter quotes: only "sent" or "accepted" status, and not already converted to invoice
  const invoicedQuoteIds = useMemo(() => {
    return new Set((invoices || []).filter((inv: any) => inv?.quote_id).map((inv: any) => inv.quote_id));
  }, [invoices]);
  const availableQuotesForImport = useMemo(() => {
    return safeQuotes.filter((q: any) => (q?.status === 'sent' || q?.status === 'accepted') && !invoicedQuoteIds.has(q?.id));
  }, [safeQuotes, invoicedQuoteIds]);
  const createJob = useCreateJob();
  const updateJob = useUpdateJob();
  const isAdmin = roles.some(r => r.role === 'admin' || r.role === 'manager');
  const technicians = safeProfiles.filter(p => p.role === 'technician' || p.role === 'admin' || p.role === 'manager');
  const availableTechnicians = technicians.filter(p => p.employment_status !== 'on_leave');

  // View mode state
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [viewingJob, setViewingJob] = useState<Job | null>(null);

  // Search and filter state (lifted for header placement)
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string[]>(['all']);

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [importQuoteId, setImportQuoteId] = useState<string>('');
  const [saveAsTemplateJob, setSaveAsTemplateJob] = useState<Job | null>(null);

  // Pending URL actions
  const [pendingEditJobId, setPendingEditJobId] = useState<string | null>(null);
  const [pendingFromQuoteId, setPendingFromQuoteId] = useState<string | null>(null);
  const [pendingDuplicateJobId, setPendingDuplicateJobId] = useState<string | null>(null);
  const [pendingSaveTemplateJobId, setPendingSaveTemplateJobId] = useState<string | null>(null);
  const [pendingViewJobId, setPendingViewJobId] = useState<string | null>(null);
  const [pendingJobTab, setPendingJobTab] = useState<'photos' | 'linked' | 'feedback' | 'activities' | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    customer_id: '',
    quote_id: '' as string | null,
    assignee_ids: [] as string[],
    title: '',
    description: '',
    priority: 'medium' as Job['priority'],
    status: 'draft' as Job['status'],
    scheduled_start: '',
    scheduled_end: '',
    notes: '',
    estimated_duration: 60,
    discountType: 'amount' as 'amount' | 'percentage',
    discountValue: 0,
    laborHourlyRate: 0
  });

  // Line items state
  const [lineItems, setLineItems] = useState<LineItem[]>([]);

  // Wrapped setters for scroll restoration
  const openEditDialog = useCallback((open: boolean) => {
    if (open) saveScrollPosition();
    setIsDialogOpen(open);
    if (!open) restoreScrollPosition();
  }, [saveScrollPosition, restoreScrollPosition]);

  // Handle URL params
  useEffect(() => {
    const createParam = searchParams.get('create');
    const viewJobId = searchParams.get('view');
    const editJobId = searchParams.get('edit');
    const fromQuoteId = searchParams.get('fromQuote');
    const duplicateJobId = searchParams.get('duplicate');
    const saveTemplateId = searchParams.get('saveTemplate');
    const tabParam = searchParams.get('tab');

    // Handle create param from mobile FAB
    if (createParam === 'true') {
      resetForm();
      openEditDialog(true);
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('create');
      setSearchParams(newParams, {
        replace: true
      });
      return;
    }
    if (saveTemplateId && safeJobs.length > 0) {
      setPendingSaveTemplateJobId(saveTemplateId);
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('saveTemplate');
      setSearchParams(newParams, {
        replace: true
      });
    } else if (fromQuoteId) {
      setPendingFromQuoteId(fromQuoteId);
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('fromQuote');
      setSearchParams(newParams, {
        replace: true
      });
    } else if (duplicateJobId && safeJobs.length > 0) {
      setPendingDuplicateJobId(duplicateJobId);
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('duplicate');
      setSearchParams(newParams, {
        replace: true
      });
    } else if (editJobId && safeJobs.length > 0) {
      setPendingEditJobId(editJobId);
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('edit');
      setSearchParams(newParams, {
        replace: true
      });
    } else if (viewJobId && safeJobs.length > 0) {
      // Pass to JobListManager via pending state
      setPendingViewJobId(viewJobId);
      if (tabParam && ['photos', 'linked', 'feedback', 'activities'].includes(tabParam)) {
        setPendingJobTab(tabParam as 'photos' | 'linked' | 'feedback' | 'activities');
      }
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('view');
      newParams.delete('tab');
      setSearchParams(newParams, {
        replace: true
      });
    }
  }, [searchParams, safeJobs, safeQuotes, setSearchParams]);

  // Callback when initial view has been handled by JobListManager
  const handleInitialViewHandled = useCallback(() => {
    setPendingViewJobId(null);
    setPendingJobTab(null);
  }, []);

  // Handle pending save template
  useEffect(() => {
    if (pendingSaveTemplateJobId && safeJobs.length > 0) {
      const job = safeJobs.find(j => j.id === pendingSaveTemplateJobId);
      if (job) {
        setSaveAsTemplateJob(job);
        setPendingSaveTemplateJobId(null);
      }
    }
  }, [pendingSaveTemplateJobId, safeJobs]);

  // Handle pending edit
  useEffect(() => {
    if (pendingEditJobId && safeJobs.length > 0) {
      const job = safeJobs.find(j => j.id === pendingEditJobId);
      if (job) {
        handleEdit(job);
        setPendingEditJobId(null);
      }
    }
  }, [pendingEditJobId, safeJobs]);

  // Handle pending duplicate
  useEffect(() => {
    if (pendingDuplicateJobId && safeJobs.length > 0) {
      const job = safeJobs.find(j => j.id === pendingDuplicateJobId);
      if (job) {
        handleDuplicate(job);
        setPendingDuplicateJobId(null);
      }
    }
  }, [pendingDuplicateJobId, safeJobs]);

  // Handle fromQuote URL param
  useEffect(() => {
    if (pendingFromQuoteId && safeQuotes.length > 0) {
      const quote: any = safeQuotes.find((q: any) => q?.id === pendingFromQuoteId);
      if (quote) {
        setFormData({
          customer_id: quote.customer_id,
          quote_id: quote.id,
          assignee_ids: [],
          title: `Job from Quote ${quote.quote_number}`,
          description: quote.notes || '',
          priority: 'medium',
          status: 'draft',
          scheduled_start: '',
          scheduled_end: '',
          notes: '',
          estimated_duration: 60,
          discountType: quote.discount_type || 'amount',
          discountValue: Number(quote.discount_value) || 0,
          laborHourlyRate: 0
        });
        if (quote.items && quote.items.length > 0) {
          setLineItems(quote.items.map((item: any) => ({
            id: crypto.randomUUID(),
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unit_price,
            type: item.type || 'service'
          })));
        } else {
          setLineItems([]);
        }
        setEditingJob(null);
        openEditDialog(true);
        setPendingFromQuoteId(null);
      }
    }
  }, [pendingFromQuoteId, safeQuotes]);
  const resetForm = () => {
    setFormData({
      customer_id: '',
      quote_id: null,
      assignee_ids: [],
      title: '',
      description: '',
      priority: 'medium',
      status: 'draft',
      scheduled_start: '',
      scheduled_end: '',
      notes: '',
      estimated_duration: 60,
      discountType: 'amount',
      discountValue: 0,
      laborHourlyRate: 0
    });
    setLineItems([]);
    setEditingJob(null);
    setImportQuoteId('');
  };
  const addLineItem = (type: 'product' | 'service' = 'service') => {
    setLineItems([...lineItems, {
      id: crypto.randomUUID(),
      description: '',
      quantity: 1,
      unitPrice: 0,
      type
    }]);
  };
  const removeLineItem = (id: string) => {
    setLineItems(lineItems.filter(item => item.id !== id));
  };
  const updateLineItem = (id: string, field: keyof LineItem, value: string | number | boolean) => {
    setLineItems(lineItems.map(item => item.id === id ? {
      ...item,
      [field]: value
    } : item));
  };

  // Handle syncing labor from time clock entries
  const handleSyncLabor = (hours: number, rate: number) => {
    // Find existing labor item
    const existingLaborIndex = lineItems.findIndex(item => item.description.toLowerCase() === 'labor' && item.type === 'service');
    if (existingLaborIndex >= 0) {
      // Update existing labor item
      const updated = [...lineItems];
      updated[existingLaborIndex] = {
        ...updated[existingLaborIndex],
        quantity: hours,
        unitPrice: rate
      };
      setLineItems(updated);
    } else {
      // Add new labor item
      setLineItems([...lineItems, {
        id: crypto.randomUUID(),
        description: 'Labor',
        quantity: hours,
        unitPrice: rate,
        type: 'service'
      }]);
    }
    toast.success(`Synced ${hours} hours of labor @ $${rate}/hr`);
  };
  const calculateSubtotal = () => lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const calculateTaxableSubtotal = () => lineItems.filter(item => item.taxable !== false).reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const calculateTax = () => {
    const taxableSubtotal = calculateTaxableSubtotal();
    const discountRatio = calculateSubtotal() > 0 ? (calculateSubtotal() - calculateDiscountAmount(calculateSubtotal(), formData.discountType, formData.discountValue)) / calculateSubtotal() : 1;
    return taxableSubtotal * discountRatio * (taxRate / 100);
  };
  const calculateTotal = () => calculateSubtotal() + calculateTax();
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.customer_id || !formData.title) {
      toast.error('Please fill in required fields');
      return;
    }
    const jobData = {
      customer_id: formData.customer_id,
      quote_id: formData.quote_id || null,
      assignee_ids: formData.assignee_ids,
      title: formData.title,
      description: formData.description || null,
      priority: formData.priority,
      status: formData.status,
      scheduled_start: formData.scheduled_start || null,
      scheduled_end: formData.scheduled_end || null,
      notes: formData.notes || null,
      estimated_duration: formData.estimated_duration || 60,
      discount_type: formData.discountValue > 0 ? formData.discountType : null,
      discount_value: formData.discountValue > 0 ? formData.discountValue : 0,
      labor_hourly_rate: formData.laborHourlyRate || null,
      items: lineItems.map(item => ({
        description: item.description,
        item_description: item.itemDescription || null,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        type: item.type || 'service',
        taxable: item.taxable !== false
      }))
    };
    try {
      let resultJobId: string | null = null;
      if (editingJob) {
        await updateJob.mutateAsync({
          id: editingJob.id,
          ...jobData
        });
        resultJobId = editingJob.id;
      } else {
        const created = await createJob.mutateAsync(jobData);
        resultJobId = created?.id || null;
      }
      openEditDialog(false);
      resetForm();

      // Refresh the page to ensure all list cards show updated data
      window.location.reload();
    } catch (error) {
      // Error handled by hook
    }
  };
  const handleEdit = (job: Job) => {
    // Get assignee IDs from job_assignees or fallback to assigned_to
    const assigneeIds = job.assignees?.map(a => a.profile_id) || (job.assigned_to ? [job.assigned_to] : []);
    setFormData({
      customer_id: job.customer_id,
      quote_id: job.quote_id,
      assignee_ids: assigneeIds,
      title: job.title,
      description: job.description || '',
      priority: job.priority,
      status: job.status,
      scheduled_start: job.scheduled_start ? format(new Date(job.scheduled_start), "yyyy-MM-dd'T'HH:mm") : '',
      scheduled_end: job.scheduled_end ? format(new Date(job.scheduled_end), "yyyy-MM-dd'T'HH:mm") : '',
      notes: job.notes || '',
      estimated_duration: job.estimated_duration ?? 60,
      discountType: job.discount_type || 'amount',
      discountValue: Number(job.discount_value) || 0,
      laborHourlyRate: job.labor_hourly_rate || 0
    });
    if (job.items && job.items.length > 0) {
      setLineItems(job.items.map(item => ({
        id: item.id,
        description: item.description,
        itemDescription: (item as any).item_description || '',
        quantity: item.quantity,
        unitPrice: item.unit_price,
        type: (item as any).type || 'service',
        taxable: (item as any).taxable !== false
      })));
    } else {
      setLineItems([]);
    }
    setEditingJob(job);
    openEditDialog(true);
  };
  const handleDuplicate = (job: Job) => {
    const assigneeIds = job.assignees?.map(a => a.profile_id) || (job.assigned_to ? [job.assigned_to] : []);
    setFormData({
      customer_id: job.customer_id,
      quote_id: null,
      assignee_ids: assigneeIds,
      title: `${job.title} (Copy)`,
      description: job.description || '',
      priority: job.priority,
      status: 'draft',
      scheduled_start: '',
      scheduled_end: '',
      notes: job.notes || '',
      estimated_duration: job.estimated_duration ?? 60,
      discountType: job.discount_type || 'amount',
      discountValue: Number(job.discount_value) || 0,
      laborHourlyRate: job.labor_hourly_rate || 0
    });
    if (job.items && job.items.length > 0) {
      setLineItems(job.items.map(item => ({
        id: crypto.randomUUID(),
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        type: (item as any).type || 'service'
      })));
    } else {
      setLineItems([]);
    }
    setEditingJob(null);
    openEditDialog(true);
  };
  const handleLoadTemplate = (template: JobTemplate) => {
    setFormData({
      ...formData,
      title: template.title,
      description: template.description || '',
      priority: template.priority,
      notes: template.notes || '',
      estimated_duration: template.estimated_duration ?? 60
    });
    if (template.items && template.items.length > 0) {
      setLineItems(template.items.map(item => ({
        id: crypto.randomUUID(),
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        type: (item as any).type || 'service'
      })));
    }
    toast.success(`Loaded template: ${template.name}`);
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
        description: quote.notes || ''
      });
      if (quote.items && quote.items.length > 0) {
        setLineItems(quote.items.map((item: any) => ({
          id: crypto.randomUUID(),
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unit_price,
          type: item.type || 'service'
        })));
      }
    }
  };

  // Handle calendar slot click to create job with pre-filled schedule
  const handleCalendarSlotClick = (date: Date) => {
    resetForm();
    const endDate = new Date(date.getTime() + 60 * 60 * 1000); // 1 hour later
    setFormData(prev => ({
      ...prev,
      scheduled_start: format(date, "yyyy-MM-dd'T'HH:mm"),
      scheduled_end: format(endDate, "yyyy-MM-dd'T'HH:mm"),
      status: 'scheduled',
      estimated_duration: 60
    }));
    openEditDialog(true);
  };
  if (isLoading) {
    return <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>;
  }
  return <PullToRefresh onRefresh={handleRefresh} renderSkeleton={() => <ListSkeleton count={6} />} className="min-h-full">
    <PageContainer className="space-y-6">
      {/* Usage Limit Warning */}
      <UsageLimitWarning type="jobs" showProgress />

      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="font-bold flex items-center gap-2 text-2xl sm:text-3xl">
              Jobs
              <UsageLimitBadge type="jobs" />
            </h1>
            <p className="text-muted-foreground mt-1 hidden sm:block">{safeJobs.length} total jobs</p>
          </div>

          <div className="flex items-center gap-2">
            {/* Search and Filter - only show for list view */}
            {viewMode === 'list' && <JobListControls searchQuery={searchQuery} onSearchChange={setSearchQuery} statusFilter={statusFilter} onStatusFilterChange={setStatusFilter} />}
            
            {/* View Mode Toggle */}
            <div className="hidden sm:flex gap-1 border rounded-md p-1">
              <Button variant={viewMode === 'list' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('list')} title="List View">
                <List className="w-4 h-4" />
              </Button>
              <Button variant={viewMode === 'calendar' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('calendar')} title="Calendar View">
                <CalendarDays className="w-4 h-4" />
              </Button>
            </div>

            <Dialog open={isDialogOpen} onOpenChange={open => {
            openEditDialog(open);
            if (!open) resetForm();
          }}>
              <DialogTrigger asChild>
                <Button className="gap-2 hidden sm:flex" disabled={isAtJobLimit && !editingJob} title={isAtJobLimit ? 'Job limit reached. Upgrade to create more.' : undefined}>
                  <Plus className="w-4 h-4" />
                  Create Job
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[95vw] sm:max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl overflow-y-auto">
                <DialogHeader className="flex-shrink-0 pr-8">
                  <DialogTitle>{editingJob ? 'Edit Job' : 'Create New Job'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Import from Quote or Template */}
                  {!editingJob && (availableQuotesForImport.length > 0 || templates.length > 0) && <div className="flex flex-col gap-3">
                      {availableQuotesForImport.length > 0 && <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                          <div className="flex-1 space-y-2">
                            <Label>Import from Quote (optional)</Label>
                            <Select value={importQuoteId} onValueChange={setImportQuoteId}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a quote" />
                              </SelectTrigger>
                              <SelectContent>
                                {availableQuotesForImport.map((q: any) => <SelectItem key={q.id} value={q.id}>
                                    {String(q.quote_number ?? 'Quote')} - {safeCustomers.find((c: any) => c?.id === q?.customer_id)?.name}
                                  </SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <Button type="button" variant="outline" onClick={handleImportQuote} disabled={!importQuoteId} className="w-full sm:w-auto">
                            <FileText className="w-4 h-4 mr-2" />
                            Import
                          </Button>
                        </div>}

                      {templates.length > 0 && <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                          <div className="flex-1 space-y-2">
                            <Label>Load from Template (optional)</Label>
                            <Select onValueChange={templateId => {
                        const template = templates.find(t => t.id === templateId);
                        if (template) handleLoadTemplate(template);
                      }}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a template" />
                              </SelectTrigger>
                              <SelectContent>
                                {templates.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>}
                    </div>}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InlineCustomerForm customers={safeCustomers} selectedCustomerId={formData.customer_id} onCustomerSelect={value => setFormData({
                    ...formData,
                    customer_id: value
                  })} />
                    <div className="space-y-2">
                      <Label>Assign To</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-between font-normal">
                            <span className="truncate">
                              {formData.assignee_ids.length === 0 ? "Select technicians..." : formData.assignee_ids.length === 1 ? availableTechnicians.find(t => t.id === formData.assignee_ids[0])?.full_name || availableTechnicians.find(t => t.id === formData.assignee_ids[0])?.email || "1 selected" : `${formData.assignee_ids.length} technicians selected`}
                            </span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-full p-0" align="start">
                          <div className="p-2 space-y-1 max-h-48 overflow-y-auto">
                            {availableTechnicians.length === 0 ? <p className="text-sm text-muted-foreground p-2">No technicians available</p> : availableTechnicians.map(t => <div key={t.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-accent cursor-pointer" onClick={() => {
                            if (formData.assignee_ids.includes(t.id)) {
                              setFormData({
                                ...formData,
                                assignee_ids: formData.assignee_ids.filter(id => id !== t.id)
                              });
                            } else {
                              setFormData({
                                ...formData,
                                assignee_ids: [...formData.assignee_ids, t.id]
                              });
                            }
                          }}>
                                  <Checkbox checked={formData.assignee_ids.includes(t.id)} onCheckedChange={() => {}} />
                                  <span className="text-sm">{t.full_name || t.email}</span>
                                </div>)}
                          </div>
                        </PopoverContent>
                      </Popover>
                      {technicians.some(t => t.employment_status === 'on_leave') && <p className="text-xs text-muted-foreground">Team members on leave are hidden from this list</p>}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Title *</Label>
                    <Input value={formData.title} onChange={e => setFormData({
                    ...formData,
                    title: e.target.value
                  })} placeholder="Job title" />
                  </div>

                  <div className="space-y-2">
                    <Label>Problem Description</Label>
                    <Textarea value={formData.description} onChange={e => setFormData({
                    ...formData,
                    description: e.target.value
                  })} rows={3} placeholder="Describe the issue..." />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Priority</Label>
                      <Select value={formData.priority} onValueChange={value => setFormData({
                      ...formData,
                      priority: value as Job['priority']
                    })}>
                        <SelectTrigger className="capitalize"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {JOB_PRIORITIES.map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select value={formData.status} onValueChange={value => setFormData({
                      ...formData,
                      status: value as Job['status']
                    })}>
                        <SelectTrigger className="capitalize"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {JOB_STATUSES_EDITABLE.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace('_', ' ')}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Est. Duration</Label>
                      <Select value={String(formData.estimated_duration)} onValueChange={value => setFormData({
                      ...formData,
                      estimated_duration: parseInt(value)
                    })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="15">15 min</SelectItem>
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
                    <div className="space-y-2">
                      <Label>Labor Rate ($/hr)</Label>
                      <Input type="number" min="0" step="0.01" placeholder="0.00" value={formData.laborHourlyRate || ''} onChange={e => setFormData({
                      ...formData,
                      laborHourlyRate: parseFloat(e.target.value) || 0
                    })} />
                    </div>
                  </div>

                  {/* Line Items Section */}
                  <Separator />
                  <LineItemsEditor items={lineItems} onAddItem={addLineItem} onAddFromCatalog={catalogItem => {
                  setLineItems([...lineItems, {
                    id: crypto.randomUUID(),
                    description: catalogItem.name,
                    itemDescription: catalogItem.description || '',
                    quantity: 1,
                    unitPrice: Number(catalogItem.unit_price),
                    type: catalogItem.type
                  }]);
                }} onRemoveItem={removeLineItem} onUpdateItem={updateLineItem} quantityLabel="Qty (hrs)" showAutoLaborBadge={!!editingJob} jobId={editingJob?.id || null} laborHourlyRate={formData.laborHourlyRate} onSyncLabor={editingJob ? handleSyncLabor : undefined} />

                  {/* Discount and Totals */}
                  <div className="border-t pt-3 space-y-2">
                    <DiscountInput discountType={formData.discountType} discountValue={formData.discountValue} onDiscountTypeChange={type => setFormData({
                    ...formData,
                    discountType: type
                  })} onDiscountValueChange={value => setFormData({
                    ...formData,
                    discountValue: value
                  })} />
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal:</span>
                      <span>${formatAmount(calculateSubtotal())}</span>
                    </div>
                    {formData.discountValue > 0 && <div className="flex justify-between text-sm text-success">
                        <span>Discount ({formatDiscount(formData.discountType, formData.discountValue)}):</span>
                        <span>-${formatAmount(calculateDiscountAmount(calculateSubtotal(), formData.discountType, formData.discountValue))}</span>
                      </div>}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tax ({taxRate}%):</span>
                      <span>${formatAmount(calculateTax())}</span>
                    </div>
                    <div className="flex justify-between font-semibold pt-1 border-t">
                      <span>Total:</span>
                      <span>${formatAmount(calculateTotal() - calculateDiscountAmount(calculateSubtotal(), formData.discountType, formData.discountValue))}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea value={formData.notes} onChange={e => setFormData({
                    ...formData,
                    notes: e.target.value
                  })} rows={2} />
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
        </div>
      </div>

      {/* Calendar View */}
      {viewMode === 'calendar' && <JobCalendar jobs={safeJobs} onJobClick={setViewingJob} onSlotClick={handleCalendarSlotClick} />}

      {/* Job List View */}
      {viewMode === 'list' && <div className="lg:max-w-4xl lg:mx-auto">
          <JobListManager jobs={safeJobs} customers={safeCustomers} profiles={safeProfiles} searchQuery={searchQuery} onSearchChange={setSearchQuery} statusFilter={statusFilter} onStatusFilterChange={setStatusFilter} hideInlineControls={true} onEditJob={handleEdit} onCreateJob={() => openEditDialog(true)} onRefetch={async () => {
        await refetchJobs();
      }} isLoading={isLoading} initialViewJobId={pendingViewJobId} initialJobTab={pendingJobTab || undefined} onInitialViewHandled={handleInitialViewHandled} />
        </div>}

      {/* Save As Template Dialog */}
      {saveAsTemplateJob && <SaveAsTemplateDialog job={saveAsTemplateJob} open={!!saveAsTemplateJob} onOpenChange={open => !open && setSaveAsTemplateJob(null)} />}
    </PageContainer>
  </PullToRefresh>;
};
export default Jobs;