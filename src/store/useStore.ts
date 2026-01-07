import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User, Company, Customer, Quote, Invoice, TimeEntry, Payment, UserRole } from '@/types';

interface AppState {
  // Auth
  currentUser: User | null;
  isAuthenticated: boolean;
  
  // Company
  company: Company | null;
  
  // Data
  users: User[];
  customers: Customer[];
  quotes: Quote[];
  invoices: Invoice[];
  timeEntries: TimeEntry[];
  payments: Payment[];
  
  // Actions
  login: (email: string, password: string) => boolean;
  logout: () => void;
  
  // Customer actions
  addCustomer: (customer: Omit<Customer, 'id' | 'createdAt' | 'companyId'>) => void;
  updateCustomer: (id: string, data: Partial<Customer>) => void;
  deleteCustomer: (id: string) => void;
  
  // Quote actions
  addQuote: (quote: Omit<Quote, 'id' | 'createdAt' | 'companyId' | 'quoteNumber'>) => void;
  updateQuote: (id: string, data: Partial<Quote>) => void;
  deleteQuote: (id: string) => void;
  
  // Invoice actions
  addInvoice: (invoice: Omit<Invoice, 'id' | 'createdAt' | 'companyId' | 'invoiceNumber'>) => void;
  updateInvoice: (id: string, data: Partial<Invoice>) => void;
  deleteInvoice: (id: string) => void;
  
  // Time clock actions
  clockIn: (notes?: string) => void;
  clockOut: (notes?: string) => void;
  getActiveTimeEntry: () => TimeEntry | undefined;
  
  // User management
  addUser: (user: Omit<User, 'id' | 'createdAt' | 'companyId'>) => void;
  updateUser: (id: string, data: Partial<User>) => void;
  deleteUser: (id: string) => void;
  
  // Company actions
  updateCompany: (data: Partial<Company>) => void;
}

const generateId = () => Math.random().toString(36).substr(2, 9);

// Demo data
const demoCompany: Company = {
  id: 'demo-company',
  name: 'ZoPro Demo',
  address: '123 Service Street, Business City, ST 12345',
  phone: '(555) 123-4567',
  email: 'contact@zopro.app',
  industry: 'general',
  createdAt: new Date(),
};

const demoUsers: User[] = [
  {
    id: 'admin-1',
    name: 'Admin User',
    email: 'admin@demo.com',
    phone: '(555) 111-1111',
    role: 'admin',
    companyId: 'demo-company',
    createdAt: new Date(),
  },
  {
    id: 'tech-1',
    name: 'John Technician',
    email: 'john@demo.com',
    phone: '(555) 222-2222',
    role: 'tech',
    companyId: 'demo-company',
    createdAt: new Date(),
  },
  {
    id: 'tech-2',
    name: 'Sarah Specialist',
    email: 'sarah@demo.com',
    phone: '(555) 333-3333',
    role: 'tech',
    companyId: 'demo-company',
    createdAt: new Date(),
  },
];

const demoCustomers: Customer[] = [
  {
    id: 'cust-1',
    name: 'Robert Johnson',
    email: 'robert@email.com',
    phone: '(555) 444-4444',
    address: '456 Oak Avenue, Hometown, ST 67890',
    portalAccess: true,
    companyId: 'demo-company',
    createdAt: new Date(),
  },
  {
    id: 'cust-2',
    name: 'Emily Davis',
    email: 'emily@email.com',
    phone: '(555) 555-5555',
    address: '789 Maple Drive, Somewhere, ST 11111',
    portalAccess: false,
    companyId: 'demo-company',
    createdAt: new Date(),
  },
  {
    id: 'cust-3',
    name: 'Michael Brown',
    email: 'michael@email.com',
    phone: '(555) 666-6666',
    address: '321 Pine Street, Anywhere, ST 22222',
    portalAccess: true,
    companyId: 'demo-company',
    createdAt: new Date(),
  },
];

const demoQuotes: Quote[] = [
  {
    id: 'quote-1',
    quoteNumber: 'Q-001',
    customerId: 'cust-1',
    customerName: 'Robert Johnson',
    items: [
      { id: '1', description: 'Water heater replacement', quantity: 1, unitPrice: 1500 },
      { id: '2', description: 'Labor (4 hours)', quantity: 4, unitPrice: 85 },
    ],
    status: 'sent',
    validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    companyId: 'demo-company',
    createdBy: 'admin-1',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  },
  {
    id: 'quote-2',
    quoteNumber: 'Q-002',
    customerId: 'cust-2',
    customerName: 'Emily Davis',
    items: [
      { id: '1', description: 'HVAC system inspection', quantity: 1, unitPrice: 250 },
      { id: '2', description: 'Filter replacement', quantity: 2, unitPrice: 45 },
    ],
    status: 'approved',
    validUntil: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    companyId: 'demo-company',
    createdBy: 'tech-1',
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
  },
];

const demoInvoices: Invoice[] = [
  {
    id: 'inv-1',
    invoiceNumber: 'INV-001',
    customerId: 'cust-1',
    customerName: 'Robert Johnson',
    items: [
      { id: '1', description: 'Pipe repair service', quantity: 1, unitPrice: 350 },
      { id: '2', description: 'Parts and materials', quantity: 1, unitPrice: 125 },
    ],
    status: 'paid',
    dueDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    paidDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    companyId: 'demo-company',
    createdBy: 'admin-1',
    createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
  },
  {
    id: 'inv-2',
    invoiceNumber: 'INV-002',
    customerId: 'cust-3',
    customerName: 'Michael Brown',
    items: [
      { id: '1', description: 'Electrical panel upgrade', quantity: 1, unitPrice: 2800 },
      { id: '2', description: 'Installation labor', quantity: 8, unitPrice: 95 },
    ],
    status: 'sent',
    dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
    companyId: 'demo-company',
    createdBy: 'admin-1',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
  },
  {
    id: 'inv-3',
    invoiceNumber: 'INV-003',
    customerId: 'cust-2',
    customerName: 'Emily Davis',
    items: [
      { id: '1', description: 'AC maintenance service', quantity: 1, unitPrice: 175 },
    ],
    status: 'overdue',
    dueDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    companyId: 'demo-company',
    createdBy: 'tech-1',
    createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
  },
];

const demoTimeEntries: TimeEntry[] = [
  {
    id: 'time-1',
    userId: 'tech-1',
    userName: 'John Technician',
    clockIn: new Date(Date.now() - 4 * 60 * 60 * 1000),
    clockOut: new Date(Date.now() - 30 * 60 * 1000),
    notes: 'Morning shift',
    companyId: 'demo-company',
  },
];

const demoPayments: Payment[] = [
  {
    id: 'pay-1',
    invoiceId: 'inv-1',
    amount: 475,
    method: 'card',
    date: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    companyId: 'demo-company',
  },
];

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      isAuthenticated: false,
      company: demoCompany,
      users: demoUsers,
      customers: demoCustomers,
      quotes: demoQuotes,
      invoices: demoInvoices,
      timeEntries: demoTimeEntries,
      payments: demoPayments,

      login: (email: string, password: string) => {
        // Demo login - any password works with demo emails
        const user = get().users.find(u => u.email.toLowerCase() === email.toLowerCase());
        if (user) {
          set({ currentUser: user, isAuthenticated: true });
          return true;
        }
        return false;
      },

      logout: () => {
        set({ currentUser: null, isAuthenticated: false });
      },

      addCustomer: (customer) => {
        const { currentUser, customers } = get();
        if (!currentUser) return;
        
        const newCustomer: Customer = {
          ...customer,
          id: generateId(),
          companyId: currentUser.companyId,
          createdAt: new Date(),
        };
        set({ customers: [...customers, newCustomer] });
      },

      updateCustomer: (id, data) => {
        set({
          customers: get().customers.map(c => 
            c.id === id ? { ...c, ...data } : c
          ),
        });
      },

      deleteCustomer: (id) => {
        set({ customers: get().customers.filter(c => c.id !== id) });
      },

      addQuote: (quote) => {
        const { currentUser, quotes } = get();
        if (!currentUser) return;
        
        const quoteNumber = `Q-${String(quotes.length + 1).padStart(3, '0')}`;
        const newQuote: Quote = {
          ...quote,
          id: generateId(),
          quoteNumber,
          companyId: currentUser.companyId,
          createdAt: new Date(),
        };
        set({ quotes: [...quotes, newQuote] });
      },

      updateQuote: (id, data) => {
        set({
          quotes: get().quotes.map(q => 
            q.id === id ? { ...q, ...data } : q
          ),
        });
      },

      deleteQuote: (id) => {
        set({ quotes: get().quotes.filter(q => q.id !== id) });
      },

      addInvoice: (invoice) => {
        const { currentUser, invoices } = get();
        if (!currentUser) return;
        
        const invoiceNumber = `INV-${String(invoices.length + 1).padStart(3, '0')}`;
        const newInvoice: Invoice = {
          ...invoice,
          id: generateId(),
          invoiceNumber,
          companyId: currentUser.companyId,
          createdAt: new Date(),
        };
        set({ invoices: [...invoices, newInvoice] });
      },

      updateInvoice: (id, data) => {
        set({
          invoices: get().invoices.map(i => 
            i.id === id ? { ...i, ...data } : i
          ),
        });
      },

      deleteInvoice: (id) => {
        set({ invoices: get().invoices.filter(i => i.id !== id) });
      },

      clockIn: (notes) => {
        const { currentUser, timeEntries } = get();
        if (!currentUser) return;
        
        const newEntry: TimeEntry = {
          id: generateId(),
          userId: currentUser.id,
          userName: currentUser.name,
          clockIn: new Date(),
          notes,
          companyId: currentUser.companyId,
        };
        set({ timeEntries: [...timeEntries, newEntry] });
      },

      clockOut: (notes) => {
        const { currentUser, timeEntries } = get();
        if (!currentUser) return;
        
        set({
          timeEntries: timeEntries.map(entry => 
            entry.userId === currentUser.id && !entry.clockOut
              ? { ...entry, clockOut: new Date(), notes: notes || entry.notes }
              : entry
          ),
        });
      },

      getActiveTimeEntry: () => {
        const { currentUser, timeEntries } = get();
        if (!currentUser) return undefined;
        return timeEntries.find(e => e.userId === currentUser.id && !e.clockOut);
      },

      addUser: (user) => {
        const { currentUser, users } = get();
        if (!currentUser) return;
        
        const newUser: User = {
          ...user,
          id: generateId(),
          companyId: currentUser.companyId,
          createdAt: new Date(),
        };
        set({ users: [...users, newUser] });
      },

      updateUser: (id, data) => {
        set({
          users: get().users.map(u => 
            u.id === id ? { ...u, ...data } : u
          ),
        });
      },

      deleteUser: (id) => {
        set({ users: get().users.filter(u => u.id !== id) });
      },

      updateCompany: (data) => {
        set({ company: { ...get().company!, ...data } });
      },
    }),
    {
      name: 'service-app-storage',
    }
  )
);
