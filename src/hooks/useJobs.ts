import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { jobSchema, sanitizeErrorMessage } from '@/lib/validation';
import { compressImage } from '@/lib/imageCompression';
import { useEffect } from 'react';
import { calculateDiscountAmount } from '@/components/ui/discount-input';

export interface JobItem {
  id: string;
  job_id: string;
  description: string;
  item_description?: string | null;
  quantity: number;
  unit_price: number;
  total: number;
  type?: 'product' | 'service';
  created_at: string;
}

export interface Job {
  id: string;
  job_number: string;
  company_id: string;
  customer_id: string;
  quote_id: string | null;
  assigned_to: string | null;
  status: 'draft' | 'scheduled' | 'in_progress' | 'completed' | 'invoiced' | 'paid';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  description: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
  subtotal: number | null;
  tax: number | null;
  total: number | null;
  discount_type: 'amount' | 'percentage' | null;
  discount_value: number | null;
  estimated_duration?: number | null;
  labor_hourly_rate?: number | null;
  customer?: { name: string; email: string | null; phone: string | null; address: string | null; city: string | null; state: string | null; zip: string | null };
  assignee?: { full_name: string | null; employment_status?: string | null };
  assignees?: JobAssignee[];
  photos?: JobPhoto[];
  items?: JobItem[];
}

export interface JobAssignee {
  id: string;
  job_id: string;
  profile_id: string;
  created_at: string;
  profile?: { id: string; full_name: string | null; email: string; employment_status?: string | null };
}

export interface JobPhoto {
  id: string;
  job_id: string;
  photo_url: string;
  photo_type: 'before' | 'after' | 'other';
  caption: string | null;
  uploaded_by: string | null;
  created_at: string;
}

// Auto-archive jobs older than 3 years
export function useAutoArchiveOldJobs() {
  const { profile } = useAuth();
  
  useEffect(() => {
    if (!profile?.company_id) return;
    
    const autoArchive = async () => {
      const threeYearsAgo = new Date();
      threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
      
      // Archive jobs that are completed/paid and older than 3 years
      await (supabase as any)
        .from('jobs')
        .update({ archived_at: new Date().toISOString() })
        .is('archived_at', null)
        .in('status', ['completed', 'invoiced', 'paid'])
        .lt('created_at', threeYearsAgo.toISOString());
    };
    
    autoArchive();
  }, [profile?.company_id]);
}

export function useJobs(includeArchived: boolean = false) {
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  
  // Auto-archive old jobs on mount
  useAutoArchiveOldJobs();

  // Set up real-time subscription for jobs
  useEffect(() => {
    if (!profile?.company_id) return;

    const channel = supabase
      .channel('jobs-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jobs',
          filter: `company_id=eq.${profile.company_id}`,
        },
        () => {
          // Invalidate queries to refresh data
          queryClient.invalidateQueries({ queryKey: ['jobs'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_items',
        },
        () => {
          // Also refresh jobs when items change
          queryClient.invalidateQueries({ queryKey: ['jobs'] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_photos',
        },
        () => {
          // Also refresh jobs when photos change
          queryClient.invalidateQueries({ queryKey: ['jobs'] });
          queryClient.invalidateQueries({ queryKey: ['job'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.company_id, queryClient]);
  
  return useQuery({
    queryKey: ['jobs', profile?.company_id, includeArchived],
    queryFn: async () => {
      let query = (supabase as any)
        .from('jobs')
        .select(`
          *,
          customer:customers(name, email, phone, address, city, state, zip),
          assignee:profiles!jobs_assigned_to_fkey(full_name, employment_status, avatar_url),
          assignees:job_assignees(id, job_id, profile_id, created_at, profile:profiles(id, full_name, email, employment_status, avatar_url)),
          photos:job_photos(*),
          items:job_items(*)
        `)
        .is('deleted_at', null) // Exclude soft-deleted items
        .order('created_at', { ascending: false });
      
      if (!includeArchived) {
        query = query.is('archived_at', null);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      // Filter out soft-deleted photos from each job
      return (data as Job[]).map(job => ({
        ...job,
        photos: job.photos?.filter((p: any) => !p.deleted_at) || []
      }));
    },
    enabled: !!profile?.company_id,
  });
}

export function useJob(jobId: string | null) {
  return useQuery({
    queryKey: ['job', jobId],
    queryFn: async () => {
      if (!jobId) return null;
      const { data, error } = await (supabase as any)
        .from('jobs')
        .select(`
          *,
          customer:customers(name, email, phone, address, city, state, zip),
          assignee:profiles!jobs_assigned_to_fkey(full_name, employment_status, avatar_url),
          assignees:job_assignees(id, job_id, profile_id, created_at, profile:profiles(id, full_name, email, employment_status, avatar_url)),
          photos:job_photos(*),
          items:job_items(*)
        `)
        .eq('id', jobId)
        .single();
      
      if (error) throw error;
      
      // Filter out soft-deleted photos
      return {
        ...data,
        photos: data.photos?.filter((p: any) => !p.deleted_at) || []
      } as Job;
    },
    enabled: !!jobId,
  });
}

export function useCreateJob() {
  const queryClient = useQueryClient();
  const { profile, user } = useAuth();
  
  return useMutation({
    mutationFn: async (jobData: {
      customer_id: string;
      quote_id?: string | null;
      assigned_to?: string | null;
      assignee_ids?: string[];
      status?: Job['status'];
      priority?: Job['priority'];
      title: string;
      description?: string | null;
      scheduled_start?: string | null;
      scheduled_end?: string | null;
      notes?: string | null;
      items?: { description: string; item_description?: string | null; quantity: number; unit_price: number; type?: 'product' | 'service' }[];
    }) => {
      if (!profile?.company_id) throw new Error('No company ID');
      
      // Validate job data
      const validation = jobSchema.safeParse(jobData);
      if (!validation.success) {
        const firstError = validation.error.errors[0];
        throw new Error(firstError?.message || 'Validation failed');
      }
      
      // Generate job number
      const { data: jobNumberData, error: jobNumberError } = await (supabase as any)
        .rpc('generate_job_number', { p_company_id: profile.company_id });
      
      if (jobNumberError) throw jobNumberError;
      
      // Fetch company tax rate
      const { data: company } = await (supabase as any)
        .from('companies')
        .select('tax_rate')
        .eq('id', profile.company_id)
        .single();
      
      const taxRate = (company?.tax_rate ?? 8.25) / 100;
      
      // Calculate totals from items
      const items = jobData.items || [];
      const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
      const discountAmount = calculateDiscountAmount(subtotal, (validation.data as any).discount_type, (validation.data as any).discount_value);
      const afterDiscount = subtotal - discountAmount;
      const tax = afterDiscount * taxRate;
      const total = afterDiscount + tax;
      
      // Use first assignee for backwards compatibility with assigned_to column
      const assigneeIds = jobData.assignee_ids || [];
      const primaryAssignee = assigneeIds.length > 0 ? assigneeIds[0] : (jobData.assigned_to || null);
      
      const { data, error } = await (supabase as any)
        .from('jobs')
        .insert({
          ...validation.data,
          assigned_to: primaryAssignee,
          company_id: profile.company_id,
          job_number: jobNumberData,
          created_by: user?.id,
          subtotal,
          tax,
          total,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // Insert job assignees
      if (assigneeIds.length > 0) {
        const { error: assigneesError } = await (supabase as any)
          .from('job_assignees')
          .insert(
            assigneeIds.map(profileId => ({
              job_id: data.id,
              profile_id: profileId,
            }))
          );
        
        if (assigneesError) throw assigneesError;
      }
      
      // Insert job items if any
      if (items.length > 0) {
        const { error: itemsError } = await (supabase as any)
          .from('job_items')
          .insert(
            items.map(item => ({
              job_id: data.id,
              description: item.description,
              item_description: item.item_description || null,
              quantity: item.quantity,
              unit_price: item.unit_price,
              total: item.quantity * item.unit_price,
              type: item.type || 'service',
            }))
          );
        
        if (itemsError) throw itemsError;
      }
      
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Job created successfully');
    },
    onError: (error: unknown) => {
      toast.error('Failed to create job: ' + sanitizeErrorMessage(error));
    },
  });
}

export function useUpdateJob() {
  const queryClient = useQueryClient();
  
  return useMutation({
    // Note: items here is the simplified form for input, not the full JobItem type
    mutationFn: async ({ id, items, assignee_ids, ...updates }: Omit<Partial<Job>, 'items' | 'assignees'> & { id: string; items?: { description: string; item_description?: string | null; quantity: number; unit_price: number; type?: 'product' | 'service' }[]; assignee_ids?: string[] }) => {
      // Calculate totals if items are provided
      if (items !== undefined) {
        // Fetch job to get company_id, then fetch tax rate
        const { data: job } = await (supabase as any)
          .from('jobs')
          .select('company_id')
          .eq('id', id)
          .single();
        
        const { data: company } = await (supabase as any)
          .from('companies')
          .select('tax_rate')
          .eq('id', job?.company_id)
          .single();
        
        const taxRate = (company?.tax_rate ?? 8.25) / 100;
        
        const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
        const discountAmount = calculateDiscountAmount(subtotal, (updates as any).discount_type, (updates as any).discount_value);
        const afterDiscount = subtotal - discountAmount;
        const tax = afterDiscount * taxRate;
        const total = afterDiscount + tax;
        
        (updates as any).subtotal = subtotal;
        (updates as any).tax = tax;
        (updates as any).total = total;
        
        // Delete existing items and insert new ones
        await (supabase as any)
          .from('job_items')
          .delete()
          .eq('job_id', id);
        
        if (items.length > 0) {
          const { error: itemsError } = await (supabase as any)
            .from('job_items')
            .insert(
              items.map(item => ({
                job_id: id,
                description: item.description,
                item_description: item.item_description || null,
                quantity: item.quantity,
                unit_price: item.unit_price,
                total: item.quantity * item.unit_price,
                type: item.type || 'service',
              }))
            );
          
          if (itemsError) throw itemsError;
        }
      }
      
      // Update assignees if provided
      if (assignee_ids !== undefined) {
        // Update primary assignee for backwards compatibility
        (updates as any).assigned_to = assignee_ids.length > 0 ? assignee_ids[0] : null;
        
        // Delete existing assignees and insert new ones
        await (supabase as any)
          .from('job_assignees')
          .delete()
          .eq('job_id', id);
        
        if (assignee_ids.length > 0) {
          const { error: assigneesError } = await (supabase as any)
            .from('job_assignees')
            .insert(
              assignee_ids.map(profileId => ({
                job_id: id,
                profile_id: profileId,
              }))
            );
          
          if (assigneesError) throw assigneesError;
        }
      }
      
      const { error } = await (supabase as any)
        .from('jobs')
        .update(updates)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job'] });
      toast.success('Job updated successfully');
    },
    onError: (error: unknown) => {
      toast.error('Failed to update job: ' + sanitizeErrorMessage(error));
    },
  });
}

export function useDeleteJob() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (jobId: string) => {
      // Soft delete - set deleted_at timestamp
      const { error } = await (supabase as any)
        .from('jobs')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', jobId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Job deleted successfully');
    },
    onError: (error: unknown) => {
      toast.error('Failed to delete job: ' + sanitizeErrorMessage(error));
    },
  });
}

export function useUploadJobPhoto() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  
  return useMutation({
    mutationFn: async ({ 
      jobId, 
      file, 
      photoType, 
      caption 
    }: { 
      jobId: string; 
      file: File; 
      photoType: 'before' | 'after' | 'other';
      caption?: string;
    }) => {
      // Compress image to ~300KB before upload
      const compressedBlob = await compressImage(file, 300);
      const compressedFile = new File(
        [compressedBlob], 
        file.name.replace(/\.[^/.]+$/, '') + '.jpg', 
        { type: 'image/jpeg' }
      );
      
      // Upload compressed image to storage
      const fileName = `${user?.id}/${jobId}/${Date.now()}-${compressedFile.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('job-photos')
        .upload(fileName, compressedFile);
      
      if (uploadError) throw uploadError;
      
      // Get signed URL since bucket is now private
      const { data: signedUrlData, error: signedUrlError } = await supabase.storage
        .from('job-photos')
        .createSignedUrl(fileName, 3600 * 24 * 7); // 7 days expiry
      
      if (signedUrlError) throw signedUrlError;
      const photoUrl = signedUrlData?.signedUrl || '';
      
      // Save to database (store the file path, not the signed URL)
      const { data, error } = await (supabase as any)
        .from('job_photos')
        .insert({
          job_id: jobId,
          photo_url: fileName, // Store path instead of signed URL
          photo_type: photoType,
          caption,
          uploaded_by: user?.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      return { ...data, photo_url: photoUrl, jobId }; // Return with signed URL for immediate display
    },
    onMutate: async ({ jobId, file, photoType }) => {
      // Cancel any outgoing refetches to prevent race conditions
      await queryClient.cancelQueries({ queryKey: ['job', jobId] });
      
      // Create a temporary local URL for immediate display
      const tempUrl = URL.createObjectURL(file);
      const tempId = `temp-${Date.now()}`;
      
      // Save previous state for rollback
      const previousJob = queryClient.getQueryData(['job', jobId]);
      
      // Optimistically add the photo with temp URL for instant feedback
      queryClient.setQueryData(['job', jobId], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          photos: [...(old.photos || []), {
            id: tempId,
            photo_url: tempUrl,
            photo_type: photoType,
            caption: null,
            created_at: new Date().toISOString(),
            _isOptimistic: true, // Mark as temporary
          }]
        };
      });
      
      return { previousJob, tempId, tempUrl, jobId };
    },
    onSuccess: (result, variables, context) => {
      // Replace temporary photo with real one from server
      queryClient.setQueryData(['job', result.jobId], (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          photos: oldData.photos?.map((p: any) => 
            p.id === context?.tempId 
              ? {
                  id: result.id,
                  photo_url: result.photo_url,
                  photo_type: result.photo_type,
                  caption: result.caption || null,
                  created_at: result.created_at,
                }
              : p
          ) || []
        };
      });
      
      // Revoke the temporary object URL to free memory
      if (context?.tempUrl) {
        URL.revokeObjectURL(context.tempUrl);
      }
      
      // Background refresh for consistency
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Photo uploaded successfully');
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousJob && context?.jobId) {
        queryClient.setQueryData(['job', context.jobId], context.previousJob);
      }
      // Revoke temp URL on error too
      if (context?.tempUrl) {
        URL.revokeObjectURL(context.tempUrl);
      }
      toast.error('Failed to upload photo: ' + sanitizeErrorMessage(err));
    },
  });
}

export function useDeleteJobPhoto() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ photoId, jobId }: { photoId: string; jobId?: string }) => {
      // Soft delete - set deleted_at timestamp (keep file in storage for recovery)
      const { error } = await (supabase as any)
        .from('job_photos')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', photoId);
      
      if (error) throw error;
      return { photoId, jobId };
    },
    onMutate: async ({ photoId, jobId }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['job', jobId] });
      await queryClient.cancelQueries({ queryKey: ['jobs'] });
      
      // Snapshot for rollback
      const previousJob = jobId ? queryClient.getQueryData(['job', jobId]) : null;
      
      // Optimistically remove photo from cache
      if (jobId) {
        queryClient.setQueryData(['job', jobId], (old: any) => {
          if (!old) return old;
          return {
            ...old,
            photos: old.photos?.filter((p: any) => p.id !== photoId) || []
          };
        });
      }
      
      return { previousJob, jobId };
    },
    onError: (err, variables, context) => {
      // Rollback on error
      if (context?.previousJob && context?.jobId) {
        queryClient.setQueryData(['job', context.jobId], context.previousJob);
      }
      toast.error('Failed to delete photo: ' + sanitizeErrorMessage(err));
    },
    onSuccess: (result) => {
      toast.success('Photo deleted');
      // Invalidate to sync with realtime - the realtime subscription will update the cache
      if (result.jobId) {
        queryClient.invalidateQueries({ queryKey: ['job', result.jobId] });
        queryClient.invalidateQueries({ queryKey: ['job-photos', result.jobId] });
      }
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
    },
  });
}

export function useUpdateJobPhotoType() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ photoId, photoType, jobId }: { photoId: string; photoType: 'before' | 'after' | 'other'; jobId?: string }) => {
      const { error } = await (supabase as any)
        .from('job_photos')
        .update({ photo_type: photoType })
        .eq('id', photoId);
      
      if (error) throw error;
      return { photoId, photoType, jobId };
    },
    onMutate: async ({ photoId, photoType, jobId }) => {
      await queryClient.cancelQueries({ queryKey: ['job', jobId] });
      
      const previousJob = jobId ? queryClient.getQueryData(['job', jobId]) : null;
      
      // Optimistically update photo type
      if (jobId) {
        queryClient.setQueryData(['job', jobId], (old: any) => {
          if (!old) return old;
          return {
            ...old,
            photos: old.photos?.map((p: any) => 
              p.id === photoId ? { ...p, photo_type: photoType } : p
            ) || []
          };
        });
      }
      
      return { previousJob, jobId };
    },
    onError: (err, variables, context) => {
      if (context?.previousJob && context?.jobId) {
        queryClient.setQueryData(['job', context.jobId], context.previousJob);
      }
      toast.error('Failed to update photo category: ' + sanitizeErrorMessage(err));
    },
    onSuccess: (result) => {
      toast.success('Photo category updated');
      // Invalidate to sync with realtime - the realtime subscription will update the cache
      if (result.jobId) {
        queryClient.invalidateQueries({ queryKey: ['job', result.jobId] });
        queryClient.invalidateQueries({ queryKey: ['job-photos', result.jobId] });
      }
    },
  });
}

export function useArchiveJob() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (jobId: string) => {
      const { error } = await (supabase as any)
        .from('jobs')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', jobId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job'] });
      toast.success('Job archived');
    },
    onError: (error: unknown) => {
      toast.error('Failed to archive job: ' + sanitizeErrorMessage(error));
    },
  });
}

export function useUnarchiveJob() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (jobId: string) => {
      const { error } = await (supabase as any)
        .from('jobs')
        .update({ archived_at: null })
        .eq('id', jobId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job'] });
      toast.success('Job unarchived');
    },
    onError: (error: unknown) => {
      toast.error('Failed to unarchive job: ' + sanitizeErrorMessage(error));
    },
  });
}

export function useImportQuoteToJob() {
  const { profile, user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (quoteId: string) => {
      if (!profile?.company_id) throw new Error('No company ID');
      
      // Get quote details with items
      const { data: quote, error: quoteError } = await (supabase as any)
        .from('quotes')
        .select('*, items:quote_items(*)')
        .eq('id', quoteId)
        .single();
      
      if (quoteError) throw quoteError;
      
      // Generate job number
      const { data: jobNumber, error: jobNumberError } = await (supabase as any)
        .rpc('generate_job_number', { p_company_id: profile.company_id });
      
      if (jobNumberError) throw jobNumberError;
      
      // Fetch company tax rate
      const { data: company } = await (supabase as any)
        .from('companies')
        .select('tax_rate')
        .eq('id', profile.company_id)
        .single();
      
      const taxRate = (company?.tax_rate ?? 8.25) / 100;
      
      // Calculate totals from quote items
      const quoteItems = quote.items || [];
      const subtotal = quoteItems.reduce((sum: number, item: any) => sum + (item.quantity * item.unit_price), 0);
      const tax = subtotal * taxRate;
      const total = subtotal + tax;
      
      // Create job from quote
      const { data: job, error: jobError } = await (supabase as any)
        .from('jobs')
        .insert({
          company_id: profile.company_id,
          job_number: jobNumber,
          customer_id: quote.customer_id,
          quote_id: quoteId,
          title: `Job from Quote ${quote.quote_number}`,
          description: quote.notes,
          status: 'draft',
          priority: 'medium',
          created_by: user?.id,
          subtotal,
          tax,
          total,
        })
        .select()
        .single();
      
      if (jobError) throw jobError;
      
      // Copy quote items to job items
      if (quoteItems.length > 0) {
        const { error: itemsError } = await (supabase as any)
          .from('job_items')
          .insert(
            quoteItems.map((item: any) => ({
              job_id: job.id,
              description: item.description,
              item_description: item.item_description || null,
              quantity: item.quantity,
              unit_price: item.unit_price,
              total: item.quantity * item.unit_price,
              type: item.type || 'service',
            }))
          );
        
        if (itemsError) throw itemsError;
      }
      
      return job;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      toast.success('Job created from quote');
    },
    onError: (error: unknown) => {
      toast.error('Failed to import quote: ' + sanitizeErrorMessage(error));
    },
  });
}

export function useConvertJobToInvoice() {
  const { profile, user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ job, copyPhotos = true }: { job: Job; copyPhotos?: boolean }) => {
      if (!profile?.company_id) throw new Error('No company ID');
      
      // First, check for job items
      let items: { description: string; item_description?: string | null; quantity: number; unit_price: number; type?: 'product' | 'service' }[] = [];
      
      if (job.items && job.items.length > 0) {
        // Use job items
        items = job.items.map(item => ({
          description: item.description,
          item_description: (item as any).item_description || null,
          quantity: item.quantity,
          unit_price: item.unit_price,
          type: (item as any).type || 'service',
        }));
      } else if (job.quote_id) {
        // Fall back to quote items if job has no items but has a linked quote
        const { data: quoteItems, error: quoteItemsError } = await (supabase as any)
          .from('quote_items')
          .select('*')
          .eq('quote_id', job.quote_id);
        
        if (!quoteItemsError && quoteItems && quoteItems.length > 0) {
          items = quoteItems.map((item: any) => ({
            description: item.description,
            item_description: item.item_description || null,
            quantity: item.quantity,
            unit_price: item.unit_price,
            type: item.type || 'service',
          }));
        }
      }
      
      // If no items found, create a default line item
      if (items.length === 0) {
        items = [{
          description: job.title,
          item_description: null,
          quantity: 1,
          unit_price: 0,
          type: 'service',
        }];
      }
      
      // Generate invoice number using database function
      const { data: invoiceNumberData, error: invoiceNumberError } = await (supabase as any)
        .rpc('generate_invoice_number', { p_company_id: profile.company_id });
      
      if (invoiceNumberError) throw invoiceNumberError;
      const invoiceNumber = invoiceNumberData;
      
      // Fetch company tax rate
      const { data: company } = await (supabase as any)
        .from('companies')
        .select('tax_rate')
        .eq('id', profile.company_id)
        .single();
      
      const taxRate = (company?.tax_rate ?? 8.25) / 100;
      
      // Calculate totals
      const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
      const tax = subtotal * taxRate;
      const total = subtotal + tax;
      
      // Create invoice
      const { data: invoice, error: invoiceError } = await (supabase as any)
        .from('invoices')
        .insert({
          company_id: profile.company_id,
          customer_id: job.customer_id,
          quote_id: job.quote_id,
          job_id: job.id,
          invoice_number: invoiceNumber,
          status: 'draft',
          subtotal,
          tax,
          total,
          notes: `Invoice for Job ${job.job_number}`,
          created_by: user?.id,
        })
        .select()
        .single();
      
      if (invoiceError) throw invoiceError;
      
      // Create invoice items
      if (items.length > 0) {
        const { error: itemsError } = await (supabase as any)
          .from('invoice_items')
          .insert(
            items.map(item => ({
              invoice_id: invoice.id,
              description: item.description,
              item_description: item.item_description || null,
              quantity: item.quantity,
              unit_price: item.unit_price,
              total: item.quantity * item.unit_price,
              type: item.type || 'service',
            }))
          );
        
        if (itemsError) throw itemsError;
      }
      
      // Copy job photos to invoice using media asset linking (no file duplication!)
      if (copyPhotos) {
        // Use the database function to copy links - this only duplicates link records, not files
        await supabase.rpc('copy_document_media_links', {
          p_source_entity_type: 'job',
          p_source_entity_id: job.id,
          p_target_entity_type: 'invoice',
          p_target_entity_id: invoice.id,
        });
      }
      
      // Update job status to invoiced
      const { error: updateError } = await (supabase as any)
        .from('jobs')
        .update({ status: 'invoiced' })
        .eq('id', job.id);
      
      if (updateError) throw updateError;
      
      // Log activity
      await supabase
        .from('job_activities')
        .insert({
          job_id: job.id,
          company_id: profile.company_id,
          activity_type: 'invoice_created',
          new_value: invoice.invoice_number,
          related_document_id: invoice.id,
          performed_by: user?.id,
        });
      
      return invoice;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      toast.success('Invoice created from job');
    },
    onError: (error: unknown) => {
      toast.error('Failed to convert job to invoice: ' + sanitizeErrorMessage(error));
    },
  });
}

export function useConvertJobToQuote() {
  const { profile, user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (job: Job) => {
      if (!profile?.company_id) throw new Error('No company ID');
      
      // Get job items
      let items: { description: string; quantity: number; unit_price: number }[] = [];
      
      if (job.items && job.items.length > 0) {
        items = job.items.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
        }));
      }
      
      // If no items, create a default line item
      if (items.length === 0) {
        items = [{
          description: job.title,
          quantity: 1,
          unit_price: 0,
        }];
      }
      
      // Generate quote number
      const { data: quoteNumberData, error: quoteNumberError } = await (supabase as any)
        .rpc('generate_quote_number', { p_company_id: profile.company_id });
      
      if (quoteNumberError) throw quoteNumberError;
      
      // Fetch company tax rate
      const { data: company } = await (supabase as any)
        .from('companies')
        .select('tax_rate')
        .eq('id', profile.company_id)
        .single();
      
      const taxRate = (company?.tax_rate ?? 8.25) / 100;
      
      // Calculate totals
      const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
      const tax = subtotal * taxRate;
      const total = subtotal + tax;
      
      // Create quote with job_id reference (child quote)
      const { data: quote, error: quoteError } = await (supabase as any)
        .from('quotes')
        .insert({
          company_id: profile.company_id,
          customer_id: job.customer_id,
          quote_number: quoteNumberData,
          status: 'draft',
          subtotal,
          tax,
          total,
          notes: `Quote from Job ${job.job_number}`,
          created_by: user?.id,
          job_id: job.id, // Link as child quote instead of updating job.quote_id
        })
        .select()
        .single();
      
      if (quoteError) throw quoteError;
      
      // Create quote items
      if (items.length > 0) {
        const { error: itemsError } = await (supabase as any)
          .from('quote_items')
          .insert(
            items.map(item => ({
              quote_id: quote.id,
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
              total: item.quantity * item.unit_price,
            }))
          );
        
        if (itemsError) throw itemsError;
      }
      // Log activity
      await supabase
        .from('job_activities')
        .insert({
          job_id: job.id,
          company_id: profile.company_id,
          activity_type: 'quote_created',
          new_value: quote.quote_number,
          related_document_id: quote.id,
          performed_by: user?.id,
        });
      
      return quote;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['job-related-quotes'] });
      toast.success('Quote created from job');
    },
    onError: (error: unknown) => {
      toast.error('Failed to create quote from job: ' + sanitizeErrorMessage(error));
    },
  });
}

// Fetch related quotes for a job (origin quote + child/upsell quotes)
export function useJobRelatedQuotes(jobId: string | null, originQuoteId: string | null) {
  return useQuery({
    queryKey: ['job-related-quotes', jobId, originQuoteId],
    queryFn: async () => {
      // Get origin quote (parent - the quote that created this job)
      let originQuote = null;
      if (originQuoteId) {
        const { data, error } = await (supabase as any)
          .from('quotes')
          .select('*, items:quote_items(*), customer:customers(name)')
          .eq('id', originQuoteId)
          .single();
        
        if (!error) {
          originQuote = data;
        }
      }
      
      // Get child quotes (upsells created from this job via job_id)
      let childQuotes: any[] = [];
      if (jobId) {
        const { data, error } = await (supabase as any)
          .from('quotes')
          .select('*, items:quote_items(*), customer:customers(name)')
          .eq('job_id', jobId)
          .order('created_at', { ascending: false });
        
        if (!error && data) {
          childQuotes = data;
        }
      }
      
      return { originQuote, childQuotes };
    },
    enabled: !!jobId || !!originQuoteId,
  });
}

// Create job from quote with selected items only
export function useCreateJobFromQuoteItems() {
  const { profile, user } = useAuth();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ quoteId, selectedItemIds, copyPhotos = true }: { quoteId: string; selectedItemIds: string[]; copyPhotos?: boolean }) => {
      if (!profile?.company_id) throw new Error('No company ID');
      
      // Get quote details with items
      const { data: quote, error: quoteError } = await (supabase as any)
        .from('quotes')
        .select('*, items:quote_items(*)')
        .eq('id', quoteId)
        .single();
      
      if (quoteError) throw quoteError;
      
      // Filter to selected items only
      const selectedItems = (quote.items || []).filter((item: any) => selectedItemIds.includes(item.id));
      
      if (selectedItems.length === 0) {
        throw new Error('No items selected');
      }
      
      // Generate job number
      const { data: jobNumber, error: jobNumberError } = await (supabase as any)
        .rpc('generate_job_number', { p_company_id: profile.company_id });
      
      if (jobNumberError) throw jobNumberError;
      
      // Fetch company tax rate
      const { data: company } = await (supabase as any)
        .from('companies')
        .select('tax_rate')
        .eq('id', profile.company_id)
        .single();
      
      const taxRate = (company?.tax_rate ?? 8.25) / 100;
      
      // Calculate totals from selected items
      const subtotal = selectedItems.reduce((sum: number, item: any) => sum + (item.quantity * item.unit_price), 0);
      const tax = subtotal * taxRate;
      const total = subtotal + tax;
      
      // Create job from quote
      const { data: job, error: jobError } = await (supabase as any)
        .from('jobs')
        .insert({
          company_id: profile.company_id,
          job_number: jobNumber,
          customer_id: quote.customer_id,
          quote_id: quoteId,
          title: `Job from Quote ${quote.quote_number}`,
          description: quote.notes,
          status: 'draft',
          priority: 'medium',
          created_by: user?.id,
          subtotal,
          tax,
          total,
        })
        .select()
        .single();
      
      if (jobError) throw jobError;
      
      // Copy selected quote items to job items
      if (selectedItems.length > 0) {
        const { error: itemsError } = await (supabase as any)
          .from('job_items')
          .insert(
            selectedItems.map((item: any) => ({
              job_id: job.id,
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
              total: item.quantity * item.unit_price,
            }))
          );
        
        if (itemsError) throw itemsError;
      }
      
      // Copy quote photos to job using media asset linking (no file duplication!)
      if (copyPhotos) {
        // Use the database function to copy links - this only duplicates link records, not files
        await supabase.rpc('copy_document_media_links', {
          p_source_entity_type: 'quote',
          p_source_entity_id: quoteId,
          p_target_entity_type: 'job',
          p_target_entity_id: job.id,
        });
      }
      
      return job;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      toast.success('Job created from selected quote items');
    },
    onError: (error: unknown) => {
      toast.error('Failed to create job: ' + sanitizeErrorMessage(error));
    },
  });
}

// Add quote items to an existing job
export function useAddQuoteItemsToJob() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ quoteId, jobId, selectedItemIds }: { quoteId: string; jobId: string; selectedItemIds: string[] }) => {
      // Get quote items
      const { data: quoteItems, error: quoteError } = await (supabase as any)
        .from('quote_items')
        .select('*')
        .eq('quote_id', quoteId);
      
      if (quoteError) throw quoteError;
      
      // Filter to selected items only
      const selectedItems = (quoteItems || []).filter((item: any) => selectedItemIds.includes(item.id));
      
      if (selectedItems.length === 0) {
        throw new Error('No items selected');
      }
      
      // Get current job to update totals
      const { data: job, error: jobError } = await (supabase as any)
        .from('jobs')
        .select('subtotal, tax, total')
        .eq('id', jobId)
        .single();
      
      if (jobError) throw jobError;
      
      // Add new items to job
      const { error: insertError } = await (supabase as any)
        .from('job_items')
        .insert(
          selectedItems.map((item: any) => ({
            job_id: jobId,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total: item.quantity * item.unit_price,
          }))
        );
      
      if (insertError) throw insertError;
      
      // Fetch company tax rate from job's company
      const { data: jobData } = await (supabase as any)
        .from('jobs')
        .select('company_id')
        .eq('id', jobId)
        .single();
      
      const { data: company } = await (supabase as any)
        .from('companies')
        .select('tax_rate')
        .eq('id', jobData?.company_id)
        .single();
      
      const taxRate = (company?.tax_rate ?? 8.25) / 100;
      
      // Update job totals
      const addedSubtotal = selectedItems.reduce((sum: number, item: any) => sum + (item.quantity * item.unit_price), 0);
      const newSubtotal = (job.subtotal || 0) + addedSubtotal;
      const newTax = newSubtotal * taxRate;
      const newTotal = newSubtotal + newTax;
      
      const { error: updateError } = await (supabase as any)
        .from('jobs')
        .update({ subtotal: newSubtotal, tax: newTax, total: newTotal })
        .eq('id', jobId);
      
      if (updateError) throw updateError;
      
      return { jobId, itemsAdded: selectedItems.length };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job'] });
      toast.success(`Added ${data.itemsAdded} items to job`);
    },
    onError: (error: unknown) => {
      toast.error('Failed to add items to job: ' + sanitizeErrorMessage(error));
    },
  });
}
