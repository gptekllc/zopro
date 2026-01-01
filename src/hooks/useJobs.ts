import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { toast } from 'sonner';
import { jobSchema, sanitizeErrorMessage } from '@/lib/validation';
import { compressImage } from '@/lib/imageCompression';
import { useEffect } from 'react';

export interface JobItem {
  id: string;
  job_id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
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
  customer?: { name: string; email: string | null; phone: string | null; address: string | null };
  assignee?: { full_name: string | null };
  photos?: JobPhoto[];
  items?: JobItem[];
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
          photos:job_photos(*),
          items:job_items(*)
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
          photos:job_photos(*),
          items:job_items(*)
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
      items?: { description: string; quantity: number; unit_price: number }[];
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
      
      // Calculate totals from items
      const items = jobData.items || [];
      const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
      const tax = subtotal * 0.0825;
      const total = subtotal + tax;
      
      const { data, error } = await (supabase as any)
        .from('jobs')
        .insert({
          ...validation.data,
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
      
      // Insert job items if any
      if (items.length > 0) {
        const { error: itemsError } = await (supabase as any)
          .from('job_items')
          .insert(
            items.map(item => ({
              job_id: data.id,
              description: item.description,
              quantity: item.quantity,
              unit_price: item.unit_price,
              total: item.quantity * item.unit_price,
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
    mutationFn: async ({ id, items, ...updates }: Omit<Partial<Job>, 'items'> & { id: string; items?: { description: string; quantity: number; unit_price: number }[] }) => {
      // Calculate totals if items are provided
      if (items !== undefined) {
        const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
        const tax = subtotal * 0.0825;
        const total = subtotal + tax;
        
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
                quantity: item.quantity,
                unit_price: item.unit_price,
                total: item.quantity * item.unit_price,
              }))
            );
          
          if (itemsError) throw itemsError;
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
      
      // Get quote details with items
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
      
      // Calculate totals from quote items
      const quoteItems = quote.items || [];
      const subtotal = quoteItems.reduce((sum: number, item: any) => sum + (item.quantity * item.unit_price), 0);
      const tax = subtotal * 0.0825;
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
              quantity: item.quantity,
              unit_price: item.unit_price,
              total: item.quantity * item.unit_price,
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
    mutationFn: async (job: Job) => {
      if (!profile?.company_id) throw new Error('No company ID');
      
      // First, check for job items
      let items: { description: string; quantity: number; unit_price: number }[] = [];
      
      if (job.items && job.items.length > 0) {
        // Use job items
        items = job.items.map(item => ({
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
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
            quantity: item.quantity,
            unit_price: item.unit_price,
          }));
        }
      }
      
      // If no items found, create a default line item
      if (items.length === 0) {
        items = [{
          description: job.title,
          quantity: 1,
          unit_price: 0,
        }];
      }
      
      // Generate invoice number using database function
      const { data: invoiceNumberData, error: invoiceNumberError } = await (supabase as any)
        .rpc('generate_invoice_number', { _company_id: profile.company_id });
      
      if (invoiceNumberError) throw invoiceNumberError;
      const invoiceNumber = invoiceNumberData;
      
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
        .rpc('generate_quote_number', { _company_id: profile.company_id });
      
      if (quoteNumberError) throw quoteNumberError;
      
      // Calculate totals
      const subtotal = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
      const tax = subtotal * 0.0825;
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
