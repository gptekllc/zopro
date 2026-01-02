import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertCircle,
  Archive,
  ArchiveRestore,
  CheckCircle,
  Copy,
  Edit,
  Eye,
  FileDown,
  FileText,
  Mail,
  MoreVertical,
  PenTool,
  Send,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import type { Invoice } from "@/hooks/useInvoices";
import { formatAmount } from "@/lib/formatAmount";

type Props = {
  invoice: Invoice;
  lateFeePercentage: number;

  getCustomerName: (customerId: string) => string;
  getCustomerEmail: (customerId: string) => string | null;

  getStatusColor: (status: string) => string;
  isInvoiceOverdue: (invoice: Invoice) => boolean;
  getTotalWithLateFee: (invoice: Invoice) => number;

  onOpen: (invoice: Invoice) => void;

  onStatusChange: (invoiceId: string, status: string) => void;
  onApplyLateFee: (invoiceId: string) => void;

  onEdit: (invoice: Invoice) => void;
  onDuplicate: (invoice: Invoice) => void;
  onDownload: (invoiceId: string) => void;
  onEmail: (invoiceId: string, customerId: string) => void;
  onMarkPaid: (invoiceId: string) => void;

  onViewSignature: (signatureId: string) => void;
  onOpenSignatureDialog: (invoice: Invoice) => void;
  onSendSignatureRequest: (invoice: Invoice) => void;

  onArchive: (invoice: Invoice) => void;
  onUnarchive: (invoice: Invoice) => void;
  onDelete: (invoice: Invoice) => void;
};

const formatTotalText = (value: number | string | null | undefined) => {
  const n = typeof value === "string" ? Number(value) : value ?? 0;
  const safe = Number.isFinite(n) ? n : 0;
  // Always show 2 decimals, and keep it as ONE text node to prevent odd styling split.
  return `$${safe.toFixed(2)}`;
};

export function InvoiceListCard({
  invoice,
  lateFeePercentage,
  getCustomerName,
  getCustomerEmail,
  getStatusColor,
  isInvoiceOverdue,
  getTotalWithLateFee,
  onOpen,
  onStatusChange,
  onApplyLateFee,
  onEdit,
  onDuplicate,
  onDownload,
  onEmail,
  onMarkPaid,
  onViewSignature,
  onOpenSignatureDialog,
  onSendSignatureRequest,
  onArchive,
  onUnarchive,
  onDelete,
}: Props) {
  const signatureId = (invoice as any).signature_id as string | undefined;
  const archivedAt = (invoice as any).archived_at as string | undefined;

  return (
    <Card
      className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onOpen(invoice)}
    >
      <CardContent className="p-4 sm:p-5">
        {/* Mobile Layout */}
        <div className="flex flex-col gap-2 sm:hidden">
          {/* Row 1: Invoice Info */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">{invoice.invoice_number}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                <span className="truncate">{getCustomerName(invoice.customer_id)}</span>
                {getCustomerEmail(invoice.customer_id) && (
                  <>
                    <span>•</span>
                    <span className="truncate">{getCustomerEmail(invoice.customer_id)}</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                {invoice.due_date && (
                  <span className="flex items-center gap-1 shrink-0">
                    Due: {format(new Date(invoice.due_date), "MMM d")}
                  </span>
                )}
              </div>
              {invoice.notes && (
                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{invoice.notes}</p>
              )}
            </div>
            <div className="text-right shrink-0">
              <span className="text-sm font-medium text-primary">
                {formatTotalText(invoice.total)}
              </span>
              {invoice.late_fee_amount && invoice.late_fee_amount > 0 && (
                <div className="text-xs text-destructive flex items-center gap-1 justify-end mt-0.5">
                  <AlertCircle className="w-3 h-3" />
                  +${Number(invoice.late_fee_amount).toFixed(2)} late fee
                </div>
              )}
              {invoice.late_fee_amount && invoice.late_fee_amount > 0 && (
                <div className="text-xs font-semibold text-foreground mt-0.5">
                  Total: ${formatAmount(getTotalWithLateFee(invoice))}
                </div>
              )}
            </div>
          </div>

          {/* Row 2: Tags + Actions */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 flex-wrap" onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-1 ${getStatusColor(
                      invoice.status
                    )}`}
                  >
                    {invoice.status}
                    <FileText className="w-3 h-3" />
                  </span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="bg-popover z-50">
                  {[
                    "draft",
                    "sent",
                    "paid",
                    "overdue",
                  ].map((status) => (
                    <DropdownMenuItem
                      key={status}
                      onClick={() => onStatusChange(invoice.id, status)}
                      disabled={invoice.status === status}
                      className={invoice.status === status ? "bg-accent" : ""}
                    >
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize mr-2 ${getStatusColor(
                          status
                        )}`}
                      >
                        {status}
                      </span>
                      {invoice.status === status && <CheckCircle className="w-4 h-4 ml-auto" />}
                    </DropdownMenuItem>
                  ))}

                  {isInvoiceOverdue(invoice) && !invoice.late_fee_amount && lateFeePercentage > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => onApplyLateFee(invoice.id)}
                        className="text-destructive"
                      >
                        <AlertCircle className="w-4 h-4 mr-2" />
                        Apply {lateFeePercentage}% Late Fee
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Signature Badge */}
              {signatureId && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success flex items-center gap-1">
                  <PenTool className="w-3 h-3" />
                  Signed
                </span>
              )}
            </div>

            {/* Action Menu */}
            <div onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-popover z-50">
                  <DropdownMenuItem onClick={() => onEdit(invoice)}>
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onDuplicate(invoice)}>
                    <Copy className="w-4 h-4 mr-2" />
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onDownload(invoice.id)}>
                    <FileDown className="w-4 h-4 mr-2" />
                    Download PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onEmail(invoice.id, invoice.customer_id)}>
                    <Mail className="w-4 h-4 mr-2" />
                    Email Invoice
                  </DropdownMenuItem>

                  {invoice.status !== "paid" && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => onMarkPaid(invoice.id)}>
                        <CheckCircle className="w-4 h-4 mr-2 text-success" />
                        Mark as Paid
                      </DropdownMenuItem>
                    </>
                  )}

                  {/* Signature Actions */}
                  {signatureId ? (
                    <DropdownMenuItem onClick={() => onViewSignature(signatureId)}>
                      <Eye className="w-4 h-4 mr-2" />
                      View Signature
                    </DropdownMenuItem>
                  ) : (
                    invoice.status !== "paid" && (
                      <>
                        <DropdownMenuItem onClick={() => onOpenSignatureDialog(invoice)}>
                          <PenTool className="w-4 h-4 mr-2" />
                          Collect Signature
                        </DropdownMenuItem>
                        {getCustomerEmail(invoice.customer_id) && (
                          <DropdownMenuItem onClick={() => onSendSignatureRequest(invoice)}>
                            <Send className="w-4 h-4 mr-2" />
                            Send Signature Request
                          </DropdownMenuItem>
                        )}
                      </>
                    )
                  )}

                  <DropdownMenuSeparator />

                  {archivedAt ? (
                    <DropdownMenuItem onClick={() => onUnarchive(invoice)}>
                      <ArchiveRestore className="w-4 h-4 mr-2" />
                      Restore
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={() => onArchive(invoice)}>
                      <Archive className="w-4 h-4 mr-2" />
                      Archive
                    </DropdownMenuItem>
                  )}

                  <DropdownMenuItem
                    onClick={() => onDelete(invoice)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>

        {/* Desktop Layout */}
        <div className="hidden sm:flex flex-col gap-2">
          {/* Row 1: Invoice Info + Amount */}
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{invoice.invoice_number}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5 flex-wrap">
                <span className="truncate">{getCustomerName(invoice.customer_id)}</span>
                {getCustomerEmail(invoice.customer_id) && (
                  <>
                    <span>•</span>
                    <span className="truncate">{getCustomerEmail(invoice.customer_id)}</span>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-0.5 flex-wrap">
                {invoice.due_date && (
                  <span className="flex items-center gap-1 shrink-0">
                    Due {format(new Date(invoice.due_date), "MMM d, yyyy")}
                  </span>
                )}
              </div>
              {invoice.notes && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{invoice.notes}</p>
              )}
            </div>
            <div className="text-right shrink-0">
              <span className="text-sm font-medium text-primary">
                {formatTotalText(invoice.total)}
              </span>
              {invoice.late_fee_amount && invoice.late_fee_amount > 0 && (
                <div className="text-xs text-destructive flex items-center gap-1 justify-end mt-0.5">
                  <AlertCircle className="w-3 h-3" />
                  +${Number(invoice.late_fee_amount).toFixed(2)} late fee
                </div>
              )}
              {invoice.late_fee_amount && invoice.late_fee_amount > 0 && (
                <div className="text-xs font-semibold text-foreground mt-0.5">
                  Total: ${formatAmount(getTotalWithLateFee(invoice))}
                </div>
              )}
            </div>
          </div>

          {/* Row 2: Tags + Actions */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1 flex-wrap" onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-1 ${getStatusColor(
                      invoice.status
                    )}`}
                  >
                    {invoice.status}
                    <FileText className="w-3 h-3" />
                  </span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="bg-popover z-50">
                  {[
                    "draft",
                    "sent",
                    "paid",
                    "overdue",
                  ].map((status) => (
                    <DropdownMenuItem
                      key={status}
                      onClick={() => onStatusChange(invoice.id, status)}
                      disabled={invoice.status === status}
                      className={invoice.status === status ? "bg-accent" : ""}
                    >
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize mr-2 ${getStatusColor(
                          status
                        )}`}
                      >
                        {status}
                      </span>
                      {invoice.status === status && <CheckCircle className="w-4 h-4 ml-auto" />}
                    </DropdownMenuItem>
                  ))}

                  {isInvoiceOverdue(invoice) && !invoice.late_fee_amount && lateFeePercentage > 0 && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => onApplyLateFee(invoice.id)}
                        className="text-destructive"
                      >
                        <AlertCircle className="w-4 h-4 mr-2" />
                        Apply {lateFeePercentage}% Late Fee
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Signature Badge */}
              {signatureId && (
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success flex items-center gap-1">
                  <PenTool className="w-3 h-3" />
                  Signed
                </span>
              )}
            </div>

            {/* Action Menu */}
            <div onClick={(e) => e.stopPropagation()}>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-popover z-50">
                  <DropdownMenuItem onClick={() => onEdit(invoice)}>
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onDuplicate(invoice)}>
                    <Copy className="w-4 h-4 mr-2" />
                    Duplicate
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onDownload(invoice.id)}>
                    <FileDown className="w-4 h-4 mr-2" />
                    Download PDF
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onEmail(invoice.id, invoice.customer_id)}>
                    <Mail className="w-4 h-4 mr-2" />
                    Email Invoice
                  </DropdownMenuItem>

                  {invoice.status !== "paid" && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => onMarkPaid(invoice.id)}>
                        <CheckCircle className="w-4 h-4 mr-2 text-success" />
                        Mark as Paid
                      </DropdownMenuItem>
                    </>
                  )}

                  {/* Signature Actions */}
                  {signatureId ? (
                    <DropdownMenuItem onClick={() => onViewSignature(signatureId)}>
                      <Eye className="w-4 h-4 mr-2" />
                      View Signature
                    </DropdownMenuItem>
                  ) : (
                    invoice.status !== "paid" && (
                      <>
                        <DropdownMenuItem onClick={() => onOpenSignatureDialog(invoice)}>
                          <PenTool className="w-4 h-4 mr-2" />
                          Collect Signature
                        </DropdownMenuItem>
                        {getCustomerEmail(invoice.customer_id) && (
                          <DropdownMenuItem onClick={() => onSendSignatureRequest(invoice)}>
                            <Send className="w-4 h-4 mr-2" />
                            Send Signature Request
                          </DropdownMenuItem>
                        )}
                      </>
                    )
                  )}

                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => onDelete(invoice)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
