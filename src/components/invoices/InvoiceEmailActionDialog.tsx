import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { FileText, Bell, Mail, X, Plus, Loader2, ArrowLeft, CheckCircle, Send } from 'lucide-react';

type EmailActionType = 'invoice' | 'reminder';
type Step = 'select' | 'compose' | 'preview' | 'success';

interface InvoiceEmailActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceNumber?: string;
  customerName?: string;
  customerEmail?: string;
  companyName?: string;
  invoiceTotal?: number;
  dueDate?: string;
  onSendInvoice: (emails: string[], subject: string, message: string) => Promise<void>;
  onSendReminder: (emails: string[], subject: string, message: string) => Promise<void>;
  isSendingInvoice?: boolean;
  isSendingReminder?: boolean;
  showReminderOption?: boolean;
}

export function InvoiceEmailActionDialog({
  open,
  onOpenChange,
  invoiceNumber,
  customerName,
  customerEmail,
  companyName = 'Our Company',
  invoiceTotal,
  dueDate,
  onSendInvoice,
  onSendReminder,
  isSendingInvoice = false,
  isSendingReminder = false,
  showReminderOption = true,
}: InvoiceEmailActionDialogProps) {
  const [step, setStep] = useState<Step>('select');
  const [actionType, setActionType] = useState<EmailActionType>('invoice');
  const [emails, setEmails] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [sentEmails, setSentEmails] = useState<string[]>([]);

  const getDefaultSubject = (type: EmailActionType) => {
    if (type === 'invoice') {
      return `Invoice ${invoiceNumber || ''} from ${companyName}`;
    }
    return `Payment Reminder: Invoice ${invoiceNumber || ''} from ${companyName}`;
  };

  const getDefaultMessage = (type: EmailActionType) => {
    const greeting = customerName ? `Dear ${customerName},` : 'Hello,';
    const totalStr = invoiceTotal ? `$${invoiceTotal.toFixed(2)}` : '';
    const dueDateStr = dueDate ? new Date(dueDate).toLocaleDateString() : '';

    if (type === 'invoice') {
      return `${greeting}

Please find attached invoice ${invoiceNumber || ''}${totalStr ? ` for ${totalStr}` : ''}.${dueDateStr ? ` Payment is due by ${dueDateStr}.` : ''}

If you have any questions, please don't hesitate to reach out.

Thank you for your business!

Best regards,
${companyName}`;
    }
    
    return `${greeting}

This is a friendly reminder that invoice ${invoiceNumber || ''}${totalStr ? ` for ${totalStr}` : ''} is ${dueDateStr ? `due on ${dueDateStr}` : 'outstanding'}.

We would appreciate your prompt attention to this matter. If you have already made payment, please disregard this reminder.

If you have any questions, please contact us.

Thank you,
${companyName}`;
  };

  useEffect(() => {
    if (open) {
      setStep('select');
      setActionType('invoice');
      setEmails(customerEmail ? [customerEmail] : []);
      setNewEmail('');
      setSubject('');
      setMessage('');
      setSentEmails([]);
    }
  }, [open, customerEmail]);

  const handleSelectAction = (type: EmailActionType) => {
    setActionType(type);
    setSubject(getDefaultSubject(type));
    setMessage(getDefaultMessage(type));
    setStep('compose');
  };

  const handleAddEmail = () => {
    const trimmed = newEmail.trim();
    if (trimmed && !emails.includes(trimmed) && trimmed.includes('@')) {
      setEmails([...emails, trimmed]);
      setNewEmail('');
    }
  };

  const handleRemoveEmail = (email: string) => {
    setEmails(emails.filter(e => e !== email));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddEmail();
    }
  };

  const handleContinueToPreview = () => {
    if (emails.length === 0) return;
    setStep('preview');
  };

  const handleSend = async () => {
    if (emails.length === 0) return;
    
    try {
      if (actionType === 'invoice') {
        await onSendInvoice(emails, subject, message);
      } else {
        await onSendReminder(emails, subject, message);
      }
      setSentEmails([...emails]);
      setStep('success');
    } catch {
      // Error handled by parent
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  const isSending = actionType === 'invoice' ? isSendingInvoice : isSendingReminder;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {step === 'select' && 'Email Options'}
            {step === 'compose' && (actionType === 'invoice' ? 'Compose Invoice Email' : 'Compose Reminder Email')}
            {step === 'preview' && 'Preview & Send'}
            {step === 'success' && 'Email Sent'}
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: Select action type */}
        {step === 'select' && (
          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full justify-start h-auto py-4 px-4"
              onClick={() => handleSelectAction('invoice')}
            >
              <FileText className="w-5 h-5 mr-3 text-primary" />
              <div className="text-left">
                <div className="font-medium">Send Invoice</div>
                <div className="text-sm text-muted-foreground">
                  Email invoice {invoiceNumber ? `#${invoiceNumber}` : ''} to customer
                </div>
              </div>
            </Button>

            {showReminderOption && (
              <Button
                variant="outline"
                className="w-full justify-start h-auto py-4 px-4"
                onClick={() => handleSelectAction('reminder')}
              >
                <Bell className="w-5 h-5 mr-3 text-orange-500" />
                <div className="text-left">
                  <div className="font-medium">Send Payment Reminder</div>
                  <div className="text-sm text-muted-foreground">
                    Remind customer about outstanding payment
                  </div>
                </div>
              </Button>
            )}
          </div>
        )}

        {/* Step 2: Compose email with recipients and message */}
        {step === 'compose' && (
          <div className="space-y-4">
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2"
              onClick={() => setStep('select')}
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Back
            </Button>

            <div className="space-y-2">
              <Label>Recipients</Label>
              <div className="flex flex-wrap gap-2 min-h-[32px] p-2 border rounded-md bg-background">
                {emails.map((email) => (
                  <Badge key={email} variant="secondary" className="flex items-center gap-1">
                    <Mail className="w-3 h-3" />
                    {email}
                    <button
                      type="button"
                      onClick={() => handleRemoveEmail(email)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
                {emails.length === 0 && (
                  <span className="text-muted-foreground text-sm">No recipients added</span>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Add email address"
                  className="text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleAddEmail}
                  disabled={!newEmail.trim() || !newEmail.includes('@')}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Subject</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email subject"
              />
            </div>

            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Email message"
                rows={6}
                className="text-sm"
              />
              <p className="text-xs text-muted-foreground">
                The invoice PDF will be attached automatically.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleContinueToPreview}
                disabled={emails.length === 0 || !subject.trim()}
              >
                Preview
                <ArrowLeft className="w-4 h-4 ml-1 rotate-180" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Preview before sending */}
        {step === 'preview' && (
          <div className="space-y-4">
            <Button
              variant="ghost"
              size="sm"
              className="-ml-2"
              onClick={() => setStep('compose')}
            >
              <ArrowLeft className="w-4 h-4 mr-1" />
              Edit
            </Button>

            <div className="space-y-3 p-4 bg-muted/50 rounded-lg">
              <div>
                <Label className="text-xs text-muted-foreground">To</Label>
                <div className="flex flex-wrap gap-1 mt-1">
                  {emails.map((email) => (
                    <Badge key={email} variant="secondary" className="text-xs">
                      {email}
                    </Badge>
                  ))}
                </div>
              </div>
              
              <Separator />
              
              <div>
                <Label className="text-xs text-muted-foreground">Subject</Label>
                <p className="text-sm font-medium mt-1">{subject}</p>
              </div>
              
              <Separator />
              
              <div>
                <Label className="text-xs text-muted-foreground">Message</Label>
                <p className="text-sm mt-1 whitespace-pre-wrap">{message}</p>
              </div>
              
              <Separator />
              
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <FileText className="w-4 h-4" />
                <span>Attachment: {invoiceNumber || 'Invoice'}.pdf</span>
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleSend}
                disabled={isSending}
              >
                {isSending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Send {actionType === 'invoice' ? 'Invoice' : 'Reminder'}
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Success confirmation */}
        {step === 'success' && (
          <div className="space-y-4 text-center py-4">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            
            <div>
              <h3 className="font-semibold text-lg">
                {actionType === 'invoice' ? 'Invoice Sent!' : 'Reminder Sent!'}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Your email has been sent successfully.
              </p>
            </div>
            
            <div className="text-left p-4 bg-muted/50 rounded-lg">
              <Label className="text-xs text-muted-foreground">Sent to {sentEmails.length} recipient{sentEmails.length > 1 ? 's' : ''}</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {sentEmails.map((email) => (
                  <Badge key={email} variant="secondary" className="flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-green-600" />
                    {email}
                  </Badge>
                ))}
              </div>
            </div>
            
            <Button onClick={handleClose} className="w-full">
              Done
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
