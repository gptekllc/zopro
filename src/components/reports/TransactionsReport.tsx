import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { useAllPayments, PaymentWithDetails } from '@/hooks/usePayments';
import { useCustomers } from '@/hooks/useCustomers';
import { useCreatePayment } from '@/hooks/usePayments';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  DollarSign,
  TrendingDown,
  Hash,
  Calculator,
  Plus,
  MoreHorizontal,
  FileText,
  Download,
  Mail,
  Search,
  X,
  Loader2,
} from 'lucide-react';
import { PAYMENT_METHODS, RecordPaymentDialog, PaymentData } from '@/components/invoices/RecordPaymentDialog';
import SelectInvoiceDialog from '@/components/reports/SelectInvoiceDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatAmount } from '@/lib/formatAmount';

const formatCurrency = (amount: number) => `$${formatAmount(amount)}`;

const TransactionsReport = () => {
  const { data: payments, isLoading } = useAllPayments();
  const { data: customers } = useCustomers();
  const createPayment = useCreatePayment();

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [customerId, setCustomerId] = useState<string>('all');
  const [paymentMethod, setPaymentMethod] = useState<string>('all');
  const [paymentStatus, setPaymentStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Dialogs
  const [selectInvoiceOpen, setSelectInvoiceOpen] = useState(false);
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<{
    id: string;
    invoice_number: string;
    total: number;
    remainingBalance: number;
    customerEmail?: string | null;
  } | null>(null);

  // Receipt loading state
  const [receiptLoadingId, setReceiptLoadingId] = useState<string | null>(null);

  // Filter payments
  const filteredPayments = useMemo(() => {
    if (!payments) return [];

    return payments.filter((payment) => {
      // Date filter
      if (startDate && new Date(payment.payment_date) < new Date(startDate)) return false;
      if (endDate && new Date(payment.payment_date) > new Date(endDate + 'T23:59:59')) return false;

      // Customer filter
      if (customerId !== 'all' && payment.invoice?.customer?.id !== customerId) return false;

      // Payment method filter
      if (paymentMethod !== 'all' && payment.method !== paymentMethod) return false;

      // Status filter
      if (paymentStatus !== 'all' && payment.status !== paymentStatus) return false;

      // Search query (invoice number, customer name)
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const invoiceNumber = payment.invoice?.invoice_number?.toLowerCase() || '';
        const customerName = payment.invoice?.customer?.name?.toLowerCase() || '';
        if (!invoiceNumber.includes(query) && !customerName.includes(query)) return false;
      }

      return true;
    });
  }, [payments, startDate, endDate, customerId, paymentMethod, paymentStatus, searchQuery]);

  // Calculate summary stats
  const stats = useMemo(() => {
    const completed = filteredPayments.filter((p) => p.status === 'completed');
    const refunded = filteredPayments.filter((p) => p.status === 'refunded' || p.status === 'voided');

    const totalCollected = completed.reduce((sum, p) => sum + Number(p.amount), 0);
    const totalRefunded = refunded.reduce((sum, p) => sum + Number(p.amount), 0);
    const count = filteredPayments.length;
    const avgAmount = count > 0 ? totalCollected / completed.length : 0;

    return { totalCollected, totalRefunded, count, avgAmount };
  }, [filteredPayments]);

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    setCustomerId('all');
    setPaymentMethod('all');
    setPaymentStatus('all');
    setSearchQuery('');
  };

  const hasActiveFilters = startDate || endDate || customerId !== 'all' || paymentMethod !== 'all' || paymentStatus !== 'all' || searchQuery;

  const handleInvoiceSelected = (invoice: {
    id: string;
    invoice_number: string;
    total: number;
    remainingBalance: number;
    customerEmail?: string | null;
  }) => {
    setSelectedInvoice(invoice);
    setSelectInvoiceOpen(false);
    setRecordPaymentOpen(true);
  };

  const handleRecordPayment = async (data: PaymentData) => {
    if (!selectedInvoice) return;

    await createPayment.mutateAsync({
      invoiceId: selectedInvoice.id,
      amount: data.amount,
      method: data.method,
      paymentDate: data.date,
      notes: data.note,
      sendNotification: data.sendNotification,
    });

    setRecordPaymentOpen(false);
    setSelectedInvoice(null);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge variant="default" className="bg-green-600">Completed</Badge>;
      case 'refunded':
        return <Badge variant="destructive">Refunded</Badge>;
      case 'voided':
        return <Badge variant="secondary">Voided</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getMethodLabel = (method: string) => {
    return PAYMENT_METHODS.find((m) => m.value === method)?.label || method;
  };

  const handleDownloadReceipt = async (payment: PaymentWithDetails) => {
    setReceiptLoadingId(payment.id);
    try {
      const { data, error } = await supabase.functions.invoke('generate-payment-receipt', {
        body: { paymentId: payment.id, action: 'download' },
      });

      if (error) throw error;

      // Create blob and download
      const byteCharacters = atob(data.pdf);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: 'application/pdf' });
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `receipt-${payment.invoice?.invoice_number || payment.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Receipt downloaded');
    } catch (err: any) {
      console.error('Error downloading receipt:', err);
      toast.error('Failed to download receipt');
    } finally {
      setReceiptLoadingId(null);
    }
  };

  const handleEmailReceipt = async (payment: PaymentWithDetails) => {
    setReceiptLoadingId(payment.id);
    try {
      const { error } = await supabase.functions.invoke('generate-payment-receipt', {
        body: { paymentId: payment.id, action: 'email' },
      });

      if (error) throw error;
      toast.success('Receipt emailed to customer');
    } catch (err: any) {
      console.error('Error emailing receipt:', err);
      toast.error('Failed to email receipt');
    } finally {
      setReceiptLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Collected</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalCollected)}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Refunded</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold text-red-600">{formatCurrency(stats.totalRefunded)}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transactions</CardTitle>
            <Hash className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{stats.count}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Amount</CardTitle>
            <Calculator className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <div className="text-2xl font-bold">{formatCurrency(stats.avgAmount)}</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <CardTitle>Payment History</CardTitle>
            <Button onClick={() => setSelectInvoiceOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Record Payment
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by invoice number or customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Filters */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>End Date</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Customer</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder="All customers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Customers</SelectItem>
                  {customers?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Method</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="All methods" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Methods</SelectItem>
                  {PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="refunded">Refunded</SelectItem>
                  <SelectItem value="voided">Voided</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {hasActiveFilters && (
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
                <X className="w-4 h-4" />
                Clear Filters
              </Button>
            </div>
          )}

          {/* Transactions Table */}
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                    </TableRow>
                  ))
                ) : filteredPayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      {hasActiveFilters
                        ? 'No payments match your filters'
                        : 'No payments recorded yet'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPayments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(new Date(payment.payment_date), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="font-medium">
                        {payment.invoice?.invoice_number || '-'}
                      </TableCell>
                      <TableCell>
                        {payment.invoice?.customer?.name || '-'}
                      </TableCell>
                      <TableCell>{getMethodLabel(payment.method)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(payment.amount)}
                      </TableCell>
                      <TableCell>{getStatusBadge(payment.status)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={receiptLoadingId === payment.id}>
                              {receiptLoadingId === payment.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <MoreHorizontal className="w-4 h-4" />
                              )}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => handleDownloadReceipt(payment)}
                            >
                              <Download className="w-4 h-4 mr-2" />
                              Download Receipt
                            </DropdownMenuItem>
                            {payment.invoice?.customer?.email && (
                              <DropdownMenuItem
                                onClick={() => handleEmailReceipt(payment)}
                              >
                                <Mail className="w-4 h-4 mr-2" />
                                Email Receipt
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Select Invoice Dialog */}
      <SelectInvoiceDialog
        open={selectInvoiceOpen}
        onOpenChange={setSelectInvoiceOpen}
        onSelect={handleInvoiceSelected}
      />

      {/* Record Payment Dialog */}
      {selectedInvoice && (
        <RecordPaymentDialog
          open={recordPaymentOpen}
          onOpenChange={setRecordPaymentOpen}
          invoiceTotal={selectedInvoice.total}
          remainingBalance={selectedInvoice.remainingBalance}
          invoiceNumber={selectedInvoice.invoice_number}
          customerEmail={selectedInvoice.customerEmail}
          onConfirm={handleRecordPayment}
          isLoading={createPayment.isPending}
        />
      )}
    </div>
  );
};

export default TransactionsReport;
