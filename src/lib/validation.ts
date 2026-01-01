import { z } from 'zod';

// Company validation schema
export const companySchema = z.object({
  name: z.string().min(1, 'Company name is required').max(255, 'Company name must be less than 255 characters'),
  email: z.string().email('Invalid email address').max(255).optional().or(z.literal('')),
  phone: z.string().max(20, 'Phone must be less than 20 characters').optional().or(z.literal('')),
  address: z.string().max(500, 'Address must be less than 500 characters').optional().or(z.literal('')),
  city: z.string().max(100, 'City must be less than 100 characters').optional().or(z.literal('')),
  state: z.string().max(50, 'State must be less than 50 characters').optional().or(z.literal('')),
  zip: z.string().max(20, 'ZIP must be less than 20 characters').optional().or(z.literal('')),
});

// Customer validation schema
export const customerSchema = z.object({
  name: z.string().min(1, 'Customer name is required').max(255, 'Name must be less than 255 characters'),
  email: z.string().email('Invalid email address').max(255).optional().nullable().or(z.literal('')).or(z.literal(null)),
  phone: z.string().max(20, 'Phone must be less than 20 characters').optional().nullable().or(z.literal('')).or(z.literal(null)),
  address: z.string().max(500, 'Address must be less than 500 characters').optional().nullable().or(z.literal('')).or(z.literal(null)),
  city: z.string().max(100, 'City must be less than 100 characters').optional().nullable().or(z.literal('')).or(z.literal(null)),
  state: z.string().max(50, 'State must be less than 50 characters').optional().nullable().or(z.literal('')).or(z.literal(null)),
  zip: z.string().max(20, 'ZIP must be less than 20 characters').optional().nullable().or(z.literal('')).or(z.literal(null)),
  notes: z.string().max(2000, 'Notes must be less than 2000 characters').optional().nullable().or(z.literal('')).or(z.literal(null)),
});

// Job validation schema
export const jobSchema = z.object({
  customer_id: z.string().uuid('Invalid customer ID'),
  title: z.string().min(1, 'Job title is required').max(255, 'Title must be less than 255 characters'),
  description: z.string().max(5000, 'Description must be less than 5000 characters').optional().nullable(),
  notes: z.string().max(5000, 'Notes must be less than 5000 characters').optional().nullable(),
  status: z.enum(['draft', 'scheduled', 'in_progress', 'completed', 'invoiced', 'paid']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  quote_id: z.string().uuid().optional().nullable(),
  assigned_to: z.string().uuid().optional().nullable(),
  scheduled_start: z.string().optional().nullable(),
  scheduled_end: z.string().optional().nullable(),
});

// Quote/Invoice item validation schema
export const itemSchema = z.object({
  description: z.string().min(1, 'Description is required').max(500, 'Description must be less than 500 characters'),
  quantity: z.number().min(0, 'Quantity must be positive').max(99999, 'Quantity too large'),
  unit_price: z.number().min(0, 'Price must be positive').max(9999999, 'Price too large'),
});

// Quote validation schema
export const quoteSchema = z.object({
  customer_id: z.string().uuid('Invalid customer ID'),
  status: z.enum(['draft', 'sent', 'accepted', 'rejected', 'expired']).optional(),
  notes: z.string().max(5000, 'Notes must be less than 5000 characters').optional().nullable(),
  valid_until: z.string().optional().nullable(),
});

// Invoice validation schema  
export const invoiceSchema = z.object({
  customer_id: z.string().uuid('Invalid customer ID'),
  status: z.enum(['draft', 'sent', 'paid', 'overdue', 'cancelled']).optional(),
  notes: z.string().max(5000, 'Notes must be less than 5000 characters').optional().nullable(),
  due_date: z.string().optional().nullable(),
  quote_id: z.string().uuid().optional().nullable(),
});

// Team invitation validation schema
export const inviteSchema = z.object({
  email: z.string().email('Invalid email address').max(255),
  full_name: z.string().min(1, 'Full name is required').max(255, 'Name must be less than 255 characters'),
  role: z.enum(['admin', 'manager', 'technician', 'customer']),
});

// Utility to safely parse and return validation errors
export function validateData<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: string } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  const firstError = result.error.errors[0];
  return { success: false, error: firstError?.message || 'Validation failed' };
}

// Sanitize error messages for client display
export function sanitizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    
    // Map known database/auth errors to safe messages
    if (msg.includes('duplicate') || msg.includes('unique constraint') || msg.includes('23505')) {
      return 'This record already exists';
    }
    if (msg.includes('foreign key') || msg.includes('23503') || msg.includes('not found')) {
      return 'Related record not found';
    }
    if (msg.includes('rls') || msg.includes('policy') || msg.includes('permission')) {
      return 'Access denied';
    }
    if (msg.includes('auth') || msg.includes('unauthorized') || msg.includes('jwt')) {
      return 'Authentication required';
    }
    if (msg.includes('timeout') || msg.includes('network')) {
      return 'Network error. Please try again.';
    }
    if (msg.includes('invalid input') || msg.includes('validation')) {
      return 'Invalid input provided';
    }
  }
  
  return 'An error occurred. Please try again.';
}
