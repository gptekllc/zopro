import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { Separator } from '@/components/ui/separator';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { FileText, Bell, Mail, X, Plus, Loader2, ArrowLeft, CheckCircle, Send, Save, ChevronDown, Trash2, Star } from 'lucide-react';
import { useEmailTemplates, useCreateEmailTemplate, useDeleteEmailTemplate, EmailTemplate } from '@/hooks/useEmailTemplates';

type EmailActionType = 'invoice' | 'reminder';
type Step = 'select' | 'compose' | 'preview' | 'success';

interface InvoiceEmailActionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceNumber?: string;
  customerName?: string;
  customerEmail?: string;
  companyName?: string;
  companyPhone?: string;
  companyEmail?: string;
  invoiceTotal?: number;
  dueDate?: string;
  invoiceId?: string;
  onSendInvoice: (emails: string[], subject: string, message: string, cc?: string[], bcc?: string[]) => Promise<void>;
  onSendReminder: (emails: string[], subject: string, message: string, cc?: string[], bcc?: string[]) => Promise<void>;
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
  companyPhone = '',
  companyEmail: companyEmailProp = '',
  invoiceTotal,
  dueDate,
  invoiceId,
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
  
  // CC/BCC fields
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [ccEmails, setCcEmails] = useState<string[]>([]);
  const [bccEmails, setBccEmails] = useState<string[]>([]);
  const [newCcEmail, setNewCcEmail] = useState('');
  const [newBccEmail, setNewBccEmail] = useState('');
  
  // Template management
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [saveTemplateDialogOpen, setSaveTemplateDialogOpen] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const [deleteTemplateId, setDeleteTemplateId] = useState<string | null>(null);
  
  const { data: templates = [] } = useEmailTemplates(actionType);
  const createTemplate = useCreateEmailTemplate();
  const deleteTemplate = useDeleteEmailTemplate();

  // Replace placeholder variables with actual values
  const replacePlaceholders = (text: string) => {
    const totalStr = invoiceTotal ? `$${invoiceTotal.toFixed(2)}` : '';
    const dueDateStr = dueDate ? new Date(dueDate).toLocaleDateString() : '';
    const todayStr = new Date().toLocaleDateString();
    
    // Build customer portal link if invoiceId is provided
    // Use production domain for portal links
    const baseUrl = 'https://zopro.app';
    const portalLink = invoiceId 
      ? `${baseUrl}/customer-portal?invoiceId=${invoiceId}`
      : '';
    
    return text
      .replace(/\{\{customer_name\}\}/g, customerName || '')
      .replace(/\{\{company_name\}\}/g, companyName)
      .replace(/\{\{company_phone\}\}/g, companyPhone)
      .replace(/\{\{company_email\}\}/g, companyEmailProp)
      .replace(/\{\{invoice_number\}\}/g, invoiceNumber || '')
      .replace(/\{\{invoice_total\}\}/g, totalStr)
      .replace(/\{\{due_date\}\}/g, dueDateStr)
      .replace(/\{\{today_date\}\}/g, todayStr)
      .replace(/\{\{customer_portal_link\}\}/g, portalLink)
      .replace(/\{\{payment_link\}\}/g, portalLink)
      // Remove social links placeholder as it's handled by the edge function
      .replace(/\{\{social_links\}\}/g, '')
      // Also handle quote and job numbers if they're in the subject/body
      .replace(/\{\{quote_number\}\}/g, '')
      .replace(/\{\{job_number\}\}/g, '')
      // Remove any remaining unhandled placeholders
      .replace(/\{\{[^}]+\}\}/g, '');
  };

  // No static default messages - use templates only
  const getDefaultSubject = (type: EmailActionType) => {
    return '';
  };

  const getDefaultMessage = (type: EmailActionType) => {
    return '';
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
      setCcEmails([]);
      setBccEmails([]);
      setNewCcEmail('');
      setNewBccEmail('');
      setShowCcBcc(false);
      setSelectedTemplateId('');
    }
  }, [open, customerEmail]);

  // Apply default template when entering compose step
  const applyDefaultTemplate = (type: EmailActionType) => {
    const defaultTemplate = templates.find(t => t.template_type === type && t.is_default);
    if (defaultTemplate) {
      setSubject(replacePlaceholders(defaultTemplate.subject));
      setMessage(replacePlaceholders(defaultTemplate.body));
      setSelectedTemplateId(defaultTemplate.id);
    } else {
      setSubject(getDefaultSubject(type));
      setMessage(getDefaultMessage(type));
      setSelectedTemplateId('');
    }
  };

  const handleSelectAction = (type: EmailActionType) => {
    setActionType(type);
    setStep('compose');
    applyDefaultTemplate(type);
  };

  // Re-apply template if templates load after entering compose and fields are empty
  useEffect(() => {
    if (step === 'compose' && templates.length > 0 && !selectedTemplateId && !subject && !message) {
      applyDefaultTemplate(actionType);
    }
  }, [templates, step, selectedTemplateId, subject, message, actionType]);

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = templates.find(t => t.id === templateId);
    if (template) {
      // Replace placeholders with actual values when loading template
      setSubject(replacePlaceholders(template.subject));
      setMessage(replacePlaceholders(template.body));
    }
  };

  const handleSaveTemplate = async () => {
    if (!newTemplateName.trim()) return;
    
    await createTemplate.mutateAsync({
      name: newTemplateName.trim(),
      template_type: actionType,
      subject,
      body: message,
      is_default: saveAsDefault,
    });
    
    setSaveTemplateDialogOpen(false);
    setNewTemplateName('');
    setSaveAsDefault(false);
  };

  const handleDeleteTemplate = async () => {
    if (!deleteTemplateId) return;
    await deleteTemplate.mutateAsync(deleteTemplateId);
    setDeleteTemplateId(null);
    if (selectedTemplateId === deleteTemplateId) {
      setSelectedTemplateId('');
    }
  };

  const addEmail = (email: string, list: string[], setList: (v: string[]) => void, setNew: (v: string) => void) => {
    const trimmed = email.trim();
    if (trimmed && !list.includes(trimmed) && trimmed.includes('@')) {
      setList([...list, trimmed]);
      setNew('');
    }
  };

  const removeEmail = (email: string, list: string[], setList: (v: string[]) => void) => {
    setList(list.filter(e => e !== email));
  };

  const handleKeyDown = (e: React.KeyboardEvent, email: string, list: string[], setList: (v: string[]) => void, setNew: (v: string) => void) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addEmail(email, list, setList, setNew);
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
        await onSendInvoice(emails, subject, message, ccEmails.length > 0 ? ccEmails : undefined, bccEmails.length > 0 ? bccEmails : undefined);
      } else {
        await onSendReminder(emails, subject, message, ccEmails.length > 0 ? ccEmails : undefined, bccEmails.length > 0 ? bccEmails : undefined);
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

  const EmailBadgeList = ({ 
    emails: emailList, 
    onRemove, 
    placeholder 
  }: { 
    emails: string[]; 
    onRemove: (email: string) => void; 
    placeholder: string;
  }) => (
    <div className="flex flex-wrap gap-1.5 min-h-[28px]">
      {emailList.map((email) => (
        <Badge key={email} variant="secondary" className="flex items-center gap-1 text-xs">
          {email}
          <button
            type="button"
            onClick={() => onRemove(email)}
            className="ml-0.5 hover:text-destructive"
          >
            <X className="w-3 h-3" />
          </button>
        </Badge>
      ))}
      {emailList.length === 0 && (
        <span className="text-muted-foreground text-xs">{placeholder}</span>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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

            {/* Template selector */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Template</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setSaveTemplateDialogOpen(true)}
                >
                  <Save className="w-3 h-3 mr-1" />
                  Save as Template
                </Button>
              </div>
                <Select value={selectedTemplateId} onValueChange={handleTemplateChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      <div className="flex items-center gap-2">
                        {template.is_default && <Star className="w-3 h-3 text-yellow-500" />}
                        {template.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTemplateId && selectedTemplateId !== 'default' && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-destructive hover:text-destructive"
                  onClick={() => setDeleteTemplateId(selectedTemplateId)}
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Delete Template
                </Button>
              )}
            </div>

            {/* To field */}
            <div className="space-y-2">
              <Label>To</Label>
              <div className="space-y-2 p-2 border rounded-md bg-background">
                <EmailBadgeList 
                  emails={emails} 
                  onRemove={(e) => removeEmail(e, emails, setEmails)}
                  placeholder="No recipients added"
                />
                <div className="flex gap-2">
                  <Input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, newEmail, emails, setEmails, setNewEmail)}
                    placeholder="Add email address"
                    className="text-sm h-8"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => addEmail(newEmail, emails, setEmails, setNewEmail)}
                    disabled={!newEmail.trim() || !newEmail.includes('@')}
                    className="h-8 px-2"
                  >
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* CC/BCC collapsible */}
            <Collapsible open={showCcBcc} onOpenChange={setShowCcBcc}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
                  <ChevronDown className={`w-4 h-4 mr-1 transition-transform ${showCcBcc ? 'rotate-180' : ''}`} />
                  {showCcBcc ? 'Hide' : 'Show'} CC & BCC
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="space-y-3 pt-2">
                {/* CC field */}
                <div className="space-y-2">
                  <Label className="text-sm">CC</Label>
                  <div className="space-y-2 p-2 border rounded-md bg-background">
                    <EmailBadgeList 
                      emails={ccEmails} 
                      onRemove={(e) => removeEmail(e, ccEmails, setCcEmails)}
                      placeholder="No CC recipients"
                    />
                    <div className="flex gap-2">
                      <Input
                        type="email"
                        value={newCcEmail}
                        onChange={(e) => setNewCcEmail(e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, newCcEmail, ccEmails, setCcEmails, setNewCcEmail)}
                        placeholder="Add CC email"
                        className="text-sm h-8"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addEmail(newCcEmail, ccEmails, setCcEmails, setNewCcEmail)}
                        disabled={!newCcEmail.trim() || !newCcEmail.includes('@')}
                        className="h-8 px-2"
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                {/* BCC field */}
                <div className="space-y-2">
                  <Label className="text-sm">BCC</Label>
                  <div className="space-y-2 p-2 border rounded-md bg-background">
                    <EmailBadgeList 
                      emails={bccEmails} 
                      onRemove={(e) => removeEmail(e, bccEmails, setBccEmails)}
                      placeholder="No BCC recipients"
                    />
                    <div className="flex gap-2">
                      <Input
                        type="email"
                        value={newBccEmail}
                        onChange={(e) => setNewBccEmail(e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, newBccEmail, bccEmails, setBccEmails, setNewBccEmail)}
                        placeholder="Add BCC email"
                        className="text-sm h-8"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addEmail(newBccEmail, bccEmails, setBccEmails, setNewBccEmail)}
                        disabled={!newBccEmail.trim() || !newBccEmail.includes('@')}
                        className="h-8 px-2"
                      >
                        <Plus className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>

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
              <RichTextEditor
                value={message}
                onChange={setMessage}
                placeholder="Email message"
                className="min-h-[150px]"
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

            <div className="space-y-3 p-4 bg-muted/50 rounded-lg text-sm">
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
              
              {ccEmails.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <Label className="text-xs text-muted-foreground">CC</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {ccEmails.map((email) => (
                        <Badge key={email} variant="outline" className="text-xs">
                          {email}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}
              
              {bccEmails.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <Label className="text-xs text-muted-foreground">BCC</Label>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {bccEmails.map((email) => (
                        <Badge key={email} variant="outline" className="text-xs">
                          {email}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </>
              )}
              
              <Separator />
              
              <div>
                <Label className="text-xs text-muted-foreground">Subject</Label>
                <p className="font-medium mt-1">{subject}</p>
              </div>
              
              <Separator />
              
              <div>
                <Label className="text-xs text-muted-foreground">Message</Label>
                <div 
                  className="mt-1 prose prose-sm dark:prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: message }}
                />
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
              {(ccEmails.length > 0 || bccEmails.length > 0) && (
                <p className="text-xs text-muted-foreground mt-2">
                  {ccEmails.length > 0 && `CC: ${ccEmails.length}`}
                  {ccEmails.length > 0 && bccEmails.length > 0 && ', '}
                  {bccEmails.length > 0 && `BCC: ${bccEmails.length}`}
                </p>
              )}
            </div>
            
            <Button onClick={handleClose} className="w-full">
              Done
            </Button>
          </div>
        )}
      </DialogContent>

      {/* Save Template Dialog */}
      <AlertDialog open={saveTemplateDialogOpen} onOpenChange={setSaveTemplateDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Save as Template</AlertDialogTitle>
            <AlertDialogDescription>
              Save this email as a reusable template for future {actionType === 'invoice' ? 'invoices' : 'reminders'}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Template Name</Label>
              <Input
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder="e.g., Standard Invoice Email"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="save-as-default"
                checked={saveAsDefault}
                onChange={(e) => setSaveAsDefault(e.target.checked)}
                className="rounded border-input"
              />
              <Label htmlFor="save-as-default" className="text-sm font-normal cursor-pointer">
                Set as default template for {actionType === 'invoice' ? 'invoices' : 'reminders'}
              </Label>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleSaveTemplate}
              disabled={!newTemplateName.trim() || createTemplate.isPending}
            >
              {createTemplate.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Template
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Template Confirmation */}
      <AlertDialog open={!!deleteTemplateId} onOpenChange={() => setDeleteTemplateId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this template? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteTemplate}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
