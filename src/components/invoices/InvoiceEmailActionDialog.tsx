import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { FileText, Bell, Mail, X, Plus, Loader2, ArrowLeft } from 'lucide-react';

type EmailActionType = 'invoice' | 'reminder';

interface InvoiceEmailActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceNumber?: string;
  customerEmail?: string;
  onSendInvoice: (emails: string[]) => Promise<void>;
  onSendReminder: (emails: string[]) => Promise<void>;
  isSendingInvoice?: boolean;
  isSendingReminder?: boolean;
  showReminderOption?: boolean;
}

export function InvoiceEmailActionDialog({
  open,
  onOpenChange,
  invoiceNumber,
  customerEmail,
  onSendInvoice,
  onSendReminder,
  isSendingInvoice = false,
  isSendingReminder = false,
  showReminderOption = true,
}: InvoiceEmailActionDialogProps) {
  const [step, setStep] = useState<'select' | 'compose'>('select');
  const [actionType, setActionType] = useState<EmailActionType>('invoice');
  const [emails, setEmails] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState('');

  useEffect(() => {
    if (open) {
      setStep('select');
      setActionType('invoice');
      setEmails(customerEmail ? [customerEmail] : []);
      setNewEmail('');
    }
  }, [open, customerEmail]);

  const handleSelectAction = (type: EmailActionType) => {
    setActionType(type);
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

  const handleSend = async () => {
    if (emails.length === 0) return;
    
    if (actionType === 'invoice') {
      await onSendInvoice(emails);
    } else {
      await onSendReminder(emails);
    }
    onOpenChange(false);
  };

  const isSending = actionType === 'invoice' ? isSendingInvoice : isSendingReminder;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === 'select' ? 'Email Options' : (
              actionType === 'invoice' ? 'Send Invoice' : 'Send Payment Reminder'
            )}
          </DialogTitle>
        </DialogHeader>

        {step === 'select' ? (
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
                  Email the invoice {invoiceNumber ? `#${invoiceNumber}` : ''} to customer
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
        ) : (
          <div className="space-y-4">
            <Button
              variant="ghost"
              size="sm"
              className="mb-2 -ml-2"
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
            </div>

            <div className="space-y-2">
              <Label>Add Email Address</Label>
              <div className="flex gap-2">
                <Input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="email@example.com"
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
              <p className="text-xs text-muted-foreground">
                Press Enter or click + to add multiple recipients
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                onClick={handleSend}
                disabled={isSending || emails.length === 0}
              >
                {isSending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {actionType === 'invoice' ? 'Send Invoice' : 'Send Reminder'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
