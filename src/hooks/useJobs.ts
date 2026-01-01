import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { jobSchema, sanitizeErrorMessage } from '@/lib/validation';
import { compressImage } from '@/lib/imageCompression';
import { useEffect } from 'react';

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
  customer?: { name: string; email: string | null; phone: string | null; address: string | null };
  assignee?: { full_name: string | null };
  photos?: JobPhoto[];
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
  
  // Auto-archive old jobs on mount
  useAutoArchiveOldJobs();
  
  return useQuery({
    queryKey: ['jobs', profile?.company_id, includeArchived],
    queryFn: async () => {
      let query = (supabase as any)
        .from('jobs')
        .select(`
          *,
          customer:customers(name, email, phone, address),
          assignee:profiles!jobs_assigned_to_fkey(full_name),
          photos:job_photos(*)
        `)
        .order('created_at', { ascending: false });
      
      if (!includeArchived) {
        query = query.is('archived_at', null);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as Job[];
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
          customer:customers(name, email, phone, address),
          assignee:profiles!jobs_assigned_to_fkey(full_name),
          photos:job_photos(*)
        `)
        .eq('id', jobId)
        .single();
      
      if (error) throw error;
      return data as Job;
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
      status?: Job['status'];
      priority?: Job['priority'];
      title: string;
      description?: string | null;
      scheduled_start?: string | null;
      scheduled_end?: string | null;
      notes?: string | null;
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
        .rpc('generate_job_number', { _company_id: profile.company_id });
      
      if (jobNumberError) throw jobNumberError;
      
      const { data, error } = await (supabase as any)
        .from('jobs')
        .insert({
          ...validation.data,
          company_id: profile.company_id,
          job_number: jobNumberData,
          created_by: user?.id,
        })
        .select()
        .single();
      
      if (error) throw error;
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
    mutationFn: async ({ id, ...updates }: Partial<Job> & { id: string }) => {
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
      const { error } = await (supabase as any)
        .from('jobs')
        .delete()
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
      return { ...data, photo_url: photoUrl }; // Return with signed URL for immediate display
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job'] });
      toast.success('Photo uploaded successfully');
    },
    onError: (error: unknown) => {
      toast.error('Failed to upload photo: ' + sanitizeErrorMessage(error));
    },
  });
}

export function useDeleteJobPhoto() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (photoId: string) => {
      const { error } = await (supabase as any)
        .from('job_photos')
        .delete()
        .eq('id', photoId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['job'] });
      toast.success('Photo deleted');
    },
    onError: (error: unknown) => {
      toast.error('Failed to delete photo: ' + sanitizeErrorMessage(error));
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
      
      // Get quote details
      const { data: quote, error: quoteError } = await (supabase as any)
        .from('quotes')
        .select('*, items:quote_items(*)')
        .eq('id', quoteId)
        .single();
      
      if (quoteError) throw quoteError;
      
      // Generate job number
      const { data: jobNumber, error: jobNumberError } = await (supabase as any)
        .rpc('generate_job_number', { _company_id: profile.company_id });
      
      if (jobNumberError) throw jobNumberError;
      
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
        })
        .select()
        .single();
      
      if (jobError) throw jobError;
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
    mutationFn: async (job: Job) => {
      if (!profile?.company_id) throw new Error('No company ID');
      
      // Get quote items if job was created from a quote
      let items: { description: string; quantity: number; unit_price: number }[] = [];
      
      if (job.quote_id) {
        const { data: quoteItems, error: quoteItemsError } = await (supabase as any)
          .from('quote_items')
          .select('*')
          .eq('quote_id', job.quote_id);
        
        if (!quoteItemsError && quoteItems) {
          items = quoteItems.map((item: any) => ({
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
          }));
        }
      }
      
      // If no quote items, create a default line item
      if (items.length === 0) {
        items = [{
          description: job.title,
          quantity: 1,
          unit_price: 0,
        }];
      }
      
      // Get next invoice number
      const { count } = await (supabase as any)
        .from('invoices')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', profile.company_id);
      
      const invoiceNumber = `INV-${String((count || 0) + 1).padStart(3, '0')}`;
      
      // Calculate totals
      const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
      const tax = subtotal * 0.0825;
      const total = subtotal + tax;
      
      // Create invoice
      const { data: invoice, error: invoiceError } = await (supabase as any)
        .from('invoices')
        .insert({
          company_id: profile.company_id,
          customer_id: job.customer_id,
          quote_id: job.quote_id,
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
              quantity: item.quantity,
              unit_price: item.unit_price,
              total: item.quantity * item.unit_price,
            }))
          );
        
        if (itemsError) throw itemsError;
      }
      
      // Update job status to invoiced
      const { error: updateError } = await (supabase as any)
        .from('jobs')
        .update({ status: 'invoiced' })
        .eq('id', job.id);
      
      if (updateError) throw updateError;
      
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
