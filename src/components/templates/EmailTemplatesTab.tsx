import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
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
import { Loader2, Trash2, Edit, Plus, Mail, Star, Copy, Eye, Pencil, CopyPlus } from 'lucide-react';
import { 
  useEmailTemplates, 
  useCreateEmailTemplate, 
  useUpdateEmailTemplate, 
  useDeleteEmailTemplate,
  EmailTemplate 
} from '@/hooks/useEmailTemplates';
import { toast } from 'sonner';

type TemplateType = 'invoice' | 'reminder' | 'quote' | 'job' | 'general';

const TEMPLATE_TYPES: { value: TemplateType; label: string }[] = [
  { value: 'invoice', label: 'Invoice' },
  { value: 'reminder', label: 'Reminder' },
  { value: 'quote', label: 'Quote' },
  { value: 'job', label: 'Job' },
  { value: 'general', label: 'General' },
];

// Sample values for preview mode
const SAMPLE_VALUES: Record<string, string> = {
  '{{customer_name}}': 'John Smith',
  '{{company_name}}': 'Acme Services LLC',
  '{{invoice_number}}': 'I-2026-0042',
  '{{invoice_total}}': '$1,250.00',
  '{{due_date}}': 'January 15, 2026',
  '{{quote_number}}': 'Q-2026-0018',
  '{{quote_total}}': '$2,500.00',
  '{{quote_valid_until}}': 'January 20, 2026',
  '{{job_number}}': 'J-2026-0031',
  '{{job_title}}': 'HVAC System Maintenance',
  '{{job_description}}': 'Annual maintenance and inspection of heating and cooling systems',
  '{{scheduled_date}}': 'January 10, 2026',
  '{{scheduled_time}}': '9:00 AM',
  '{{technician_name}}': 'Mike Johnson',
  '{{today_date}}': new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
  '{{customer_address}}': '123 Main Street, Springfield, IL 62701',
};

interface PlaceholderInfo {
  variable: string;
  description: string;
  types: TemplateType[];
}

const PLACEHOLDER_VARIABLES: PlaceholderInfo[] = [
  // Common placeholders
  { variable: '{{customer_name}}', description: "Customer's full name", types: ['invoice', 'reminder', 'quote', 'job', 'general'] },
  { variable: '{{company_name}}', description: 'Your company name', types: ['invoice', 'reminder', 'quote', 'job', 'general'] },
  { variable: '{{today_date}}', description: 'Current date', types: ['invoice', 'reminder', 'quote', 'job', 'general'] },
  { variable: '{{customer_address}}', description: "Customer's address", types: ['invoice', 'reminder', 'quote', 'job', 'general'] },
  
  // Invoice placeholders
  { variable: '{{invoice_number}}', description: 'Invoice number', types: ['invoice', 'reminder'] },
  { variable: '{{invoice_total}}', description: 'Invoice total amount', types: ['invoice', 'reminder'] },
  { variable: '{{due_date}}', description: 'Invoice due date', types: ['invoice', 'reminder'] },
  
  // Quote placeholders
  { variable: '{{quote_number}}', description: 'Quote number', types: ['quote'] },
  { variable: '{{quote_total}}', description: 'Quote total amount', types: ['quote'] },
  { variable: '{{quote_valid_until}}', description: 'Quote expiration date', types: ['quote'] },
  
  // Job placeholders
  { variable: '{{job_number}}', description: 'Job number', types: ['job'] },
  { variable: '{{job_title}}', description: 'Job title', types: ['job'] },
  { variable: '{{job_description}}', description: 'Job description', types: ['job'] },
  { variable: '{{scheduled_date}}', description: 'Scheduled date', types: ['job'] },
  { variable: '{{scheduled_time}}', description: 'Scheduled time', types: ['job'] },
  { variable: '{{technician_name}}', description: 'Assigned technician', types: ['job'] },
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

export const EmailTemplatesTab = () => {
  const { data: templates, isLoading } = useEmailTemplates();
  const createTemplate = useCreateEmailTemplate();
  const updateTemplate = useUpdateEmailTemplate();
  const deleteTemplate = useDeleteEmailTemplate();

  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
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

  const handleDuplicate = (template: EmailTemplate) => {
    setFormData({
      name: `${template.name} (Copy)`,
      template_type: template.template_type as TemplateType,
      subject: template.subject,
      body: template.body,
      is_default: false,
    });
    setEditorTab('edit');
    setIsCreateOpen(true);
  };

  const [insertTarget, setInsertTarget] = useState<'subject' | 'body'>('body');

  const insertPlaceholder = (variable: string, target: 'subject' | 'body') => {
    setFormData(prev => ({
      ...prev,
      [target]: prev[target] + variable,
    }));
    setEditorTab('edit');
  };

  const copyPlaceholder = (variable: string) => {
    navigator.clipboard.writeText(variable);
    toast.success('Copied to clipboard');
  };

  // Get placeholders relevant to current template type
  const getRelevantPlaceholders = () => {
    return PLACEHOLDER_VARIABLES.filter(p => 
      p.types.includes(formData.template_type) || p.types.includes('general')
    );
  };

  const relevantPlaceholders = getRelevantPlaceholders();

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
          value={formData.subject}
          onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
          onFocus={() => setInsertTarget('subject')}
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
          <Textarea
            value={formData.body}
            onChange={(e) => setFormData(prev => ({ ...prev, body: e.target.value }))}
            onFocus={() => setInsertTarget('body')}
            placeholder="Email message body. Use placeholders like {{customer_name}} for dynamic content."
            rows={10}
          />
        ) : (
          <div className="min-h-[240px] p-4 border rounded-md bg-muted/30">
            <p className="text-xs text-muted-foreground mb-2">
              Preview with sample values:
            </p>
            <Separator className="mb-3" />
            <div className="whitespace-pre-wrap text-sm">
              {replacePlaceholdersWithSamples(formData.body) || (
                <span className="text-muted-foreground italic">No message body yet</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Placeholder reference */}
      <div className="p-3 bg-muted/50 rounded-lg">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-medium">
            Available Placeholders for {TEMPLATE_TYPES.find(t => t.value === formData.template_type)?.label} templates:
          </p>
          <Badge variant="secondary" className="text-xs">
            Insert into: {insertTarget}
          </Badge>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {relevantPlaceholders.map((p) => (
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
        <p className="text-xs text-muted-foreground mt-2">
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

      {!templates || templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Mail className="w-16 h-16 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">No Email Templates Yet</h3>
            <p className="text-muted-foreground text-center max-w-md mb-4">
              Create reusable email templates with placeholder variables for invoices, quotes, jobs, and reminders.
            </p>
            <Button onClick={handleCreateOpen}>
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Template
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {templates.map((template) => (
            <Card key={template.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-semibold text-lg">{template.name}</h3>
                      {template.is_default && (
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
                      {template.body}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      onClick={() => handleDuplicate(template)}
                      title="Duplicate template"
                    >
                      <CopyPlus className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleEditOpen(template)}>
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
