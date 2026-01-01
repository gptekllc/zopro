import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useJobs, useCreateJob, useUpdateJob, useDeleteJob, useUploadJobPhoto, useDeleteJobPhoto, useConvertJobToInvoice, useArchiveJob, useUnarchiveJob, Job } from '@/hooks/useJobs';
import { useCustomers } from '@/hooks/useCustomers';
import { useQuotes } from '@/hooks/useQuotes';
import { useProfiles } from '@/hooks/useProfiles';
import { useAuth } from '@/hooks/useAuth';
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
import { Plus, Search, Briefcase, Trash2, Edit, Loader2, Camera, Upload, User, Calendar, ChevronRight, FileText, X, Image, List, CalendarDays, Receipt, CheckCircle2, Clock, Archive, ArchiveRestore, Eye, EyeOff, MoreVertical } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { toast } from 'sonner';
import JobCalendar from '@/components/jobs/JobCalendar';
import { CompleteJobDialog } from '@/components/jobs/CompleteJobDialog';
import { JobTimeTracker } from '@/components/jobs/JobTimeTracker';
import { InlineCustomerForm } from '@/components/customers/InlineCustomerForm';

const JOB_STATUSES = ['draft', 'scheduled', 'in_progress', 'completed', 'invoiced', 'paid'] as const;
const JOB_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

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
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [importQuoteId, setImportQuoteId] = useState<string>('');
  const [completingJob, setCompletingJob] = useState<Job | null>(null);
  
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
  });

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
    });
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
    };

    try {
      if (editingJob) {
        await updateJob.mutateAsync({ id: editingJob.id, ...jobData });
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
    });
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
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !viewingJob) return;

    const file = e.target.files[0];
    await uploadPhoto.mutateAsync({
      jobId: viewingJob.id,
      file,
      photoType,
      caption: photoCaption,
    });
    setPhotoDialogOpen(false);
    setPhotoCaption('');
    // Refresh viewing job
    const updatedJob = safeJobs.find(j => j.id === viewingJob.id);
    if (updatedJob) setViewingJob(updatedJob);
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
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingJob ? 'Edit Job' : 'Create New Job'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Import from Quote */}
              {!editingJob && (
                <div className="flex gap-2 items-end">
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
                  <Button type="button" variant="outline" onClick={handleImportQuote} disabled={!importQuoteId}>
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

              <div className="grid grid-cols-2 gap-4">
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
              </div>

              <div className="grid grid-cols-2 gap-4">
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

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                />
              </div>
              
              <div className="flex gap-3 pt-4">
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
            >
              <List className="w-4 h-4" />
            </Button>
            <Button
              variant={viewMode === 'calendar' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('calendar')}
            >
              <CalendarDays className="w-4 h-4" />
            </Button>
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
                    
                    {/* Row 2: Title */}
                    <p className="font-medium text-sm line-clamp-1">{job.title}</p>
                    
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {viewingJob && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Briefcase className="w-5 h-5" />
                  {viewingJob.job_number} - {viewingJob.title}
                </DialogTitle>
              </DialogHeader>
              
              <Tabs defaultValue="details" className="mt-4">
                <TabsList>
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="photos">Photos ({viewingJob.photos?.length || 0})</TabsTrigger>
                  <TabsTrigger value="time">Time Tracking</TabsTrigger>
                  <TabsTrigger value="notes">Notes</TabsTrigger>
                </TabsList>
                
                <TabsContent value="details" className="space-y-4 mt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Customer</Label>
                      <p className="font-medium">{viewingJob.customer?.name}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Status</Label>
                      <Badge className={getStatusColor(viewingJob.status)}>{viewingJob.status}</Badge>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Priority</Label>
                      <Badge className={getPriorityColor(viewingJob.priority)}>{viewingJob.priority}</Badge>
                    </div>
                    {viewingJob.assignee?.full_name && (
                      <div>
                        <Label className="text-muted-foreground">Assigned To</Label>
                        <p className="font-medium">{viewingJob.assignee.full_name}</p>
                      </div>
                    )}
                    {viewingJob.scheduled_start && (
                      <div>
                        <Label className="text-muted-foreground">Scheduled Start</Label>
                        <p className="font-medium">{format(new Date(viewingJob.scheduled_start), 'MMM d, yyyy h:mm a')}</p>
                      </div>
                    )}
                    {viewingJob.scheduled_end && (
                      <div>
                        <Label className="text-muted-foreground">Scheduled End</Label>
                        <p className="font-medium">{format(new Date(viewingJob.scheduled_end), 'MMM d, yyyy h:mm a')}</p>
                      </div>
                    )}
                  </div>
                  
                  {viewingJob.description && (
                    <div>
                      <Label className="text-muted-foreground">Description</Label>
                      <p className="mt-1">{viewingJob.description}</p>
                    </div>
                  )}
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
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {viewingJob.photos.map((photo) => (
                          <div key={photo.id} className="relative group">
                            <img
                              src={photo.photo_url}
                              alt={photo.caption || 'Job photo'}
                              className="w-full h-40 object-cover rounded-lg"
                            />
                            <div className="absolute top-2 left-2">
                              <Badge variant="secondary" className="text-xs capitalize">
                                {photo.photo_type}
                              </Badge>
                            </div>
                            <Button
                              variant="destructive"
                              size="icon"
                              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => deletePhoto.mutate(photo.id)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                            {photo.caption && (
                              <p className="text-xs text-muted-foreground mt-1">{photo.caption}</p>
                            )}
                          </div>
                        ))}
                      </div>
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
                
                <TabsContent value="notes" className="mt-4">
                  <div className="space-y-4">
                    {viewingJob.notes ? (
                      <div className="p-4 bg-muted rounded-lg">
                        <p className="whitespace-pre-wrap">{viewingJob.notes}</p>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">No notes added</p>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
              
              <DialogFooter className="mt-6">
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
    </div>
  );
};

export default Jobs;
