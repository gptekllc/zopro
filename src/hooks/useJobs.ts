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
  discount_type: 'amount' | 'percentage' | null;
  discount_value: number | null;
  estimated_duration?: number | null;
  customer?: { name: string; email: string | null; phone: string | null; address: string | null; city: string | null; state: string | null; zip: string | null };
  assignee?: { full_name: string | null; employment_status?: string | null };
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
          customer:customers(name, email, phone, address, city, state, zip),
          assignee:profiles!jobs_assigned_to_fkey(full_name, employment_status),
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
          customer:customers(name, email, phone, address, city, state, zip),
          assignee:profiles!jobs_assigned_to_fkey(full_name, employment_status),
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
      // First, get the photo record to find the storage path
      const { data: photo, error: fetchError } = await (supabase as any)
        .from('job_photos')
        .select('photo_url')
        .eq('id', photoId)
        .single();
      
      if (fetchError) throw fetchError;
      
      // Delete the file from storage if we have a path
      if (photo?.photo_url) {
        const { error: storageError } = await supabase.storage
          .from('job-photos')
          .remove([photo.photo_url]);
        
        if (storageError) {
          console.error('Failed to delete storage file:', storageError);
          // Continue with DB deletion even if storage deletion fails
        }
      }
      
      // Delete the database record
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
    mutationFn: async ({ quoteId, selectedItemIds }: { quoteId: string; selectedItemIds: string[] }) => {
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
        .rpc('generate_job_number', { _company_id: profile.company_id });
      
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
