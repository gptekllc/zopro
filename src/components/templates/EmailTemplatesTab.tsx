import { useState, useRef, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Trash2, Edit, Plus, Star, Copy, Eye, Pencil, CopyPlus, ChevronDown, User, Building2, FileText, Briefcase, Link2, Send, Mail, ChevronsDownUp, ChevronsUpDown, Share2 } from 'lucide-react';
import { 
  useEmailTemplates, 
  useCreateEmailTemplate, 
  useUpdateEmailTemplate, 
  useDeleteEmailTemplate,
  EmailTemplate 
} from '@/hooks/useEmailTemplates';
import { toast } from 'sonner';
import { RichTextEditor, useRichTextEditorInsert } from '@/components/ui/rich-text-editor';

type TemplateType = 'invoice' | 'reminder' | 'quote' | 'job' | 'general';

const TEMPLATE_TYPES: { value: TemplateType; label: string }[] = [
  { value: 'invoice', label: 'Invoice' },
  { value: 'reminder', label: 'Reminder' },
  { value: 'quote', label: 'Quote' },
  { value: 'job', label: 'Job' },
  { value: 'general', label: 'General' },
];

// Built-in default templates that come with the software
interface BuiltInTemplate {
  id: string;
  name: string;
  template_type: TemplateType;
  subject: string;
  body: string;
  is_default: boolean;
  is_builtin: true;
}

const BUILTIN_TEMPLATES: BuiltInTemplate[] = [
  {
    id: 'builtin-invoice-default',
    name: 'Invoice (Default)',
    template_type: 'invoice',
    subject: 'Invoice {{invoice_number}} from {{company_name}}',
    body: `<p>Hi {{customer_name}},</p>

<p>Please find attached your invoice <strong>{{invoice_number}}</strong> for <strong>{{invoice_total}}</strong>.</p>

<p><strong>Due Date:</strong> {{due_date}}</p>

<p>You can view and pay your invoice online using the link below:</p>
<p><a href="{{customer_portal_link}}">View Invoice &amp; Pay Online</a></p>

<p>If you have any questions, please don't hesitate to reach out.</p>

<p>Thank you for your business!</p>

<p>Best regards,<br>
{{company_name}}<br>
{{company_phone}}<br>
{{company_email}}</p>

{{social_links}}`,
    is_default: true,
    is_builtin: true,
  },
  {
    id: 'builtin-reminder-default',
    name: 'Payment Reminder (Default)',
    template_type: 'reminder',
    subject: 'Reminder: Invoice {{invoice_number}} is past due',
    body: `<p>Hi {{customer_name}},</p>

<p>This is a friendly reminder that invoice <strong>{{invoice_number}}</strong> for <strong>{{invoice_total}}</strong> was due on <strong>{{due_date}}</strong>.</p>

<p>If you've already made the payment, please disregard this message. Otherwise, we would appreciate prompt payment.</p>

<p>You can pay online here:</p>
<p><a href="{{payment_link}}">Pay Now</a></p>

<p>If you have any questions or concerns, please contact us.</p>

<p>Thank you,<br>
{{company_name}}<br>
{{company_phone}}</p>`,
    is_default: true,
    is_builtin: true,
  },
  {
    id: 'builtin-quote-default',
    name: 'Quote (Default)',
    template_type: 'quote',
    subject: 'Quote {{quote_number}} from {{company_name}}',
    body: `<p>Hi {{customer_name}},</p>

<p>Thank you for your interest! Please find attached your quote <strong>{{quote_number}}</strong> for <strong>{{quote_total}}</strong>.</p>

<p>This quote is valid until <strong>{{quote_valid_until}}</strong>.</p>

<p>You can review and approve the quote online:</p>
<p><a href="{{customer_portal_link}}">View Quote</a></p>

<p>If you have any questions or would like to proceed, please let us know.</p>

<p>Best regards,<br>
{{company_name}}<br>
{{company_phone}}<br>
{{company_email}}</p>

{{social_links}}`,
    is_default: true,
    is_builtin: true,
  },
  {
    id: 'builtin-job-scheduled',
    name: 'Job Scheduled (Default)',
    template_type: 'job',
    subject: 'Your appointment is confirmed - {{job_title}}',
    body: `<p>Hi {{customer_name}},</p>

<p>Your service appointment has been scheduled!</p>

<p><strong>Job:</strong> {{job_title}}<br>
<strong>Job #:</strong> {{job_number}}<br>
<strong>Date:</strong> {{scheduled_date}}<br>
<strong>Time:</strong> {{scheduled_time}}<br>
<strong>Technician:</strong> {{technician_name}}</p>

<p>If you need to reschedule or have any questions, please contact us.</p>

<p>We look forward to serving you!</p>

<p>Best regards,<br>
{{company_name}}<br>
{{company_phone}}</p>`,
    is_default: true,
    is_builtin: true,
  },
  {
    id: 'builtin-general-default',
    name: 'General Message (Default)',
    template_type: 'general',
    subject: 'Message from {{company_name}}',
    body: `<p>Hi {{customer_name}},</p>

<p>[Your message here]</p>

<p>If you have any questions, please don't hesitate to contact us.</p>

<p>Best regards,<br>
{{company_name}}<br>
{{company_phone}}<br>
{{company_email}}</p>

{{social_links}}`,
    is_default: true,
    is_builtin: true,
  },
];

// Sample values for preview mode
const SAMPLE_VALUES: Record<string, string> = {
  // Customer placeholders
  '{{customer_name}}': 'John Smith',
  '{{customer_email}}': 'john.smith@example.com',
  '{{customer_phone}}': '(555) 123-4567',
  '{{customer_address}}': '123 Main Street',
  '{{customer_city}}': 'Springfield',
  '{{customer_state}}': 'IL',
  '{{customer_zip}}': '62701',
  '{{customer_full_address}}': '123 Main Street, Springfield, IL 62701',
  
  // Company placeholders
  '{{company_name}}': 'Acme Services LLC',
  '{{company_email}}': 'info@acmeservices.com',
  '{{company_phone}}': '(555) 987-6543',
  '{{company_website}}': 'https://www.acmeservices.com',
  '{{company_address}}': '456 Business Ave',
  '{{company_city}}': 'Chicago',
  '{{company_state}}': 'IL',
  '{{company_zip}}': '60601',
  '{{company_full_address}}': '456 Business Ave, Chicago, IL 60601',
  
  // Sender placeholders
  '{{sender_name}}': 'Sarah Johnson',
  '{{sender_email}}': 'noreply@email.zopro.app',
  
  // Invoice placeholders
  '{{invoice_number}}': 'I-2026-0042',
  '{{invoice_total}}': '$1,250.00',
  '{{invoice_subtotal}}': '$1,150.00',
  '{{invoice_tax}}': '$100.00',
  '{{due_date}}': 'January 15, 2026',
  '{{payment_terms}}': 'Net 30',
  
  // Quote placeholders
  '{{quote_number}}': 'Q-2026-0018',
  '{{quote_total}}': '$2,500.00',
  '{{quote_valid_until}}': 'January 20, 2026',
  
  // Job placeholders
  '{{job_number}}': 'J-2026-0031',
  '{{job_title}}': 'HVAC System Maintenance',
  '{{job_description}}': 'Annual maintenance and inspection of heating and cooling systems',
  '{{scheduled_date}}': 'January 10, 2026',
  '{{scheduled_time}}': '9:00 AM',
  '{{technician_name}}': 'Mike Johnson',
  
  // Links
  '{{customer_portal_link}}': 'https://yourcompany.com/portal?token=abc123',
  '{{payment_link}}': 'https://yourcompany.com/pay?invoice=I-2026-0042',
  
  // Social
  '{{social_links}}': '<div style="text-align: center; margin-top: 15px;"><a href="#" style="margin: 0 8px;"><span style="display: inline-block; width: 32px; height: 32px; line-height: 32px; background: #1877F2; color: white; border-radius: 6px; font-weight: bold;">F</span></a><a href="#" style="margin: 0 8px;"><span style="display: inline-block; width: 32px; height: 32px; line-height: 32px; background: #E4405F; color: white; border-radius: 6px; font-weight: bold;">I</span></a></div>',
  
  // General
  '{{today_date}}': new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
};

interface PlaceholderInfo {
  variable: string;
  description: string;
  types: TemplateType[];
  category: 'customer' | 'company' | 'sender' | 'invoice' | 'quote' | 'job' | 'links' | 'social' | 'general';
}

interface PlaceholderCategory {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const PLACEHOLDER_CATEGORIES: PlaceholderCategory[] = [
  { id: 'customer', label: 'Customer', icon: <User className="w-3.5 h-3.5" /> },
  { id: 'company', label: 'Company', icon: <Building2 className="w-3.5 h-3.5" /> },
  { id: 'sender', label: 'Sender', icon: <Send className="w-3.5 h-3.5" /> },
  { id: 'invoice', label: 'Invoice', icon: <FileText className="w-3.5 h-3.5" /> },
  { id: 'quote', label: 'Quote', icon: <FileText className="w-3.5 h-3.5" /> },
  { id: 'job', label: 'Job', icon: <Briefcase className="w-3.5 h-3.5" /> },
  { id: 'links', label: 'Links', icon: <Link2 className="w-3.5 h-3.5" /> },
  { id: 'social', label: 'Social', icon: <Share2 className="w-3.5 h-3.5" /> },
  { id: 'general', label: 'General', icon: <Mail className="w-3.5 h-3.5" /> },
];

const PLACEHOLDER_VARIABLES: PlaceholderInfo[] = [
  // Customer placeholders
  { variable: '{{customer_name}}', description: "Customer's full name", types: ['invoice', 'reminder', 'quote', 'job', 'general'], category: 'customer' },
  { variable: '{{customer_email}}', description: "Customer's email", types: ['invoice', 'reminder', 'quote', 'job', 'general'], category: 'customer' },
  { variable: '{{customer_phone}}', description: "Customer's phone number", types: ['invoice', 'reminder', 'quote', 'job', 'general'], category: 'customer' },
  { variable: '{{customer_address}}', description: "Customer's street address", types: ['invoice', 'reminder', 'quote', 'job', 'general'], category: 'customer' },
  { variable: '{{customer_city}}', description: "Customer's city", types: ['invoice', 'reminder', 'quote', 'job', 'general'], category: 'customer' },
  { variable: '{{customer_state}}', description: "Customer's state", types: ['invoice', 'reminder', 'quote', 'job', 'general'], category: 'customer' },
  { variable: '{{customer_zip}}', description: "Customer's zip code", types: ['invoice', 'reminder', 'quote', 'job', 'general'], category: 'customer' },
  { variable: '{{customer_full_address}}', description: "Customer's full address", types: ['invoice', 'reminder', 'quote', 'job', 'general'], category: 'customer' },
  
  // Company placeholders
  { variable: '{{company_name}}', description: 'Your company name', types: ['invoice', 'reminder', 'quote', 'job', 'general'], category: 'company' },
  { variable: '{{company_email}}', description: 'Your company email', types: ['invoice', 'reminder', 'quote', 'job', 'general'], category: 'company' },
  { variable: '{{company_phone}}', description: 'Your company phone', types: ['invoice', 'reminder', 'quote', 'job', 'general'], category: 'company' },
  { variable: '{{company_website}}', description: 'Your company website', types: ['invoice', 'reminder', 'quote', 'job', 'general'], category: 'company' },
  { variable: '{{company_address}}', description: 'Your company street address', types: ['invoice', 'reminder', 'quote', 'job', 'general'], category: 'company' },
  { variable: '{{company_city}}', description: 'Your company city', types: ['invoice', 'reminder', 'quote', 'job', 'general'], category: 'company' },
  { variable: '{{company_state}}', description: 'Your company state', types: ['invoice', 'reminder', 'quote', 'job', 'general'], category: 'company' },
  { variable: '{{company_zip}}', description: 'Your company zip code', types: ['invoice', 'reminder', 'quote', 'job', 'general'], category: 'company' },
  { variable: '{{company_full_address}}', description: 'Your company full address', types: ['invoice', 'reminder', 'quote', 'job', 'general'], category: 'company' },
  
  // Sender placeholders
  { variable: '{{sender_name}}', description: 'Name of person sending the email', types: ['invoice', 'reminder', 'quote', 'job', 'general'], category: 'sender' },
  { variable: '{{sender_email}}', description: 'Email sender address', types: ['invoice', 'reminder', 'quote', 'job', 'general'], category: 'sender' },
  
  // General placeholders
  { variable: '{{today_date}}', description: 'Current date', types: ['invoice', 'reminder', 'quote', 'job', 'general'], category: 'general' },
  
  // Links placeholders
  { variable: '{{customer_portal_link}}', description: 'Customer portal magic link', types: ['invoice', 'reminder', 'quote', 'job', 'general'], category: 'links' },
  { variable: '{{payment_link}}', description: 'Direct payment link', types: ['invoice', 'reminder'], category: 'links' },
  
  // Social placeholders
  { variable: '{{social_links}}', description: 'Social media icons enabled in Company Settings', types: ['invoice', 'reminder', 'quote', 'job', 'general'], category: 'social' },
  
  // Invoice placeholders
  { variable: '{{invoice_number}}', description: 'Invoice number', types: ['invoice', 'reminder'], category: 'invoice' },
  { variable: '{{invoice_total}}', description: 'Invoice total amount', types: ['invoice', 'reminder'], category: 'invoice' },
  { variable: '{{invoice_subtotal}}', description: 'Invoice subtotal (before tax)', types: ['invoice', 'reminder'], category: 'invoice' },
  { variable: '{{invoice_tax}}', description: 'Invoice tax amount', types: ['invoice', 'reminder'], category: 'invoice' },
  { variable: '{{due_date}}', description: 'Invoice due date', types: ['invoice', 'reminder'], category: 'invoice' },
  { variable: '{{payment_terms}}', description: 'Payment terms (e.g., Net 30)', types: ['invoice', 'reminder'], category: 'invoice' },
  
  // Quote placeholders
  { variable: '{{quote_number}}', description: 'Quote number', types: ['quote'], category: 'quote' },
  { variable: '{{quote_total}}', description: 'Quote total amount', types: ['quote'], category: 'quote' },
  { variable: '{{quote_valid_until}}', description: 'Quote expiration date', types: ['quote'], category: 'quote' },
  
  // Job placeholders
  { variable: '{{job_number}}', description: 'Job number', types: ['job'], category: 'job' },
  { variable: '{{job_title}}', description: 'Job title', types: ['job'], category: 'job' },
  { variable: '{{job_description}}', description: 'Job description', types: ['job'], category: 'job' },
  { variable: '{{scheduled_date}}', description: 'Scheduled date', types: ['job'], category: 'job' },
  { variable: '{{scheduled_time}}', description: 'Scheduled time', types: ['job'], category: 'job' },
  { variable: '{{technician_name}}', description: 'Assigned technician', types: ['job'], category: 'job' },
];

const typeColors: Record<string, string> = {
  invoice: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  reminder: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  quote: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  job: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  general: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
};

// Replace placeholders with sample values for preview
const replacePlaceholdersWithSamples = (text: string): string => {
  let result = text;
  Object.entries(SAMPLE_VALUES).forEach(([placeholder, value]) => {
    result = result.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
  });
  return result;
};

// Extended template type that includes built-in flag
type DisplayTemplate = (EmailTemplate & { is_builtin?: false }) | BuiltInTemplate;

export const EmailTemplatesTab = () => {
  const { data: templates, isLoading } = useEmailTemplates();
  const createTemplate = useCreateEmailTemplate();
  const updateTemplate = useUpdateEmailTemplate();
  const deleteTemplate = useDeleteEmailTemplate();

  // Combine built-in templates with user-created templates
  const allTemplates: DisplayTemplate[] = [
    ...BUILTIN_TEMPLATES,
    ...(templates?.map(t => ({ ...t, is_builtin: false as const })) || []),
  ];

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [viewingBuiltinTemplate, setViewingBuiltinTemplate] = useState<BuiltInTemplate | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    template_type: 'invoice' as TemplateType,
    subject: '',
    body: '',
    is_default: false,
  });
  const [editorTab, setEditorTab] = useState<'edit' | 'preview'>('edit');

  const handleDelete = async () => {
    if (deleteConfirmId) {
      await deleteTemplate.mutateAsync(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  const handleCreateOpen = () => {
    setFormData({
      name: '',
      template_type: 'invoice',
      subject: '',
      body: '',
      is_default: false,
    });
    setEditorTab('edit');
    setIsCreateOpen(true);
  };

  const handleEditOpen = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      template_type: template.template_type as TemplateType,
      subject: template.subject,
      body: template.body,
      is_default: template.is_default,
    });
    setEditorTab('edit');
  };

  const handleCreate = async () => {
    if (!formData.name.trim() || !formData.subject.trim()) return;
    
    await createTemplate.mutateAsync({
      name: formData.name,
      template_type: formData.template_type,
      subject: formData.subject,
      body: formData.body,
      is_default: formData.is_default,
    });
    
    setIsCreateOpen(false);
  };

  const handleUpdate = async () => {
    if (!editingTemplate || !formData.name.trim() || !formData.subject.trim()) return;

    await updateTemplate.mutateAsync({
      id: editingTemplate.id,
      name: formData.name,
      subject: formData.subject,
      body: formData.body,
      is_default: formData.is_default,
    });

    setEditingTemplate(null);
  };

  const handleDuplicate = (template: DisplayTemplate) => {
    setFormData({
      name: template.is_builtin ? template.name.replace(' (Default)', '') : `${template.name} (Copy)`,
      template_type: template.template_type as TemplateType,
      subject: template.subject,
      body: template.body,
      is_default: false,
    });
    setEditorTab('edit');
    setIsCreateOpen(true);
  };

  const [insertTarget, setInsertTarget] = useState<'subject' | 'body'>('body');
  const subjectRef = useRef<HTMLInputElement>(null);
  const cursorPositionRef = useRef<{ subject: number }>({ subject: 0 });
  const { insertPlaceholder: insertPlaceholderIntoEditor } = useRichTextEditorInsert();

  const updateCursorPosition = (target: 'subject') => {
    if (target === 'subject' && subjectRef.current) {
      cursorPositionRef.current.subject = subjectRef.current.selectionStart || 0;
    }
  };

  const insertPlaceholder = useCallback((variable: string, target: 'subject' | 'body') => {
    if (target === 'body') {
      // Insert into RichTextEditor
      insertPlaceholderIntoEditor(variable);
      setInsertTarget('body');
    } else {
      // Insert into subject input
      const position = cursorPositionRef.current.subject;
      setFormData(prev => {
        const currentValue = prev.subject;
        const newValue = currentValue.slice(0, position) + variable + currentValue.slice(position);
        cursorPositionRef.current.subject = position + variable.length;
        return {
          ...prev,
          subject: newValue,
        };
      });
      setEditorTab('edit');
      
      // Refocus the field after inserting
      setTimeout(() => {
        const newPosition = cursorPositionRef.current.subject;
        if (subjectRef.current) {
          subjectRef.current.focus();
          subjectRef.current.setSelectionRange(newPosition, newPosition);
        }
      }, 0);
    }
  }, [insertPlaceholderIntoEditor]);

  const copyPlaceholder = (variable: string) => {
    navigator.clipboard.writeText(variable);
    toast.success('Copied to clipboard');
  };

  // Get placeholders relevant to current template type, grouped by category
  const getRelevantPlaceholders = () => {
    return PLACEHOLDER_VARIABLES.filter(p => 
      p.types.includes(formData.template_type) || p.types.includes('general')
    );
  };

  const relevantPlaceholders = getRelevantPlaceholders();
  
  // Group placeholders by category
  const getPlaceholdersByCategory = (categoryId: string) => {
    return relevantPlaceholders.filter(p => p.category === categoryId);
  };
  
  // Get categories that have relevant placeholders
  const relevantCategories = PLACEHOLDER_CATEGORIES.filter(cat => 
    getPlaceholdersByCategory(cat.id).length > 0
  );

  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({
    customer: true,
    company: true,
    sender: true,
  });

  const allCategoriesExpanded = relevantCategories.every(cat => openCategories[cat.id]);
  
  const toggleAllCategories = () => {
    const newState = !allCategoriesExpanded;
    const newOpenCategories: Record<string, boolean> = {};
    relevantCategories.forEach(cat => {
      newOpenCategories[cat.id] = newState;
    });
    setOpenCategories(newOpenCategories);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const TemplateFormContent = (
    <div className="space-y-4 py-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Template Name *</Label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="e.g., Standard Invoice Email"
          />
        </div>
        <div className="space-y-2">
          <Label>Type</Label>
          <Select
            value={formData.template_type}
            onValueChange={(value: TemplateType) =>
              setFormData(prev => ({ ...prev, template_type: value }))
            }
            disabled={!!editingTemplate}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TEMPLATE_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Subject *</Label>
        <Input
          ref={subjectRef}
          value={formData.subject}
          onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
          onFocus={() => setInsertTarget('subject')}
          onClick={() => updateCursorPosition('subject')}
          onKeyUp={() => updateCursorPosition('subject')}
          onSelect={() => updateCursorPosition('subject')}
          placeholder="Email subject line (supports placeholders)"
        />
        {editorTab === 'preview' && (
          <div className="p-2 bg-muted/50 rounded text-sm mt-1">
            <span className="text-muted-foreground text-xs">Preview:</span>
            <p className="font-medium">{replacePlaceholdersWithSamples(formData.subject)}</p>
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Message Body</Label>
          <Tabs value={editorTab} onValueChange={(v) => setEditorTab(v as 'edit' | 'preview')}>
            <TabsList className="h-8">
              <TabsTrigger value="edit" className="text-xs h-7 px-2">
                <Pencil className="w-3 h-3 mr-1" />
                Edit
              </TabsTrigger>
              <TabsTrigger value="preview" className="text-xs h-7 px-2">
                <Eye className="w-3 h-3 mr-1" />
                Preview
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {editorTab === 'edit' ? (
          <RichTextEditor
            value={formData.body}
            onChange={(value) => setFormData(prev => ({ ...prev, body: value }))}
            onFocus={() => setInsertTarget('body')}
            placeholder="Email message body. Use placeholders like {{customer_name}} for dynamic content."
          />
        ) : (
          <div className="min-h-[240px] p-4 border rounded-md bg-muted/30">
            <p className="text-xs text-muted-foreground mb-2">
              Preview with sample values:
            </p>
            <Separator className="mb-3" />
            <div 
              className="text-sm prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ 
                __html: replacePlaceholdersWithSamples(formData.body)
                  || '<span class="text-muted-foreground italic">No message body yet</span>' 
              }}
            />
          </div>
        )}
      </div>

      {/* Placeholder reference - Collapsible categories */}
      <div className="p-3 bg-muted/50 rounded-lg space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium">
            Available Placeholders for {TEMPLATE_TYPES.find(t => t.value === formData.template_type)?.label} templates:
          </p>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 text-xs px-2"
              onClick={toggleAllCategories}
            >
              {allCategoriesExpanded ? (
                <>
                  <ChevronsDownUp className="w-3 h-3 mr-1" />
                  Collapse All
                </>
              ) : (
                <>
                  <ChevronsUpDown className="w-3 h-3 mr-1" />
                  Expand All
                </>
              )}
            </Button>
            <Badge variant="secondary" className="text-xs">
              Insert into: {insertTarget}
            </Badge>
          </div>
        </div>
        
        <div className="space-y-1">
          {relevantCategories.map((category) => {
            const categoryPlaceholders = getPlaceholdersByCategory(category.id);
            const isOpen = openCategories[category.id] ?? false;
            
            return (
              <Collapsible
                key={category.id}
                open={isOpen}
                onOpenChange={(open) => setOpenCategories(prev => ({ ...prev, [category.id]: open }))}
              >
                <CollapsibleTrigger className="flex items-center gap-2 w-full p-2 rounded-md hover:bg-muted/80 transition-colors text-left">
                  <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
                  {category.icon}
                  <span className="text-xs font-medium flex-1">{category.label}</span>
                  <Badge variant="outline" className="text-[10px] h-4 px-1.5">
                    {categoryPlaceholders.length}
                  </Badge>
                </CollapsibleTrigger>
                <CollapsibleContent className="pl-6 pt-1 pb-2">
                  <div className="flex flex-wrap gap-1.5">
                    {categoryPlaceholders.map((p) => (
                      <Badge
                        key={p.variable}
                        variant="outline"
                        className="cursor-pointer hover:bg-primary hover:text-primary-foreground text-xs transition-colors"
                        onClick={() => insertPlaceholder(p.variable, insertTarget)}
                        title={p.description}
                      >
                        <Copy className="w-2.5 h-2.5 mr-1" />
                        {p.variable}
                      </Badge>
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
        
        <p className="text-xs text-muted-foreground pt-1">
          Click subject or body field first, then click a placeholder to insert it.
        </p>
      </div>

      <div className="flex items-center gap-3">
        <Switch
          id="is-default"
          checked={formData.is_default}
          onCheckedChange={(checked) => setFormData(prev => ({ ...prev, is_default: checked }))}
        />
        <Label htmlFor="is-default" className="font-normal cursor-pointer">
          Set as default template for {formData.template_type} emails
        </Label>
      </div>
    </div>
  );

  return (
    <>
      <div className="flex justify-end mb-4">
        <Button onClick={handleCreateOpen}>
          <Plus className="w-4 h-4 mr-2" />
          New Template
        </Button>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
            <h3 className="text-lg font-medium mb-2">Loading Templates</h3>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {allTemplates.map((template) => (
            <Card key={template.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-semibold text-lg">{template.name}</h3>
                      {template.is_builtin && (
                        <Badge variant="secondary" className="flex items-center gap-1 bg-primary/10 text-primary">
                          Built-in
                        </Badge>
                      )}
                      {template.is_default && !template.is_builtin && (
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <Star className="w-3 h-3 text-yellow-500" />
                          Default
                        </Badge>
                      )}
                      <Badge variant="outline" className={typeColors[template.template_type] || typeColors.general}>
                        {template.template_type}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-sm">{template.subject}</p>
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                      {template.body.replace(/<[^>]*>/g, ' ').substring(0, 150)}...
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {template.is_builtin && (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setViewingBuiltinTemplate(template as BuiltInTemplate)}
                        title="View template"
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
                    )}
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => handleDuplicate(template)}
                      title={template.is_builtin ? "Copy to customize" : "Duplicate template"}
                    >
                      <CopyPlus className="w-4 h-4" />
                    </Button>
                    {!template.is_builtin && (
                      <>
                        <Button variant="outline" size="sm" onClick={() => handleEditOpen(template as EmailTemplate)}>
                          <Edit className="w-4 h-4 mr-1" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteConfirmId(template.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Template Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Email Template</DialogTitle>
          </DialogHeader>
          {TemplateFormContent}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!formData.name.trim() || !formData.subject.trim() || createTemplate.isPending}
            >
              {createTemplate.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Create Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Template Dialog */}
      <Dialog open={!!editingTemplate} onOpenChange={(open) => !open && setEditingTemplate(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Email Template</DialogTitle>
          </DialogHeader>
          {TemplateFormContent}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTemplate(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdate}
              disabled={!formData.name.trim() || !formData.subject.trim() || updateTemplate.isPending}
            >
              {updateTemplate.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Built-in Template Dialog */}
      <Dialog open={!!viewingBuiltinTemplate} onOpenChange={(open) => !open && setViewingBuiltinTemplate(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              {viewingBuiltinTemplate?.name}
            </DialogTitle>
          </DialogHeader>
          
          {viewingBuiltinTemplate && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-primary/10 text-primary">
                  Built-in Template
                </Badge>
                <Badge variant="outline" className={typeColors[viewingBuiltinTemplate.template_type] || typeColors.general}>
                  {viewingBuiltinTemplate.template_type}
                </Badge>
              </div>
              
              <div className="space-y-2">
                <Label className="text-muted-foreground text-xs uppercase tracking-wide">Subject</Label>
                <div className="p-3 bg-muted/50 rounded-md border">
                  <p className="text-sm font-medium">{viewingBuiltinTemplate.subject}</p>
                </div>
              </div>
              
              <Tabs defaultValue="source" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="source" className="text-xs">Source</TabsTrigger>
                  <TabsTrigger value="preview" className="text-xs">Preview</TabsTrigger>
                </TabsList>
                <TabsContent value="source">
                  <div className="p-3 bg-muted/50 rounded-md border min-h-[200px] max-h-[300px] overflow-auto">
                    <pre className="text-xs font-mono whitespace-pre-wrap">{viewingBuiltinTemplate.body}</pre>
                  </div>
                </TabsContent>
                <TabsContent value="preview">
                  <div className="p-4 border rounded-md min-h-[200px] max-h-[300px] overflow-auto bg-background">
                    <p className="text-xs text-muted-foreground mb-2">Preview with sample values:</p>
                    <Separator className="mb-3" />
                    <div 
                      className="prose prose-sm dark:prose-invert max-w-none text-sm"
                      dangerouslySetInnerHTML={{ 
                        __html: replacePlaceholdersWithSamples(viewingBuiltinTemplate.body)
                      }}
                    />
                  </div>
                </TabsContent>
              </Tabs>
              
              <div className="p-3 bg-muted/30 rounded-lg">
                <p className="text-xs text-muted-foreground">
                  <strong>Note:</strong> Built-in templates cannot be edited directly. Click "Copy to Customize" to create your own editable version.
                </p>
              </div>
            </div>
          )}
          
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setViewingBuiltinTemplate(null)}>
              Close
            </Button>
            <Button 
              onClick={() => {
                if (viewingBuiltinTemplate) {
                  handleDuplicate(viewingBuiltinTemplate);
                  setViewingBuiltinTemplate(null);
                }
              }}
            >
              <CopyPlus className="w-4 h-4 mr-2" />
              Copy to Customize
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirmId} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this email template? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteTemplate.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
