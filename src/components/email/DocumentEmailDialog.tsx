import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
import { FileText, Briefcase, Mail, X, Plus, Loader2, ArrowLeft, CheckCircle, Send, Save, ChevronDown, Trash2, Star } from 'lucide-react';
import { useEmailTemplates, useCreateEmailTemplate, useDeleteEmailTemplate, EmailTemplate } from '@/hooks/useEmailTemplates';

type DocumentType = 'quote' | 'job';
type Step = 'compose' | 'preview' | 'success';

interface DocumentEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentType: DocumentType;
  documentNumber?: string;
  customerName?: string;
  customerEmail?: string;
  companyName?: string;
  documentTotal?: number;
  validUntil?: string; // For quotes
  scheduledDate?: string; // For jobs
  scheduledTime?: string; // For jobs
  jobTitle?: string; // For jobs
  jobDescription?: string; // For jobs
  technicianName?: string; // For jobs
  customerAddress?: string;
  onSend: (emails: string[], subject: string, message: string, cc?: string[], bcc?: string[]) => Promise<void>;
  isSending?: boolean;
}

export function DocumentEmailDialog({
  open,
  onOpenChange,
  documentType,
  documentNumber,
  customerName,
  customerEmail,
  companyName = 'Our Company',
  documentTotal,
  validUntil,
  scheduledDate,
  scheduledTime,
  jobTitle,
  jobDescription,
  technicianName,
  customerAddress,
  onSend,
  isSending = false,
}: DocumentEmailDialogProps) {
  const [step, setStep] = useState<Step>('compose');
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
  
  const templateType = documentType === 'quote' ? 'quote' : 'job';
  const { data: templates = [] } = useEmailTemplates(templateType);
  const createTemplate = useCreateEmailTemplate();
  const deleteTemplate = useDeleteEmailTemplate();

  // Replace placeholder variables with actual values
  const replacePlaceholders = (text: string) => {
    const totalStr = documentTotal ? `$${documentTotal.toFixed(2)}` : '';
    const todayStr = new Date().toLocaleDateString();
    const validUntilStr = validUntil ? new Date(validUntil).toLocaleDateString() : '';
    const scheduledDateStr = scheduledDate ? new Date(scheduledDate).toLocaleDateString() : '';
    
    return text
      .replace(/\{\{customer_name\}\}/g, customerName || '')
      .replace(/\{\{company_name\}\}/g, companyName)
      .replace(/\{\{today_date\}\}/g, todayStr)
      .replace(/\{\{customer_address\}\}/g, customerAddress || '')
      // Quote placeholders
      .replace(/\{\{quote_number\}\}/g, documentType === 'quote' ? (documentNumber || '') : '')
      .replace(/\{\{quote_total\}\}/g, documentType === 'quote' ? totalStr : '')
      .replace(/\{\{quote_valid_until\}\}/g, validUntilStr)
      // Job placeholders
      .replace(/\{\{job_number\}\}/g, documentType === 'job' ? (documentNumber || '') : '')
      .replace(/\{\{job_title\}\}/g, jobTitle || '')
      .replace(/\{\{job_description\}\}/g, jobDescription || '')
      .replace(/\{\{scheduled_date\}\}/g, scheduledDateStr)
      .replace(/\{\{scheduled_time\}\}/g, scheduledTime || '')
      .replace(/\{\{technician_name\}\}/g, technicianName || '');
  };

  const getDefaultSubject = () => {
    if (documentType === 'quote') {
      return `Quote ${documentNumber || ''} from ${companyName}`;
    }
    return `Job Update: ${jobTitle || documentNumber || ''} from ${companyName}`;
  };

  const getDefaultMessage = () => {
    const greeting = customerName ? `Dear ${customerName},` : 'Hello,';
    const totalStr = documentTotal ? `$${documentTotal.toFixed(2)}` : '';

    if (documentType === 'quote') {
      const validStr = validUntil ? new Date(validUntil).toLocaleDateString() : '';
      return `${greeting}

Please find attached quote ${documentNumber || ''}${totalStr ? ` for ${totalStr}` : ''}.${validStr ? ` This quote is valid until ${validStr}.` : ''}

If you have any questions, please don't hesitate to reach out.

Thank you for your interest!

Best regards,
${companyName}`;
    }
    
    const schedStr = scheduledDate ? new Date(scheduledDate).toLocaleDateString() : '';
    return `${greeting}

This is regarding job ${documentNumber || ''}${jobTitle ? ` - ${jobTitle}` : ''}.${schedStr ? ` Scheduled for ${schedStr}${scheduledTime ? ` at ${scheduledTime}` : ''}.` : ''}${technicianName ? ` Your technician will be ${technicianName}.` : ''}

Please find the job details attached.

If you have any questions, please contact us.

Thank you,
${companyName}`;
  };

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setStep('compose');
      setEmails(customerEmail ? [customerEmail] : []);
      setNewEmail('');
      setSentEmails([]);
      setCcEmails([]);
      setBccEmails([]);
      setNewCcEmail('');
      setNewBccEmail('');
      setShowCcBcc(false);
      setSelectedTemplateId('');
      setSubject('');
      setMessage('');
    }
  }, [open, customerEmail]);

  // Apply default template when templates are loaded and no template is selected yet
  useEffect(() => {
    if (open && templates.length > 0 && !selectedTemplateId && !subject && !message) {
      const defaultTemplate = templates.find(t => t.template_type === templateType && t.is_default);
      if (defaultTemplate) {
        setSubject(replacePlaceholders(defaultTemplate.subject));
        setMessage(replacePlaceholders(defaultTemplate.body));
        setSelectedTemplateId(defaultTemplate.id);
      } else {
        setSubject(getDefaultSubject());
        setMessage(getDefaultMessage());
      }
    }
  }, [open, templates, templateType, selectedTemplateId, subject, message]);

  const handleTemplateChange = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (templateId === 'default') {
      setSubject(getDefaultSubject());
      setMessage(getDefaultMessage());
    } else {
      const template = templates.find(t => t.id === templateId);
      if (template) {
        setSubject(replacePlaceholders(template.subject));
        setMessage(replacePlaceholders(template.body));
      }
    }
  };

  const handleSaveTemplate = async () => {
    if (!newTemplateName.trim()) return;
    
    await createTemplate.mutateAsync({
      name: newTemplateName.trim(),
      template_type: templateType,
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
      await onSend(
        emails, 
        subject, 
        message, 
        ccEmails.length > 0 ? ccEmails : undefined, 
        bccEmails.length > 0 ? bccEmails : undefined
      );
      setSentEmails([...emails]);
      setStep('success');
    } catch {
      // Error handled by parent
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

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

  const DocumentIcon = documentType === 'quote' ? FileText : Briefcase;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DocumentIcon className="w-5 h-5" />
            {step === 'compose' && `Send ${documentType === 'quote' ? 'Quote' : 'Job'} Email`}
            {step === 'preview' && 'Preview & Send'}
            {step === 'success' && 'Email Sent'}
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: Compose email */}
        {step === 'compose' && (
          <div className="space-y-4">
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
                  <SelectValue placeholder="Select a template or use default" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">Default Template</SelectItem>
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
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Email message"
                rows={6}
                className="text-sm"
              />
              <p className="text-xs text-muted-foreground">
                The {documentType} PDF will be attached automatically.
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

        {/* Step 2: Preview before sending */}
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
                <p className="mt-1 whitespace-pre-wrap">{message}</p>
              </div>
              
              <Separator />
              
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <DocumentIcon className="w-4 h-4" />
                <span>Attachment: {documentNumber || documentType}.pdf</span>
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
                Send
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Success confirmation */}
        {step === 'success' && (
          <div className="space-y-4 text-center py-4">
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            
            <div>
              <h3 className="font-semibold text-lg">Email Sent!</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Your {documentType} has been sent successfully.
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
              Save this email as a reusable template for future {documentType}s.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Template Name</Label>
              <Input
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                placeholder={`e.g., Standard ${documentType === 'quote' ? 'Quote' : 'Job'} Email`}
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
                Set as default template for {documentType}s
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
