import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Archive,
  ArchiveRestore,
  ArrowRight,
  BookTemplate,
  Briefcase,
  CheckCircle,
  Copy,
  Edit,
  Eye,
  FileDown,
  FileText,
  Loader2,
  Mail,
  MoreVertical,
  PenTool,
  Plus,
  Receipt,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import type { Quote } from "@/hooks/useQuotes";
import { DocumentListCard } from "@/components/documents/DocumentListCard";
import type { SwipeAction } from "@/components/ui/swipeable-card";

const quoteStatusColors: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-primary/10 text-primary",
  accepted: "bg-success/10 text-success",
  rejected: "bg-destructive/10 text-destructive",
  expired: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
};

const getInitials = (name: string | null | undefined): string => {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

interface QuoteListCardProps {
  quote: Quote;
  jobsCount?: number;
  invoicesCount?: number;
  isConverting?: boolean;
  onView: (quote: Quote) => void;
  onEdit: (quote: Quote) => void;
  onDuplicate: (quote: Quote) => void;
  onSaveAsTemplate: (quote: Quote) => void;
  onDownload: (quoteId: string) => void;
  onEmail: (quoteId: string, customerId: string) => void;
  onConvertToInvoice: (quote: Quote) => void;
  onViewSignature?: (signatureId: string) => void;
  onCreateJob?: (quote: Quote) => void;
  onAddToJob?: (quote: Quote) => void;
  onArchive: (quote: Quote) => void;
  onUnarchive: (quote: Quote) => void;
  onDelete: (quote: Quote) => void;
  onStatusChange: (quoteId: string, status: string) => void;
  showSwipeHint?: boolean;
  onSwipeHintDismiss?: () => void;
}

// Map database status to display label (accepted -> Approved)
const getStatusLabel = (status: string) => {
  if (status === 'accepted') return 'approved';
  return status;
};

// Map display status back to database status (approved -> accepted)
const getDbStatus = (displayStatus: string) => {
  if (displayStatus === 'approved') return 'accepted';
  return displayStatus;
};

export function QuoteListCard({
  quote,
  jobsCount = 0,
  invoicesCount = 0,
  isConverting = false,
  onView,
  onEdit,
  onDuplicate,
  onSaveAsTemplate,
  onDownload,
  onEmail,
  onConvertToInvoice,
  onViewSignature,
  onCreateJob,
  onAddToJob,
  onArchive,
  onUnarchive,
  onDelete,
  onStatusChange,
  showSwipeHint = false,
  onSwipeHintDismiss,
}: QuoteListCardProps) {
  const signatureId = quote.signature_id;
  const archivedAt = (quote as any).archived_at as string | undefined;
  const customerName = quote.customer?.name || "Unknown";
  const customerEmail = quote.customer?.email || null;
  const creator = (quote as any).creator as { full_name: string | null; avatar_url?: string | null } | null;

  const metadataRow = (
    <>
      {creator && (
        <span className="flex items-center gap-1">
          <Avatar className="w-5 h-5">
            <AvatarImage src={creator.avatar_url || undefined} />
            <AvatarFallback className="text-[10px] bg-muted">
              {getInitials(creator.full_name)}
            </AvatarFallback>
          </Avatar>
        </span>
      )}
      {quote.valid_until && (
        <>
          {creator && <span>•</span>}
          <span className="shrink-0">
            <span className="sm:hidden">Valid: {format(new Date(quote.valid_until), 'MMM d')}</span>
            <span className="hidden sm:inline">Valid until {format(new Date(quote.valid_until), 'MMM d, yyyy')}</span>
          </span>
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
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize cursor-pointer hover:opacity-80 transition-opacity flex items-center gap-1 ${quoteStatusColors[quote.status] || "bg-muted"}`}>
            {getStatusLabel(quote.status)}
            <FileText className="w-3 h-3" />
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="bg-popover z-50">
          {['draft', 'sent', 'approved', 'rejected'].map(displayStatus => {
            const dbStatus = getDbStatus(displayStatus);
            return (
              <DropdownMenuItem
                key={displayStatus}
                onClick={() => onStatusChange(quote.id, dbStatus)}
                disabled={quote.status === dbStatus}
                className={quote.status === dbStatus ? 'bg-accent' : ''}
              >
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize mr-2 ${quoteStatusColors[dbStatus] || "bg-muted"}`}>
                  {displayStatus}
                </span>
                {quote.status === dbStatus && <CheckCircle className="w-4 h-4 ml-auto" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
      {signatureId && (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success flex items-center gap-1">
          <PenTool className="w-3 h-3" />
          Signed
        </span>
      )}
      {jobsCount > 0 && (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary flex items-center gap-1">
          <Briefcase className="w-3 h-3" />
          {jobsCount} Job{jobsCount > 1 ? 's' : ''}
        </span>
      )}
      {invoicesCount > 0 && (
        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400 flex items-center gap-1">
          <Receipt className="w-3 h-3" />
          {invoicesCount} Invoice{invoicesCount > 1 ? 's' : ''}
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
        <DropdownMenuItem onClick={() => onEdit(quote)}>
          <Edit className="w-4 h-4 mr-2" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onDuplicate(quote)}>
          <Copy className="w-4 h-4 mr-2" />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onSaveAsTemplate(quote)}>
          <BookTemplate className="w-4 h-4 mr-2" />
          Save as Template
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onDownload(quote.id)}>
          <FileDown className="w-4 h-4 mr-2" />
          Download PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onEmail(quote.id, quote.customer_id)}>
          <Mail className="w-4 h-4 mr-2" />
          Email Quote
        </DropdownMenuItem>
        <DropdownMenuItem 
          onClick={() => onConvertToInvoice(quote)}
          disabled={isConverting}
        >
          {isConverting ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <ArrowRight className="w-4 h-4 mr-2" />
          )}
          Convert to Invoice
        </DropdownMenuItem>
        {signatureId && onViewSignature && (
          <DropdownMenuItem onClick={() => onViewSignature(signatureId)}>
            <Eye className="w-4 h-4 mr-2" />
            View Signature
          </DropdownMenuItem>
        )}
        {quote.status === 'accepted' && (onCreateJob || onAddToJob) && (
          <>
            <DropdownMenuSeparator />
            {onCreateJob && (
              <DropdownMenuItem onClick={() => onCreateJob(quote)}>
                <Plus className="w-4 h-4 mr-2" />
                Create New Job
              </DropdownMenuItem>
            )}
            {onAddToJob && (
              <DropdownMenuItem onClick={() => onAddToJob(quote)}>
                <Briefcase className="w-4 h-4 mr-2" />
                Add to Existing Job
              </DropdownMenuItem>
            )}
          </>
        )}
        <DropdownMenuSeparator />
        {archivedAt ? (
          <DropdownMenuItem onClick={() => onUnarchive(quote)}>
            <ArchiveRestore className="w-4 h-4 mr-2" />
            Restore
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onClick={() => onArchive(quote)}>
            <Archive className="w-4 h-4 mr-2" />
            Archive
          </DropdownMenuItem>
        )}
        <DropdownMenuItem onClick={() => onDelete(quote)} className="text-destructive focus:text-destructive">
          <Trash2 className="w-4 h-4 mr-2" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const swipeRightActions: SwipeAction[] = [
    {
      icon: <Edit className="w-4 h-4" />,
      label: "Edit",
      onClick: () => onEdit(quote),
      variant: "default",
    },
    ...(archivedAt
      ? [{
          icon: <ArchiveRestore className="w-4 h-4" />,
          label: "Restore",
          onClick: () => onUnarchive(quote),
          variant: "warning" as const,
        }]
      : [{
          icon: <Archive className="w-4 h-4" />,
          label: "Archive",
          onClick: () => onArchive(quote),
          variant: "warning" as const,
        }]),
    {
      icon: <Trash2 className="w-4 h-4" />,
      label: "Delete",
      onClick: () => onDelete(quote),
      variant: "destructive",
    },
  ];

  return (
    <DocumentListCard
      onClick={() => onView(quote)}
      isArchived={!!archivedAt}
      documentNumber={quote.quote_number}
      customerName={customerName}
      customerEmail={customerEmail}
      total={Number(quote.total)}
      metadataRow={metadataRow}
      tagsRow={tagsRow}
      actionsMenu={actionsMenu}
      swipeRightActions={swipeRightActions}
      showSwipeHint={showSwipeHint}
      onSwipeHintDismiss={onSwipeHintDismiss}
    />
  );
}