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
  Briefcase,
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
  UserCog,
} from "lucide-react";
import { format } from "date-fns";
import type { Invoice } from "@/hooks/useInvoices";
import { DocumentListCard } from "@/components/documents/DocumentListCard";

type Props = {
  invoice: Invoice;
  lateFeePercentage: number;

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
  sent: "bg-primary/10 text-primary",
  paid: "bg-success/10 text-success",
  overdue: "bg-destructive/10 text-destructive",
};

export function InvoiceListCard({
  invoice,
  lateFeePercentage,
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

  const total = typeof invoice.total === "string" ? Number(invoice.total) : invoice.total ?? 0;
  const hasLateFee = invoice.late_fee_amount && invoice.late_fee_amount > 0 && lateFeePercentage > 0;
  const displayTotal = hasLateFee ? getTotalWithLateFee(invoice) : total;

  const customerName = invoice.customer?.name || "Unknown";
  const customerEmail = invoice.customer?.email || null;
  const creatorName = (invoice as any).creator?.full_name || null;
  const dueText = invoice.due_date ? format(new Date(invoice.due_date), "MMM d") : null;
  
  // Get linked job number - prefer direct job_id link, fallback to quote's job
  const linkedJobNumber = (invoice as any).job?.job_number || (invoice as any).quote?.job?.job_number || null;

  const metadataRow = (
    <>
      {creatorName && (
        <span className="flex items-center gap-1">
          <UserCog className="w-3 h-3" />
          {creatorName}
        </span>
      )}
      {linkedJobNumber && (
        <>
          {creatorName && <span>•</span>}
          <span className="flex items-center gap-1">
            <Briefcase className="w-3 h-3" />
            {linkedJobNumber}
          </span>
        </>
      )}
      {dueText && (
        <>
          {(creatorName || linkedJobNumber) && <span>•</span>}
          <span className="shrink-0">Due {dueText}</span>
        </>
      )}
    </>
  );

  const tagsRow = (
    <>
      {archivedAt && (
        <Badge variant="outline" className="text-muted-foreground text-xs">Archived</Badge>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-1 ${invoiceStatusColors[invoice.status] || "bg-muted"}`}>
            {invoice.status}
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="bg-popover z-50">
          {["draft", "sent", "paid", "overdue"].map((status) => (
            <DropdownMenuItem
              key={status}
              onClick={() => onStatusChange(invoice.id, status)}
              disabled={invoice.status === status}
              className={invoice.status === status ? "bg-accent" : ""}
            >
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize mr-2 ${invoiceStatusColors[status] || "bg-muted"}`}>
                {status}
              </span>
              {invoice.status === status && <CheckCircle className="w-4 h-4 ml-auto" />}
            </DropdownMenuItem>
          ))}
          {isInvoiceOverdue(invoice) && !invoice.late_fee_amount && lateFeePercentage > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => onApplyLateFee(invoice.id)} className="text-destructive">
                <AlertCircle className="w-4 h-4 mr-2" />
                Apply {lateFeePercentage}% Late Fee
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {signatureId && (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success flex items-center gap-1">
          <PenTool className="w-3 h-3" />
          Signed
        </span>
      )}
    </>
  );

  const actionsMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-9 sm:w-9">
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
              {customerEmail && (
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
        <DropdownMenuItem onClick={() => onDelete(invoice)} className="text-destructive focus:text-destructive">
          <Trash2 className="w-4 h-4 mr-2" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <DocumentListCard
      onClick={() => onOpen(invoice)}
      isArchived={!!archivedAt}
      documentNumber={invoice.invoice_number}
      customerName={customerName}
      customerEmail={customerEmail}
      total={displayTotal}
      metadataRow={metadataRow}
      notes={invoice.notes}
      tagsRow={tagsRow}
      actionsMenu={actionsMenu}
    />
  );
}
