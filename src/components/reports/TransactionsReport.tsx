import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { useAllPayments, PaymentWithDetails } from '@/hooks/usePayments';
import { useCustomers } from '@/hooks/useCustomers';
import { useCreatePayment } from '@/hooks/usePayments';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { TablePagination } from '@/components/ui/table-pagination';
import { DollarSign, TrendingDown, Hash, Calculator, Plus, MoreHorizontal, FileText, Download, Mail, Search, X, Loader2, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { PAYMENT_METHODS, RecordPaymentDialog, PaymentData } from '@/components/invoices/RecordPaymentDialog';
import SelectInvoiceDialog from '@/components/reports/SelectInvoiceDialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatAmount } from '@/lib/formatAmount';
import { ReportEmailDialog } from './ReportEmailDialog';
import { ScrollableTable } from '@/components/ui/scrollable-table';
const formatCurrency = (amount: number) => `$${formatAmount(amount)}`;
const TransactionsReport = () => {
  const {
    data: payments,
    isLoading
  } = useAllPayments();
  const {
    data: customers
  } = useCustomers();
  const createPayment = useCreatePayment();

  // Filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [customerId, setCustomerId] = useState<string>('all');
  const [paymentMethod, setPaymentMethod] = useState<string>('all');
  const [paymentStatus, setPaymentStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Sorting
  const [sortColumn, setSortColumn] = useState<'date' | 'customer' | 'amount' | null>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Dialogs
  const [selectInvoiceOpen, setSelectInvoiceOpen] = useState(false);
  const [recordPaymentOpen, setRecordPaymentOpen] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
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
    return payments.filter(payment => {
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

  // Sorted payments
  const sortedPayments = useMemo(() => {
    if (!sortColumn) return filteredPayments;
    
    return [...filteredPayments].sort((a, b) => {
      let comparison = 0;
      
      switch (sortColumn) {
        case 'date':
          comparison = new Date(a.payment_date).getTime() - new Date(b.payment_date).getTime();
          break;
        case 'customer':
          const nameA = a.invoice?.customer?.name || '';
          const nameB = b.invoice?.customer?.name || '';
          comparison = nameA.localeCompare(nameB);
          break;
        case 'amount':
          comparison = Number(a.amount) - Number(b.amount);
          break;
      }
      
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredPayments, sortColumn, sortDirection]);

  // Reset to first page when filters change
  useMemo(() => {
    setCurrentPage(1);
  }, [startDate, endDate, customerId, paymentMethod, paymentStatus, searchQuery, sortColumn, sortDirection, pageSize]);

  // Paginated payments
  const paginatedPayments = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return sortedPayments.slice(startIndex, startIndex + pageSize);
  }, [sortedPayments, currentPage, pageSize]);

  const totalPages = Math.ceil(sortedPayments.length / pageSize);

  // Handle sorting
  const handleSort = (column: 'date' | 'customer' | 'amount') => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  const getSortIcon = (column: 'date' | 'customer' | 'amount') => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="w-4 h-4 ml-1 opacity-50" />;
    }
    return sortDirection === 'asc' 
      ? <ArrowUp className="w-4 h-4 ml-1" />
      : <ArrowDown className="w-4 h-4 ml-1" />;
  };

  // Calculate summary stats
  const stats = useMemo(() => {
    const completed = filteredPayments.filter(p => p.status === 'completed');
    const refunded = filteredPayments.filter(p => p.status === 'refunded' || p.status === 'voided');
    const totalCollected = completed.reduce((sum, p) => sum + Number(p.amount), 0);
    const totalRefunded = refunded.reduce((sum, p) => sum + Number(p.amount), 0);
    const count = filteredPayments.length;
    const avgAmount = count > 0 ? totalCollected / completed.length : 0;
    return {
      totalCollected,
      totalRefunded,
      count,
      avgAmount
    };
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

  // Export to CSV
  const exportToCSV = () => {
    if (filteredPayments.length === 0) return;
    const headers = ['Date', 'Invoice #', 'Customer', 'Method', 'Amount', 'Status', 'Notes'];
    const rows = filteredPayments.map(payment => [format(new Date(payment.payment_date), 'yyyy-MM-dd'), payment.invoice?.invoice_number || '-', payment.invoice?.customer?.name || '-', getMethodLabel(payment.method), formatCurrency(payment.amount), payment.status, payment.notes || '']);

    // Add summary row
    rows.push([]);
    rows.push(['Summary', '', '', '', '', '', '']);
    rows.push(['Total Collected', '', '', '', formatCurrency(stats.totalCollected), '', '']);
    rows.push(['Total Refunded', '', '', '', formatCurrency(stats.totalRefunded), '', '']);
    rows.push(['Transaction Count', '', '', '', stats.count.toString(), '', '']);
    const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
    const blob = new Blob([csvContent], {
      type: 'text/csv;charset=utf-8;'
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const dateStr = startDate && endDate ? `${startDate}_to_${endDate}` : format(new Date(), 'yyyy-MM-dd');
    link.download = `transactions-${dateStr}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };
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
      sendNotification: data.sendNotification
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
    return PAYMENT_METHODS.find(m => m.value === method)?.label || method;
  };
  const handleDownloadReceipt = async (payment: PaymentWithDetails) => {
    setReceiptLoadingId(payment.id);
    try {
      const {
        data,
        error
      } = await supabase.functions.invoke('generate-payment-receipt', {
        body: {
          paymentId: payment.id,
          action: 'download'
        }
      });
      if (error) throw error;

      // Create blob and download
      const byteCharacters = atob(data.pdf);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], {
        type: 'application/pdf'
      });
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
      const {
        error
      } = await supabase.functions.invoke('generate-payment-receipt', {
        body: {
          paymentId: payment.id,
          action: 'email'
        }
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
  const getDateRangeLabel = () => {
    if (startDate && endDate) {
      return `${format(new Date(startDate), 'MMM d, yyyy')} - ${format(new Date(endDate), 'MMM d, yyyy')}`;
    }
    if (startDate) return `From ${format(new Date(startDate), 'MMM d, yyyy')}`;
    if (endDate) return `Until ${format(new Date(endDate), 'MMM d, yyyy')}`;
    return 'All Time';
  };

  // Send email report
  const sendReportEmail = async (emails: string[]): Promise<{
    successful: string[];
    failed: {
      email: string;
      reason: string;
    }[];
  }> => {
    setIsSendingEmail(true);
    try {
      const reportData = {
        title: 'Transactions Report',
        timeRange: getDateRangeLabel(),
        generatedAt: format(new Date(), 'MMMM d, yyyy'),
        stats: {
          totalCollected: formatAmount(stats.totalCollected),
          totalRefunded: formatAmount(stats.totalRefunded),
          transactionCount: stats.count,
          avgAmount: formatAmount(stats.avgAmount)
        },
        transactions: filteredPayments.slice(0, 30).map(p => ({
          date: format(new Date(p.payment_date), 'MMM d, yyyy'),
          invoiceNumber: p.invoice?.invoice_number || '-',
          customer: p.invoice?.customer?.name || '-',
          method: getMethodLabel(p.method),
          amount: formatAmount(p.amount),
          status: p.status
        }))
      };
      const {
        data,
        error
      } = await supabase.functions.invoke('send-report-email', {
        body: {
          to: emails,
          reportType: 'transactions',
          reportData
        }
      });
      if (error) throw error;
      const result = data as {
        successful: string[];
        failed: {
          email: string;
          reason: string;
        }[];
      };
      if (result.successful.length > 0) {
        toast.success(`Report sent to ${result.successful.length} recipient${result.successful.length !== 1 ? 's' : ''}`);
      }
      if (result.failed.length > 0) {
        toast.error(`Failed to send to ${result.failed.length} recipient${result.failed.length !== 1 ? 's' : ''}`);
      }
      return result;
    } catch (error: any) {
      console.error('Failed to send email:', error);
      toast.error('Failed to send email: ' + (error.message || 'Unknown error'));
      return {
        successful: [],
        failed: emails.map(e => ({
          email: e,
          reason: error.message || 'Unknown error'
        }))
      };
    } finally {
      setIsSendingEmail(false);
    }
  };
  return <div className="space-y-6">
      {/* Header with Search and Actions */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-center gap-4">
          
          <div className="relative w-full lg:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
          </div>
          <div className="flex items-center justify-center lg:justify-end gap-2 lg:ml-auto">
            <Button onClick={() => setEmailDialogOpen(true)} variant="outline" size="sm" disabled={filteredPayments.length === 0}>
              <Mail className="w-4 h-4 mr-2" />
              Email
            </Button>
            <Button onClick={exportToCSV} variant="outline" size="sm" disabled={filteredPayments.length === 0} className="hidden sm:inline-flex">
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
            <Button onClick={() => setSelectInvoiceOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Record Payment
            </Button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Collected</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-24" /> : <div className="text-2xl font-bold text-green-600">{formatCurrency(stats.totalCollected)}</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Refunded</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-24" /> : <div className="text-2xl font-bold text-red-600">{formatCurrency(stats.totalRefunded)}</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transactions</CardTitle>
            <Hash className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-16" /> : <div className="text-2xl font-bold">{stats.count}</div>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Amount</CardTitle>
            <Calculator className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-24" /> : <div className="text-2xl font-bold">{formatCurrency(stats.avgAmount)}</div>}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6 space-y-4">

          {/* Filters */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>End Date</Label>
              <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>Customer</Label>
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder="All customers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Customers</SelectItem>
                  {customers?.map(c => <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>)}
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
                  {PAYMENT_METHODS.map(m => <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>)}
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

          {hasActiveFilters && <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
                <X className="w-4 h-4" />
                Clear Filters
              </Button>
            </div>}

          {/* Transactions Table */}
          <ScrollableTable className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Button variant="ghost" size="sm" className="h-8 -ml-3 font-medium" onClick={() => handleSort('date')}>
                      Date
                      {getSortIcon('date')}
                    </Button>
                  </TableHead>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>
                    <Button variant="ghost" size="sm" className="h-8 -ml-3 font-medium" onClick={() => handleSort('customer')}>
                      Customer
                      {getSortIcon('customer')}
                    </Button>
                  </TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">
                    <Button variant="ghost" size="sm" className="h-8 -mr-3 font-medium" onClick={() => handleSort('amount')}>
                      Amount
                      {getSortIcon('amount')}
                    </Button>
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? Array.from({
                length: 5
              }).map((_, i) => <TableRow key={i}>
                      <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                      <TableCell><Skeleton className="h-8 w-8" /></TableCell>
                    </TableRow>) : filteredPayments.length === 0 ? <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      {hasActiveFilters ? 'No payments match your filters' : 'No payments recorded yet'}
                    </TableCell>
                  </TableRow> : paginatedPayments.map(payment => <TableRow key={payment.id}>
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
                              {receiptLoadingId === payment.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <MoreHorizontal className="w-4 h-4" />}
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleDownloadReceipt(payment)}>
                              <Download className="w-4 h-4 mr-2" />
                              Download Receipt
                            </DropdownMenuItem>
                            {payment.invoice?.customer?.email && <DropdownMenuItem onClick={() => handleEmailReceipt(payment)}>
                                <Mail className="w-4 h-4 mr-2" />
                                Email Receipt
                              </DropdownMenuItem>}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>)}
              </TableBody>
            </Table>
          </ScrollableTable>

          {/* Pagination */}
          <TablePagination
            currentPage={currentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            totalItems={sortedPayments.length}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            itemLabel="payments"
          />
        </CardContent>
      </Card>

      {/* Select Invoice Dialog */}
      <SelectInvoiceDialog open={selectInvoiceOpen} onOpenChange={setSelectInvoiceOpen} onSelect={handleInvoiceSelected} />

      {/* Record Payment Dialog */}
      {selectedInvoice && <RecordPaymentDialog open={recordPaymentOpen} onOpenChange={setRecordPaymentOpen} invoiceTotal={selectedInvoice.total} remainingBalance={selectedInvoice.remainingBalance} invoiceNumber={selectedInvoice.invoice_number} customerEmail={selectedInvoice.customerEmail} onConfirm={handleRecordPayment} isLoading={createPayment.isPending} />}

      {/* Email Dialog */}
      <ReportEmailDialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen} onSend={sendReportEmail} isSending={isSendingEmail} title="Email Transactions Report" />
    </div>;
};
export default TransactionsReport;