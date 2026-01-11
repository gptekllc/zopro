import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AlertTriangle, Archive, ArchiveRestore, Bell, Briefcase, Calendar, CheckCircle2, ChevronRight, Clock, Copy, Download, Edit, Eye, FileText, Image, Mail, MoreVertical, Navigation, PenTool, Receipt, Save, Send, Trash2 } from "lucide-react";
import { format } from "date-fns";
import type { Job } from "@/hooks/useJobs";
import { DocumentListCard } from "@/components/documents/DocumentListCard";
import type { SwipeAction } from "@/components/ui/swipeable-card";

const JOB_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
type JobPriority = typeof JOB_PRIORITIES[number];

const getInitials = (name: string | null | undefined): string => {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

interface JobListCardProps {
  job: Job;
  notificationCount: number;
  getPriorityColor: (priority: string) => string;
  getStatusColor: (status: string) => string;
  onView: (job: Job) => void;
  onEdit: (job: Job) => void;
  onDuplicate: (job: Job) => void;
  onSaveAsTemplate: (job: Job) => void;
  onPriorityChange: (jobId: string, priority: string) => void;
  onDownload: (job: Job) => void;
  onEmail: (job: Job) => void;
  onSendNotification: (job: Job) => void;
  onOnMyWay: (job: Job, minutes: number) => void;
  onViewSignature: (signatureId: string) => void;
  onOpenSignatureDialog: (job: Job) => void;
  onSendSignatureRequest: (job: Job) => void;
  onCreateInvoice: (job: Job) => void;
  onCreateQuote: (job: Job) => void;
  onArchive: (job: Job) => void;
  onUnarchive: (job: Job) => void;
  onDelete: (job: Job) => void;
  convertToInvoiceIsPending?: boolean;
  convertToQuoteIsPending?: boolean;
  unarchiveIsPending?: boolean;
  showSwipeHint?: boolean;
  onSwipeHintDismiss?: () => void;
}

export function JobListCard({
  job,
  notificationCount,
  getPriorityColor,
  getStatusColor,
  onView,
  onEdit,
  onDuplicate,
  onSaveAsTemplate,
  onPriorityChange,
  onDownload,
  onEmail,
  onSendNotification,
  onOnMyWay,
  onViewSignature,
  onOpenSignatureDialog,
  onSendSignatureRequest,
  onCreateInvoice,
  onCreateQuote,
  onArchive,
  onUnarchive,
  onDelete,
  convertToInvoiceIsPending = false,
  convertToQuoteIsPending = false,
  unarchiveIsPending = false,
  showSwipeHint = false,
  onSwipeHintDismiss
}: JobListCardProps) {
  const signatureId = (job as any).completion_signature_id as string | undefined;

  // Get first assignee for avatar display
  const firstAssignee = job.assignees && job.assignees.length > 0 
    ? job.assignees[0].profile 
    : job.assignee;
  const hasOnLeaveAssignee = job.assignees?.some(a => a.profile?.employment_status === 'on_leave') || job.assignee?.employment_status === 'on_leave';
  const additionalAssignees = job.assignees && job.assignees.length > 1 ? job.assignees.length - 1 : 0;

  // Determine which date to show (only one)
  const now = new Date();
  const isCompleted = job.status === 'completed' || job.status === 'invoiced';
  const scheduledPast = job.scheduled_start && new Date(job.scheduled_start) < now;
  let displayDate: string | null = null;
  let dateLabel: 'completed' | 'scheduled' | 'created' = 'created';
  if (isCompleted || scheduledPast) {
    displayDate = (job as any).actual_end || job.scheduled_start || job.created_at;
    dateLabel = 'completed';
  } else if (job.scheduled_start) {
    displayDate = job.scheduled_start;
    dateLabel = 'scheduled';
  } else {
    displayDate = job.created_at;
    dateLabel = 'created';
  }

  const metadataRow = <>
      {firstAssignee && (
        <span className="flex items-center gap-1">
          <Avatar className="w-5 h-5">
            <AvatarImage src={(firstAssignee as any).avatar_url} />
            <AvatarFallback className="text-[10px] bg-muted">
              {getInitials(firstAssignee.full_name)}
            </AvatarFallback>
          </Avatar>
          {additionalAssignees > 0 && (
            <span className="text-xs text-muted-foreground">+{additionalAssignees}</span>
          )}
          {hasOnLeaveAssignee && (
            <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50 text-[10px] px-1 py-0 ml-1">
              <AlertTriangle className="w-2.5 h-2.5 mr-0.5" />
              On Leave
            </Badge>
          )}
        </span>
      )}
      {displayDate && <>
          {firstAssignee && <span>•</span>}
          <span className="flex items-center gap-1 shrink-0">
            {dateLabel === 'completed' ? <CheckCircle2 className="w-3 h-3" /> : dateLabel === 'scheduled' ? <Calendar className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
            {format(new Date(displayDate), 'MMM d, h:mm a')}
          </span>
        </>}
    </>;

  const tagsRow = <>
      {job.archived_at && <Badge variant="outline" className="text-muted-foreground text-xs sm:text-sm">Archived</Badge>}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Badge className={`${getPriorityColor(job.priority)} text-xs cursor-pointer hover:opacity-80 transition-opacity capitalize`} variant="outline">
            {job.priority}
            <ChevronRight className="w-3 h-3 ml-1 rotate-90" />
          </Badge>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="bg-popover z-50">
          {JOB_PRIORITIES.map(priority => <DropdownMenuItem key={priority} onClick={() => onPriorityChange(job.id, priority)} disabled={job.priority === priority} className={job.priority === priority ? 'bg-accent' : ''}>
              <Badge className={`${getPriorityColor(priority)} mr-2 capitalize`} variant="outline">
                {priority}
              </Badge>
              {job.priority === priority && <CheckCircle2 className="w-4 h-4 ml-auto" />}
            </DropdownMenuItem>)}
        </DropdownMenuContent>
      </DropdownMenu>
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusColor(job.status)}`}>
        {job.status.replace('_', ' ')}
      </span>
      {signatureId && <Badge variant="outline" className="bg-success/10 text-success border-success/30 gap-1 text-xs">
          <PenTool className="w-3 h-3" />
          Signed
        </Badge>}
      {notificationCount > 0 && <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800 gap-1 text-xs">
          <Bell className="w-3 h-3" />
          Notified
        </Badge>}
    </>;

  const actionsMenu = <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 sm:h-9 sm:w-9">
          <MoreVertical className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-popover">
        {['scheduled', 'in_progress'].includes(job.status) && <>
            <DropdownMenuItem onClick={() => onSendNotification(job)}>
              <Send className="w-4 h-4 mr-2" />
              Send to Customer
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onOnMyWay(job, 15)}>
              <Navigation className="w-4 h-4 mr-2" />
              On My Way (~15 min)
            </DropdownMenuItem>
          </>}
        <DropdownMenuItem onClick={() => onDownload(job)}>
          <Download className="w-4 h-4 mr-2" />
          Download PDF
        </DropdownMenuItem>
        {job.customer?.email && <DropdownMenuItem onClick={() => onEmail(job)}>
            <Mail className="w-4 h-4 mr-2" />
            Email PDF
          </DropdownMenuItem>}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onEdit(job)}>
          <Edit className="w-4 h-4 mr-2" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onDuplicate(job)}>
          <Copy className="w-4 h-4 mr-2" />
          Duplicate
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onSaveAsTemplate(job)}>
          <Save className="w-4 h-4 mr-2" />
          Save as Template
        </DropdownMenuItem>
        {signatureId ? <DropdownMenuItem onClick={() => onViewSignature(signatureId)}>
            <Eye className="w-4 h-4 mr-2" />
            View Signature
          </DropdownMenuItem> : (job.status === 'completed' || job.status === 'in_progress') && <>
            <DropdownMenuItem onClick={() => onOpenSignatureDialog(job)}>
              <PenTool className="w-4 h-4 mr-2" />
              Collect Completion Signature
            </DropdownMenuItem>
            {job.customer?.email && <DropdownMenuItem onClick={() => onSendSignatureRequest(job)}>
                <Send className="w-4 h-4 mr-2" />
                Send Signature Request
              </DropdownMenuItem>}
          </>}
        {job.archived_at ? <DropdownMenuItem onClick={() => onUnarchive(job)} disabled={unarchiveIsPending}>
            <ArchiveRestore className="w-4 h-4 mr-2" />
            Unarchive
          </DropdownMenuItem> : <>
            <DropdownMenuItem onClick={() => onCreateInvoice(job)} disabled={convertToInvoiceIsPending}>
              <Receipt className="w-4 h-4 mr-2" />
              Create Invoice
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onCreateQuote(job)} disabled={convertToQuoteIsPending}>
              <FileText className="w-4 h-4 mr-2" />
              Create Quote
            </DropdownMenuItem>
            {(job.status === 'paid' || job.status === 'completed' || job.status === 'invoiced') && <DropdownMenuItem onClick={() => onArchive(job)}>
                <Archive className="w-4 h-4 mr-2" />
                Archive
              </DropdownMenuItem>}
          </>}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onDelete(job)} className="text-destructive focus:text-destructive">
          <Trash2 className="w-4 h-4 mr-2" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>;

  const swipeRightActions: SwipeAction[] = [{
    icon: <Edit className="w-4 h-4" />,
    label: "Edit",
    onClick: () => onEdit(job),
    variant: "default"
  }, ...(job.archived_at ? [{
    icon: <ArchiveRestore className="w-4 h-4" />,
    label: "Restore",
    onClick: () => onUnarchive(job),
    variant: "warning" as const
  }] : [{
    icon: <Archive className="w-4 h-4" />,
    label: "Archive",
    onClick: () => onArchive(job),
    variant: "warning" as const
  }]), {
    icon: <Trash2 className="w-4 h-4" />,
    label: "Delete",
    onClick: () => onDelete(job),
    variant: "destructive"
  }];

  return <DocumentListCard onClick={() => onView(job)} isArchived={!!job.archived_at} documentNumber={job.job_number} title={job.title} customerName={job.customer?.name || "Unknown"} customerEmail={job.customer?.email} total={(job.total ?? 0) > 0 ? Number(job.total) : undefined} metadataRow={metadataRow} notes={job.notes} tagsRow={tagsRow} actionsMenu={actionsMenu} swipeRightActions={swipeRightActions} showSwipeHint={showSwipeHint} onSwipeHintDismiss={onSwipeHintDismiss} />;
}