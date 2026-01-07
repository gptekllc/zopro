import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign, ArrowUpRight, ArrowDownRight, RotateCcw } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { PaymentWithDetails } from '@/hooks/usePayments';

interface RecentTransactionsWidgetProps {
  payments: PaymentWithDetails[];
  isTechnicianScoped?: boolean;
}

export function RecentTransactionsWidget({ payments, isTechnicianScoped }: RecentTransactionsWidgetProps) {
  const recentPayments = payments.slice(0, 5);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'refunded':
        return <RotateCcw className="w-4 h-4 text-destructive" />;
      case 'voided':
        return <ArrowDownRight className="w-4 h-4 text-muted-foreground" />;
      default:
        return <ArrowUpRight className="w-4 h-4 text-success" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'refunded':
        return 'bg-destructive/10 text-destructive';
      case 'voided':
        return 'bg-muted text-muted-foreground';
      default:
        return 'bg-success/10 text-success';
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg flex items-center gap-2">
          <DollarSign className="w-5 h-5" />
          {isTechnicianScoped ? 'My Recent Transactions' : 'Recent Transactions'}
        </CardTitle>
        <Link to="/reports" className="text-sm text-primary hover:underline">
          View all
        </Link>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {recentPayments.map((payment) => (
            <div key={payment.id} className="flex items-center justify-between py-2 border-b last:border-0">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-full ${getStatusBadge(payment.status)}`}>
                  {getStatusIcon(payment.status)}
                </div>
                <div>
                  <p className="font-medium">
                    {payment.invoice?.customer?.name || 'Unknown Customer'}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {payment.invoice?.invoice_number || 'N/A'} • {payment.method}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className={`font-medium ${payment.status === 'refunded' ? 'text-destructive' : ''}`}>
                  {payment.status === 'refunded' ? '-' : '+'}${Number(payment.amount).toLocaleString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(payment.payment_date), 'MMM d, yyyy')}
                </p>
              </div>
            </div>
          ))}
          {recentPayments.length === 0 && (
            <p className="text-center text-muted-foreground py-4">No transactions yet</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
