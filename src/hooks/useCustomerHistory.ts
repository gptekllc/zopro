import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface JobPhoto {
  id: string;
  photo_url: string;
  photo_type: 'before' | 'after' | 'other';
  caption: string | null;
  created_at: string;
}

export interface JobItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface CustomerJob {
  id: string;
  job_number: string;
  title: string;
  description: string | null;
  status: 'draft' | 'scheduled' | 'in_progress' | 'completed' | 'invoiced' | 'paid';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  scheduled_start: string | null;
  scheduled_end: string | null;
  actual_start: string | null;
  actual_end: string | null;
  created_at: string;
  assigned_to: string | null;
  notes: string | null;
  archived_at: string | null;
  customer_id: string;
  quote_id: string | null;
  subtotal: number | null;
  tax: number | null;
  total: number | null;
  discount_type: string | null;
  discount_value: number | null;
  labor_hourly_rate: number | null;
  assignee?: { full_name: string | null } | null;
  completion_signature_id?: string | null;
  completion_signed_at?: string | null;
  completion_signed_by?: string | null;
  photos?: JobPhoto[];
  items?: JobItem[];
}

export interface CustomerQuote {
  id: string;
  quote_number: string;
  status: string;
  subtotal: number;
  tax: number;
  total: number;
  valid_until: string | null;
  signed_at: string | null;
  created_at: string;
  notes: string | null;
  signature_id: string | null;
  discount_type: string | null;
  discount_value: number | null;
  items?: QuoteItem[];
}

export interface QuoteItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface CustomerInvoice {
  id: string;
  invoice_number: string;
  status: string;
  subtotal: number;
  tax: number;
  total: number;
  discount_type: string | null;
  discount_value: number | null;
  late_fee_amount: number | null;
  late_fee_applied_at: string | null;
  due_date: string | null;
  paid_at: string | null;
  created_at: string;
  notes: string | null;
  signed_at: string | null;
  signature_id: string | null;
  items?: InvoiceItem[];
  job?: { job_number: string } | null;
  quote?: { job?: { job_number: string } | null } | null;
}

export interface InvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

export interface CustomerStats {
  totalJobs: number;
  completedJobs: number;
  totalQuotes: number;
  approvedQuotes: number;
  totalInvoices: number;
  paidInvoices: number;
  lifetimeValue: number;
  outstandingBalance: number;
}

export interface ActivityItem {
  id: string;
  type: 'job' | 'quote' | 'invoice';
  title: string;
  status: string;
  date: string;
  amount?: number;
  signed?: boolean;
}

export function useCustomerJobs(customerId: string | undefined) {
  return useQuery({
    queryKey: ['customer-jobs', customerId],
    queryFn: async () => {
      if (!customerId) return [];
      
      const { data, error } = await supabase
        .from('jobs')
        .select(`
          id,
          job_number,
          title,
          description,
          status,
          priority,
          scheduled_start,
          scheduled_end,
          actual_start,
          actual_end,
          created_at,
          assigned_to,
          notes,
          customer_id,
          quote_id,
          subtotal,
          tax,
          total,
          discount_type,
          discount_value,
          labor_hourly_rate,
          completion_signature_id,
          completion_signed_at,
          completion_signed_by,
          assignee:profiles!jobs_assigned_to_fkey(full_name),
          photos:job_photos(id, photo_url, photo_type, caption, created_at),
          items:job_items(id, description, quantity, unit_price, total)
        `)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as CustomerJob[];
    },
    enabled: !!customerId,
  });
}

export function useCustomerQuotes(customerId: string | undefined) {
  return useQuery({
    queryKey: ['customer-quotes', customerId],
    queryFn: async () => {
      if (!customerId) return [];
      
      const { data, error } = await supabase
        .from('quotes')
        .select(`
          id,
          quote_number,
          status,
          subtotal,
          tax,
          total,
          valid_until,
          signed_at,
          created_at,
          notes,
          signature_id,
          items:quote_items(id, description, quantity, unit_price, total)
        `)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as CustomerQuote[];
    },
    enabled: !!customerId,
  });
}

export function useCustomerInvoices(customerId: string | undefined) {
  return useQuery({
    queryKey: ['customer-invoices', customerId],
    queryFn: async () => {
      if (!customerId) return [];
      
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          id,
          invoice_number,
          status,
          subtotal,
          tax,
          total,
          discount_type,
          discount_value,
          late_fee_amount,
          late_fee_applied_at,
          due_date,
          paid_at,
          created_at,
          notes,
          signed_at,
          signature_id,
          items:invoice_items(id, description, quantity, unit_price, total),
          job:jobs!invoices_job_id_fkey(job_number),
          quote:quotes(job:jobs!quotes_job_id_fkey(job_number))
        `)
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as CustomerInvoice[];
    },
    enabled: !!customerId,
  });
}

export function useCustomerStats(customerId: string | undefined) {
  const { data: jobs = [] } = useCustomerJobs(customerId);
  const { data: quotes = [] } = useCustomerQuotes(customerId);
  const { data: invoices = [] } = useCustomerInvoices(customerId);

  const stats: CustomerStats = {
    totalJobs: jobs.length,
    completedJobs: jobs.filter(j => ['completed', 'invoiced', 'paid'].includes(j.status)).length,
    totalQuotes: quotes.length,
    approvedQuotes: quotes.filter(q => q.status === 'approved' || q.signed_at).length,
    totalInvoices: invoices.length,
    paidInvoices: invoices.filter(i => i.status === 'paid').length,
    lifetimeValue: invoices.filter(i => i.status === 'paid').reduce((sum, i) => sum + Number(i.total) + Number(i.late_fee_amount || 0), 0),
    outstandingBalance: invoices.filter(i => i.status !== 'paid' && i.status !== 'draft').reduce((sum, i) => sum + Number(i.total) + Number(i.late_fee_amount || 0), 0),
  };

  return stats;
}

export function useCustomerActivity(customerId: string | undefined) {
  const { data: jobs = [] } = useCustomerJobs(customerId);
  const { data: quotes = [] } = useCustomerQuotes(customerId);
  const { data: invoices = [] } = useCustomerInvoices(customerId);

  const activities: ActivityItem[] = [
    ...jobs.map(j => ({
      id: j.id,
      type: 'job' as const,
      title: `${j.job_number} - ${j.title}`,
      status: j.status,
      date: j.created_at,
      signed: !!j.completion_signed_at,
    })),
    ...quotes.map(q => ({
      id: q.id,
      type: 'quote' as const,
      title: q.quote_number,
      status: q.status,
      date: q.created_at,
      amount: Number(q.total),
      signed: !!q.signed_at,
    })),
    ...invoices.map(i => ({
      id: i.id,
      type: 'invoice' as const,
      title: i.invoice_number,
      status: i.status,
      date: i.created_at,
      amount: Number(i.total),
      signed: !!i.signed_at,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return activities;
}
