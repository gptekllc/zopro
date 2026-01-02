import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Mail,
  MoreVertical,
  PenTool,
  Send,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { DocumentListCard } from "@/components/shared/DocumentListCard";
import type { Invoice } from "@/hooks/useInvoices";

type Props = {
  invoice: Invoice;
  lateFeePercentage: number;

  getCustomerName: (customerId: string) => string;
  getCustomerEmail: (customerId: string) => string | null;

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

const invoiceStatusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  paid: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  overdue: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

export function InvoiceListCard({
  invoice,
  lateFeePercentage,
  getCustomerName,
  getCustomerEmail,
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
  const itemCount = (invoice as any).items?.length ?? 0;

  const total = typeof invoice.total === "string" ? Number(invoice.total) : invoice.total ?? 0;
  const totalFormatted = `$${total.toFixed(2)}`;

  const hasLateFee = invoice.late_fee_amount && invoice.late_fee_amount > 0;
  const lateFeeFormatted = hasLateFee ? `+$${Number(invoice.late_fee_amount).toFixed(2)} late fee` : null;
  const grandTotal = hasLateFee ? `$${getTotalWithLateFee(invoice).toFixed(2)}` : null;

  const statusColorClass = invoiceStatusColors[invoice.status] || "bg-muted text-muted-foreground";

  const customerName = getCustomerName(invoice.customer_id);
  const dueText = invoice.due_date ? `Due ${format(new Date(invoice.due_date), "MMM d")}` : null;

  return (
    <DocumentListCard
      documentNumber={invoice.invoice_number}
      status={invoice.status}
      statusColorClass={statusColorClass}
      totalFormatted={hasLateFee ? grandTotal! : totalFormatted}
      itemCount={itemCount}
      notes={invoice.notes}
      onClick={() => onOpen(invoice)}
      secondaryInfo={
        <>
          <span className="truncate">{customerName}</span>
          {dueText && (
            <>
              <span className="hidden sm:inline">•</span>
              <span className="hidden sm:inline">{dueText}</span>
            </>
          )}
          {hasLateFee && (
            <>
              <span className="hidden sm:inline">•</span>
              <span className="text-destructive hidden sm:inline">{lateFeeFormatted}</span>
            </>
          )}
        </>
      }
      extraBadges={
        signatureId ? (
          <Badge className="bg-success/10 text-success text-xs" variant="secondary">
            <PenTool className="w-3 h-3 mr-1" />
            Signed
          </Badge>
        ) : null
      }
      actionButton={
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          {/* Status dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="text-xs h-7 px-2">
                Change Status
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover z-50">
              {["draft", "sent", "paid", "overdue"].map((status) => (
                <DropdownMenuItem
                  key={status}
                  onClick={() => onStatusChange(invoice.id, status)}
                  disabled={invoice.status === status}
                  className={invoice.status === status ? "bg-accent" : ""}
                >
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize mr-2 ${
                      invoiceStatusColors[status] || "bg-muted"
                    }`}
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

          {/* Actions dropdown */}
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
      }
    />
  );
}
