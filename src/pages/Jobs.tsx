import { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useScrollRestoration } from '@/hooks/useScrollRestoration';
import { useJobs, useCreateJob, useUpdateJob, Job } from '@/hooks/useJobs';
import { useJobTemplates, JobTemplate } from '@/hooks/useJobTemplates';
import { useCustomers } from '@/hooks/useCustomers';
import { useQuotes } from '@/hooks/useQuotes';
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
import { Plus, Loader2, List, CalendarDays, Users, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import JobCalendar from '@/components/jobs/JobCalendar';
import SchedulerView from '@/components/jobs/SchedulerView';
import { InlineCustomerForm } from '@/components/customers/InlineCustomerForm';
import { SaveAsTemplateDialog } from '@/components/jobs/SaveAsTemplateDialog';
import { DiscountInput, calculateDiscountAmount, formatDiscount } from "@/components/ui/discount-input";
import { LineItemsEditor, LineItem } from '@/components/line-items/LineItemsEditor';
import { JobListManager } from '@/components/jobs/JobListManager';

const JOB_STATUSES_EDITABLE = ['draft', 'scheduled', 'in_progress', 'completed', 'invoiced'] as const;
const JOB_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

const Jobs = () => {
  const { profile, roles } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { saveScrollPosition, restoreScrollPosition } = useScrollRestoration();

  // Determine if we need to include archived jobs
  const [includeArchived, setIncludeArchived] = useState(false);
  const { data: jobs = [], isLoading, refetch: refetchJobs } = useJobs(includeArchived);

  // Safe arrays
  const safeJobs = useMemo(() => (jobs ?? []).filter(Boolean) as Job[], [jobs]);
  const { data: customers = [] } = useCustomers();
  const { data: quotes = [] } = useQuotes();
  const { data: profiles = [] } = useProfiles();
  const { data: company } = useCompany();
  const { data: templates = [] } = useJobTemplates();
  
  const taxRate = company?.tax_rate ?? 8.25;
  const safeCustomers = useMemo(() => (Array.isArray(customers) ? customers : []).filter((c: any) => c && c.id), [customers]);
  const safeQuotes = useMemo(() => (Array.isArray(quotes) ? quotes : []).filter((q: any) => q && q.id), [quotes]);
  const safeProfiles = useMemo(() => (Array.isArray(profiles) ? profiles : []).filter((p: any) => p && p.id), [profiles]);

  const createJob = useCreateJob();
  const updateJob = useUpdateJob();

  const isAdmin = roles.some(r => r.role === 'admin' || r.role === 'manager');
  const technicians = safeProfiles.filter(p => p.role === 'technician' || p.role === 'admin' || p.role === 'manager');
  const availableTechnicians = technicians.filter(p => p.employment_status !== 'on_leave');

  // View mode state
  const [viewMode, setViewMode] = useState<'list' | 'calendar' | 'scheduler'>('list');
  const [viewingJob, setViewingJob] = useState<Job | null>(null);

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

  // Form state
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
    discountType: 'amount' as 'amount' | 'percentage',
    discountValue: 0
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
    const viewJobId = searchParams.get('view');
    const editJobId = searchParams.get('edit');
    const fromQuoteId = searchParams.get('fromQuote');
    const duplicateJobId = searchParams.get('duplicate');
    const saveTemplateId = searchParams.get('saveTemplate');

    if (saveTemplateId && safeJobs.length > 0) {
      setPendingSaveTemplateJobId(saveTemplateId);
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('saveTemplate');
      setSearchParams(newParams, { replace: true });
    } else if (fromQuoteId) {
      setPendingFromQuoteId(fromQuoteId);
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('fromQuote');
      setSearchParams(newParams, { replace: true });
    } else if (duplicateJobId && safeJobs.length > 0) {
      setPendingDuplicateJobId(duplicateJobId);
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('duplicate');
      setSearchParams(newParams, { replace: true });
    } else if (editJobId && safeJobs.length > 0) {
      setPendingEditJobId(editJobId);
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('edit');
      setSearchParams(newParams, { replace: true });
    } else if (viewJobId && safeJobs.length > 0) {
      const job = safeJobs.find(j => j.id === viewJobId);
      if (job) {
        setViewingJob(job);
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('view');
        setSearchParams(newParams, { replace: true });
      }
    }
  }, [searchParams, safeJobs, safeQuotes, setSearchParams]);

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
          assigned_to: null,
          title: `Job from Quote ${quote.quote_number}`,
          description: quote.notes || '',
          priority: 'medium',
          status: 'draft',
          scheduled_start: '',
          scheduled_end: '',
          notes: '',
          estimated_duration: 60,
          discountType: quote.discount_type || 'amount',
          discountValue: Number(quote.discount_value) || 0
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
      assigned_to: null,
      title: '',
      description: '',
      priority: 'medium',
      status: 'draft',
      scheduled_start: '',
      scheduled_end: '',
      notes: '',
      estimated_duration: 60,
      discountType: 'amount',
      discountValue: 0
    });
    setLineItems([]);
    setEditingJob(null);
    setImportQuoteId('');
  };

  const addLineItem = (type: 'product' | 'service' = 'service') => {
    setLineItems([...lineItems, { id: crypto.randomUUID(), description: '', quantity: 1, unitPrice: 0, type }]);
  };

  const removeLineItem = (id: string) => {
    setLineItems(lineItems.filter(item => item.id !== id));
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: string | number) => {
    setLineItems(lineItems.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  const calculateSubtotal = () => lineItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const calculateTax = () => calculateSubtotal() * (taxRate / 100);
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
      assigned_to: formData.assigned_to || null,
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
      items: lineItems.map(item => ({
        description: item.description,
        item_description: item.itemDescription || null,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        type: item.type || 'service'
      }))
    };
    
    try {
      if (editingJob) {
        await updateJob.mutateAsync({ id: editingJob.id, ...jobData });
      } else {
        await createJob.mutateAsync(jobData);
      }
      openEditDialog(false);
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
      discountType: job.discount_type || 'amount',
      discountValue: Number(job.discount_value) || 0
    });
    if (job.items && job.items.length > 0) {
      setLineItems(job.items.map(item => ({
        id: item.id,
        description: item.description,
        itemDescription: (item as any).item_description || '',
        quantity: item.quantity,
        unitPrice: item.unit_price,
        type: (item as any).type || 'service'
      })));
    } else {
      setLineItems([]);
    }
    setEditingJob(job);
    openEditDialog(true);
  };

  const handleDuplicate = (job: Job) => {
    setFormData({
      customer_id: job.customer_id,
      quote_id: null,
      assigned_to: job.assigned_to,
      title: `${job.title} (Copy)`,
      description: job.description || '',
      priority: job.priority,
      status: 'draft',
      scheduled_start: '',
      scheduled_end: '',
      notes: job.notes || '',
      estimated_duration: job.estimated_duration ?? 60,
      discountType: job.discount_type || 'amount',
      discountValue: Number(job.discount_value) || 0
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
      estimated_duration: template.estimated_duration ?? 60,
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
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <h1 className="text-3xl font-bold">Jobs</h1>
            <p className="text-muted-foreground mt-1 hidden sm:block">{safeJobs.length} total jobs</p>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="hidden sm:flex gap-1 border rounded-md p-1">
              <Button variant={viewMode === 'list' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('list')} title="List View">
                <List className="w-4 h-4" />
              </Button>
              <Button variant={viewMode === 'calendar' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('calendar')} title="Calendar View">
                <CalendarDays className="w-4 h-4" />
              </Button>
              {isAdmin && (
                <Button variant={viewMode === 'scheduler' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('scheduler')} title="Scheduler View">
                  <Users className="w-4 h-4" />
                </Button>
              )}
            </div>

            <Dialog open={isDialogOpen} onOpenChange={open => {
              openEditDialog(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button className="gap-2 hidden sm:flex">
                  <Plus className="w-4 h-4" />
                  Create Job
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-[95vw] sm:max-w-2xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl max-h-[100dvh] sm:max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingJob ? 'Edit Job' : 'Create New Job'}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Import from Quote or Template */}
                  {!editingJob && (
                    <div className="flex flex-col gap-3">
                      <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                        <div className="flex-1 space-y-2">
                          <Label>Import from Quote (optional)</Label>
                          <Select value={importQuoteId} onValueChange={setImportQuoteId}>
                            <SelectTrigger>
                              <SelectValue placeholder="Select a quote" />
                            </SelectTrigger>
                            <SelectContent>
                              {safeQuotes.filter((q: any) => (q?.status === 'accepted' || q?.status === 'sent') && q?.id).map((q: any) => (
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

                      {templates.length > 0 && (
                        <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                          <div className="flex-1 space-y-2">
                            <Label>Load from Template (optional)</Label>
                            <Select onValueChange={(templateId) => {
                              const template = templates.find(t => t.id === templateId);
                              if (template) handleLoadTemplate(template);
                            }}>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a template" />
                              </SelectTrigger>
                              <SelectContent>
                                {templates.map((t) => (
                                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <InlineCustomerForm
                      customers={safeCustomers}
                      selectedCustomerId={formData.customer_id}
                      onCustomerSelect={value => setFormData({ ...formData, customer_id: value })}
                    />
                    <div className="space-y-2">
                      <Label>Assign To</Label>
                      <Select value={formData.assigned_to || 'unassigned'} onValueChange={value => setFormData({ ...formData, assigned_to: value === 'unassigned' ? null : value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select technician" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {availableTechnicians.map(t => (
                            <SelectItem key={t.id} value={t.id}>{t.full_name || t.email}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {technicians.some(t => t.employment_status === 'on_leave') && (
                        <p className="text-xs text-muted-foreground">Team members on leave are hidden from this list</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Title *</Label>
                    <Input value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} placeholder="Job title" />
                  </div>

                  <div className="space-y-2">
                    <Label>Problem Description</Label>
                    <Textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={3} placeholder="Describe the issue..." />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Priority</Label>
                      <Select value={formData.priority} onValueChange={value => setFormData({ ...formData, priority: value as Job['priority'] })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {JOB_PRIORITIES.map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select value={formData.status} onValueChange={value => setFormData({ ...formData, status: value as Job['status'] })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {JOB_STATUSES_EDITABLE.map(s => <SelectItem key={s} value={s} className="capitalize">{s.replace('_', ' ')}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Est. Duration</Label>
                      <Select value={String(formData.estimated_duration)} onValueChange={value => setFormData({ ...formData, estimated_duration: parseInt(value) })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
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
                      <Input type="datetime-local" value={formData.scheduled_start} onChange={e => setFormData({ ...formData, scheduled_start: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Scheduled End</Label>
                      <Input type="datetime-local" value={formData.scheduled_end} onChange={e => setFormData({ ...formData, scheduled_end: e.target.value })} />
                    </div>
                  </div>

                  {/* Line Items Section */}
                  <Separator />
                  <LineItemsEditor
                    items={lineItems}
                    onAddItem={addLineItem}
                    onAddFromCatalog={(catalogItem) => {
                      setLineItems([...lineItems, {
                        id: crypto.randomUUID(),
                        description: catalogItem.name,
                        itemDescription: catalogItem.description || '',
                        quantity: 1,
                        unitPrice: Number(catalogItem.unit_price),
                        type: catalogItem.type
                      }]);
                    }}
                    onRemoveItem={removeLineItem}
                    onUpdateItem={updateLineItem}
                    quantityLabel="Qty (hrs)"
                  />

                  {/* Discount and Totals */}
                  <div className="border-t pt-3 space-y-2">
                    <DiscountInput
                      discountType={formData.discountType}
                      discountValue={formData.discountValue}
                      onDiscountTypeChange={(type) => setFormData({ ...formData, discountType: type })}
                      onDiscountValueChange={(value) => setFormData({ ...formData, discountValue: value })}
                    />
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal:</span>
                      <span>${calculateSubtotal().toLocaleString()}</span>
                    </div>
                    {formData.discountValue > 0 && (
                      <div className="flex justify-between text-sm text-success">
                        <span>Discount ({formatDiscount(formData.discountType, formData.discountValue)}):</span>
                        <span>-${calculateDiscountAmount(calculateSubtotal(), formData.discountType, formData.discountValue).toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Tax ({taxRate}%):</span>
                      <span>${calculateTax().toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between font-semibold pt-1 border-t">
                      <span>Total:</span>
                      <span>${(calculateTotal() - calculateDiscountAmount(calculateSubtotal(), formData.discountType, formData.discountValue)).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} rows={2} />
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
      {viewMode === 'calendar' && <JobCalendar jobs={safeJobs} onJobClick={setViewingJob} />}

      {/* Scheduler View - Admin/Manager only */}
      {viewMode === 'scheduler' && isAdmin && <SchedulerView jobs={safeJobs} technicians={technicians} onJobClick={setViewingJob} />}

      {/* Job List View */}
      {viewMode === 'list' && (
        <div className="lg:max-w-4xl lg:mx-auto">
          <JobListManager
            jobs={safeJobs}
            customers={safeCustomers}
            profiles={safeProfiles}
            showFilters={true}
            showSearch={true}
            onEditJob={handleEdit}
            onCreateJob={() => openEditDialog(true)}
            onRefetch={async () => { await refetchJobs(); }}
            isLoading={isLoading}
          />
        </div>
      )}

      {/* Save As Template Dialog */}
      {saveAsTemplateJob && (
        <SaveAsTemplateDialog
          job={saveAsTemplateJob}
          open={!!saveAsTemplateJob}
          onOpenChange={(open) => !open && setSaveAsTemplateJob(null)}
        />
      )}
    </div>
  );
};

export default Jobs;
