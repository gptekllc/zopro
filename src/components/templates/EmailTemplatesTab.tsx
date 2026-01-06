import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Loader2, Trash2, Edit, Plus, Mail, Star, Copy, Info } from 'lucide-react';
import { 
  useEmailTemplates, 
  useCreateEmailTemplate, 
  useUpdateEmailTemplate, 
  useDeleteEmailTemplate,
  EmailTemplate 
} from '@/hooks/useEmailTemplates';
import { toast } from 'sonner';

const TEMPLATE_TYPES = [
  { value: 'invoice', label: 'Invoice' },
  { value: 'reminder', label: 'Reminder' },
  { value: 'general', label: 'General' },
] as const;

const PLACEHOLDER_VARIABLES = [
  { variable: '{{customer_name}}', description: 'Customer\'s full name' },
  { variable: '{{company_name}}', description: 'Your company name' },
  { variable: '{{invoice_number}}', description: 'Invoice number (e.g., I-2026-0001)' },
  { variable: '{{invoice_total}}', description: 'Invoice total amount formatted' },
  { variable: '{{due_date}}', description: 'Invoice due date' },
  { variable: '{{quote_number}}', description: 'Quote number' },
  { variable: '{{job_number}}', description: 'Job number' },
  { variable: '{{today_date}}', description: 'Current date' },
];

const typeColors: Record<string, string> = {
  invoice: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  reminder: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  general: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
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
    template_type: 'invoice' as 'invoice' | 'reminder' | 'general',
    subject: '',
    body: '',
    is_default: false,
  });

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
    setIsCreateOpen(true);
  };

  const handleEditOpen = (template: EmailTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      template_type: template.template_type,
      subject: template.subject,
      body: template.body,
      is_default: template.is_default,
    });
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

  const insertPlaceholder = (variable: string) => {
    setFormData(prev => ({
      ...prev,
      body: prev.body + variable,
    }));
  };

  const copyPlaceholder = (variable: string) => {
    navigator.clipboard.writeText(variable);
    toast.success('Copied to clipboard');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const TemplateForm = () => (
    <div className="space-y-4 py-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Template Name *</Label>
          <Input
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="e.g., Standard Invoice Email"
          />
        </div>
        <div className="space-y-2">
          <Label>Type</Label>
          <Select
            value={formData.template_type}
            onValueChange={(value: 'invoice' | 'reminder' | 'general') =>
              setFormData({ ...formData, template_type: value })
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
          onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
          placeholder="Email subject line"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Message Body</Label>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 text-xs">
                  <Info className="w-3 h-3 mr-1" />
                  Placeholders
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left" className="max-w-xs">
                <p className="text-xs mb-2">Click a placeholder to insert it:</p>
                <div className="space-y-1">
                  {PLACEHOLDER_VARIABLES.map((p) => (
                    <button
                      key={p.variable}
                      className="block w-full text-left text-xs hover:bg-muted p-1 rounded"
                      onClick={() => insertPlaceholder(p.variable)}
                    >
                      <code className="text-primary">{p.variable}</code>
                      <span className="text-muted-foreground ml-2">- {p.description}</span>
                    </button>
                  ))}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <Textarea
          value={formData.body}
          onChange={(e) => setFormData({ ...formData, body: e.target.value })}
          placeholder="Email message body. Use placeholders like {{customer_name}} for dynamic content."
          rows={8}
        />
      </div>

      {/* Placeholder reference */}
      <div className="p-3 bg-muted/50 rounded-lg">
        <p className="text-xs font-medium mb-2">Available Placeholders (click to copy):</p>
        <div className="flex flex-wrap gap-1.5">
          {PLACEHOLDER_VARIABLES.map((p) => (
            <Badge
              key={p.variable}
              variant="outline"
              className="cursor-pointer hover:bg-muted text-xs"
              onClick={() => copyPlaceholder(p.variable)}
            >
              <Copy className="w-2.5 h-2.5 mr-1" />
              {p.variable}
            </Badge>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Switch
          id="is-default"
          checked={formData.is_default}
          onCheckedChange={(checked) => setFormData({ ...formData, is_default: checked })}
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
              Create reusable email templates with placeholder variables for invoices and reminders.
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
                      <Badge variant="outline" className={typeColors[template.template_type]}>
                        {template.template_type}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground text-sm">{template.subject}</p>
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                      {template.body}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
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
          <TemplateForm />
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
          <TemplateForm />
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
