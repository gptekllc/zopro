import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { useInvoices } from '@/hooks/useInvoices';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, FileText } from 'lucide-react';
import { formatAmount } from '@/lib/formatAmount';

const formatCurrency = (amount: number) => `$${formatAmount(amount)}`;

interface SelectInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (invoice: {
    id: string;
    invoice_number: string;
    total: number;
    remainingBalance: number;
    customerEmail?: string | null;
  }) => void;
}

export default function SelectInvoiceDialog({
  open,
  onOpenChange,
  onSelect,
}: SelectInvoiceDialogProps) {
  const { data: invoices, isLoading } = useInvoices();
  const [search, setSearch] = useState('');

  // Filter invoices that can receive payments (not paid, not cancelled)
  const payableInvoices = useMemo(() => {
    if (!invoices) return [];

    return invoices
      .filter((inv) => inv.status !== 'paid' && inv.status !== 'cancelled')
      .filter((inv) => {
        if (!search) return true;
        const query = search.toLowerCase();
        const invoiceNumber = inv.invoice_number.toLowerCase();
        const customerName = (inv.customer?.name || '').toLowerCase();
        return invoiceNumber.includes(query) || customerName.includes(query);
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [invoices, search]);

  const handleSelect = (invoice: typeof payableInvoices[number]) => {
    // Calculate remaining balance - for now we'll use total as a simple approach
    // In a real implementation, we'd need to fetch payments for each invoice
    const totalDue = Number(invoice.total) + Number(invoice.late_fee_amount || 0);
    
    onSelect({
      id: invoice.id,
      invoice_number: invoice.invoice_number,
      total: invoice.total,
      remainingBalance: totalDue, // This would need to factor in existing payments
      customerEmail: invoice.customer?.email,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'draft':
        return <Badge variant="secondary">Draft</Badge>;
      case 'sent':
        return <Badge variant="default">Sent</Badge>;
      case 'overdue':
        return <Badge variant="destructive">Overdue</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Select Invoice for Payment</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by invoice number or customer..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <ScrollArea className="h-[400px] pr-4">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="p-4 border rounded-lg">
                    <Skeleton className="h-4 w-28 mb-2" />
                    <Skeleton className="h-3 w-40 mb-2" />
                    <Skeleton className="h-3 w-20" />
                  </div>
                ))}
              </div>
            ) : payableInvoices.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileText className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {search
                    ? 'No invoices match your search'
                    : 'No unpaid invoices found'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {payableInvoices.map((invoice) => (
                  <Button
                    key={invoice.id}
                    variant="outline"
                    className="w-full h-auto p-4 justify-start text-left"
                    onClick={() => handleSelect(invoice)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">{invoice.invoice_number}</span>
                        {getStatusBadge(invoice.status)}
                      </div>
                      <div className="text-sm text-muted-foreground truncate">
                        {invoice.customer?.name || 'Unknown Customer'}
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-sm">
                        <span className="font-medium">
                          {formatCurrency(invoice.total)}
                        </span>
                        {invoice.due_date && (
                          <span className="text-muted-foreground">
                            Due: {format(new Date(invoice.due_date), 'MMM d, yyyy')}
                          </span>
                        )}
                      </div>
                    </div>
                  </Button>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
