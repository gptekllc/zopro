export type UserRole = 'admin' | 'tech' | 'customer';

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  avatar?: string;
  companyId: string;
  createdAt: Date;
}

export interface Company {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  logo?: string;
  industry: 'plumbing' | 'hvac' | 'electrical' | 'general';
  createdAt: Date;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  notes?: string;
  portalAccess: boolean;
  companyId: string;
  createdAt: Date;
}

export interface QuoteLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface Quote {
  id: string;
  quoteNumber: string;
  customerId: string;
  customerName: string;
  items: QuoteLineItem[];
  status: 'draft' | 'sent' | 'approved' | 'rejected';
  notes?: string;
  validUntil: Date;
  companyId: string;
  createdBy: string;
  createdAt: Date;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  customerId: string;
  customerName: string;
  items: QuoteLineItem[];
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  dueDate: Date;
  paidDate?: Date;
  notes?: string;
  companyId: string;
  createdBy: string;
  createdAt: Date;
}

export interface TimeEntry {
  id: string;
  userId: string;
  userName: string;
  clockIn: Date;
  clockOut?: Date;
  notes?: string;
  jobId?: string;
  companyId: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  method: 'cash' | 'card' | 'check' | 'bank_transfer';
  date: Date;
  notes?: string;
  companyId: string;
}

export interface DashboardStats {
  totalRevenue: number;
  pendingInvoices: number;
  activeQuotes: number;
  totalCustomers: number;
  todaysClockins: number;
}
