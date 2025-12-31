import { useState } from 'react';
import { useJobs, useCreateJob, useUpdateJob, useDeleteJob, useUploadJobPhoto, useDeleteJobPhoto, Job } from '@/hooks/useJobs';
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
import { Plus, Search, Briefcase, Trash2, Edit, Loader2, Camera, Upload, User, Calendar, ChevronRight, FileText, X, Image } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

const JOB_STATUSES = ['draft', 'scheduled', 'in_progress', 'completed', 'invoiced', 'paid'] as const;
const JOB_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

const Jobs = () => {
  const { profile, roles } = useAuth();
  const { data: jobs = [], isLoading } = useJobs();
  const { data: customers = [] } = useCustomers();
  const { data: quotes = [] } = useQuotes();
  const { data: profiles = [] } = useProfiles();
  const createJob = useCreateJob();
  const updateJob = useUpdateJob();
  const deleteJob = useDeleteJob();
  const uploadPhoto = useUploadJobPhoto();
  const deletePhoto = useDeleteJobPhoto();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [viewingJob, setViewingJob] = useState<Job | null>(null);
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  const [photoType, setPhotoType] = useState<'before' | 'after' | 'other'>('before');
  const [photoCaption, setPhotoCaption] = useState('');
  const [importQuoteId, setImportQuoteId] = useState<string>('');
  
  const isAdmin = roles.some(r => r.role === 'admin' || r.role === 'manager');
  const technicians = profiles.filter(p => p.role === 'technician' || p.role === 'admin' || p.role === 'manager');

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

  const filteredJobs = jobs.filter(job => {
    const matchesSearch = job.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.job_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      job.customer?.name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || job.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

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
    const quote = quotes.find(q => q.id === importQuoteId);
    if (quote) {
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
    const updatedJob = jobs.find(j => j.id === viewingJob.id);
    if (updatedJob) setViewingJob(updatedJob);
  };

  const handleStatusChange = async (jobId: string, newStatus: Job['status']) => {
    const updates: Partial<Job> = { status: newStatus };
    if (newStatus === 'in_progress' && !jobs.find(j => j.id === jobId)?.actual_start) {
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
          <p className="text-muted-foreground mt-1">{jobs.length} total jobs</p>
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
                        {quotes.filter(q => q.status === 'accepted' || q.status === 'sent').map((q) => (
                          <SelectItem key={q.id} value={q.id}>
                            {q.quote_number} - {customers.find(c => c.id === q.customer_id)?.name}
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Customer *</Label>
                  <Select
                    value={formData.customer_id}
                    onValueChange={(value) => setFormData({ ...formData, customer_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
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
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {JOB_STATUSES.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">{s.replace('_', ' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Job List */}
      <div className="space-y-3">
        {filteredJobs.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No jobs found
            </CardContent>
          </Card>
        ) : (
          filteredJobs.map((job) => (
            <Card key={job.id} className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer" onClick={() => setViewingJob(job)}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Briefcase className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{job.job_number}</h3>
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
                    <div className="text-right hidden sm:block">
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
                      {getNextStatus(job.status) && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => handleStatusChange(job.id, getNextStatus(job.status)!)}
                        >
                          <ChevronRight className="w-4 h-4 mr-1" />
                          {getNextStatus(job.status)?.replace('_', ' ')}
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
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Job Detail Dialog */}
      <Dialog open={!!viewingJob} onOpenChange={(open) => !open && setViewingJob(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {viewingJob && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {viewingJob.job_number}
                  <Badge className={getStatusColor(viewingJob.status)} variant="outline">
                    {viewingJob.status.replace('_', ' ')}
                  </Badge>
                </DialogTitle>
                <DialogDescription>{viewingJob.title}</DialogDescription>
              </DialogHeader>
              
              <Tabs defaultValue="details">
                <TabsList>
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="photos">Photos ({viewingJob.photos?.length || 0})</TabsTrigger>
                  <TabsTrigger value="notes">Notes</TabsTrigger>
                </TabsList>
                
                <TabsContent value="details" className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-muted-foreground">Customer</Label>
                      <p className="font-medium">{viewingJob.customer?.name}</p>
                      {viewingJob.customer?.phone && <p className="text-sm">{viewingJob.customer.phone}</p>}
                      {viewingJob.customer?.address && <p className="text-sm">{viewingJob.customer.address}</p>}
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Assigned To</Label>
                      <p className="font-medium">{viewingJob.assignee?.full_name || 'Unassigned'}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Priority</Label>
                      <Badge className={getPriorityColor(viewingJob.priority)}>{viewingJob.priority}</Badge>
                    </div>
                    <div>
                      <Label className="text-muted-foreground">Scheduled</Label>
                      <p className="text-sm">
                        {viewingJob.scheduled_start ? format(new Date(viewingJob.scheduled_start), 'MMM d, h:mm a') : 'Not scheduled'}
                        {viewingJob.scheduled_end && ` - ${format(new Date(viewingJob.scheduled_end), 'h:mm a')}`}
                      </p>
                    </div>
                  </div>
                  
                  {viewingJob.description && (
                    <div>
                      <Label className="text-muted-foreground">Description</Label>
                      <p className="text-sm whitespace-pre-wrap">{viewingJob.description}</p>
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="photos" className="space-y-4">
                  <div className="flex justify-between items-center">
                    <p className="text-sm text-muted-foreground">Before & after photos to document work</p>
                    <Dialog open={photoDialogOpen} onOpenChange={setPhotoDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
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
                            <Select value={photoType} onValueChange={(v) => setPhotoType(v as any)}>
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
                              placeholder="Describe the photo..."
                            />
                          </div>
                          <div>
                            <Label>Photo</Label>
                            <Input
                              type="file"
                              accept="image/*"
                              capture="environment"
                              onChange={handlePhotoUpload}
                              disabled={uploadPhoto.isPending}
                            />
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    {['before', 'after', 'other'].map((type) => {
                      const photos = viewingJob.photos?.filter(p => p.photo_type === type) || [];
                      return (
                        <div key={type} className="space-y-2">
                          <Label className="capitalize">{type} Photos</Label>
                          {photos.length === 0 ? (
                            <div className="aspect-square border-2 border-dashed rounded-lg flex items-center justify-center text-muted-foreground">
                              No {type} photos
                            </div>
                          ) : (
                            photos.map((photo) => (
                              <div key={photo.id} className="relative group">
                                <img
                                  src={photo.photo_url}
                                  alt={photo.caption || `${type} photo`}
                                  className="aspect-square object-cover rounded-lg"
                                />
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
                            ))
                          )}
                        </div>
                      );
                    })}
                  </div>
                </TabsContent>
                
                <TabsContent value="notes" className="space-y-4">
                  <Textarea
                    value={viewingJob.notes || ''}
                    placeholder="Add notes about this job..."
                    rows={6}
                    onChange={(e) => {
                      setViewingJob({ ...viewingJob, notes: e.target.value });
                    }}
                  />
                  <Button
                    onClick={async () => {
                      await updateJob.mutateAsync({ id: viewingJob.id, notes: viewingJob.notes });
                    }}
                    disabled={updateJob.isPending}
                  >
                    {updateJob.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Save Notes
                  </Button>
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Jobs;
