import { useState } from 'react';
import { useJobTemplates, useDeleteJobTemplate, useUpdateJobTemplate, JobTemplate } from '@/hooks/useJobTemplates';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import { Loader2, Trash2, FileText, Edit, Plus, X, ArrowLeft, BookTemplate } from 'lucide-react';
import { Link } from 'react-router-dom';
import PageContainer from '@/components/layout/PageContainer';

const JOB_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

const priorityColors: Record<string, string> = {
  low: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  medium: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  high: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  urgent: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

interface LineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

const JobTemplates = () => {
  const { data: templates, isLoading } = useJobTemplates();
  const deleteTemplate = useDeleteJobTemplate();
  const updateTemplate = useUpdateJobTemplate();
  
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<JobTemplate | null>(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    title: '',
    description: '',
    priority: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
    estimated_duration: 60,
    notes: '',
  });
  const [editLineItems, setEditLineItems] = useState<LineItem[]>([]);

  const handleDelete = async () => {
    if (deleteConfirmId) {
      await deleteTemplate.mutateAsync(deleteConfirmId);
      setDeleteConfirmId(null);
    }
  };

  const handleEditOpen = (template: JobTemplate) => {
    setEditingTemplate(template);
    setEditFormData({
      name: template.name,
      title: template.title,
      description: template.description || '',
      priority: template.priority,
      estimated_duration: template.estimated_duration || 60,
      notes: template.notes || '',
    });
    setEditLineItems(
      template.items?.map(item => ({
        id: item.id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unit_price,
      })) || []
    );
  };

  const handleEditSave = async () => {
    if (!editingTemplate) return;
    
    await updateTemplate.mutateAsync({
      id: editingTemplate.id,
      name: editFormData.name,
      title: editFormData.title,
      description: editFormData.description || undefined,
      priority: editFormData.priority,
      estimated_duration: editFormData.estimated_duration,
      notes: editFormData.notes || undefined,
      items: editLineItems.map(item => ({
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unitPrice,
      })),
    });
    
    setEditingTemplate(null);
  };

  const addLineItem = () => {
    setEditLineItems([
      ...editLineItems,
      { id: crypto.randomUUID(), description: '', quantity: 1, unitPrice: 0 },
    ]);
  };

  const removeLineItem = (id: string) => {
    setEditLineItems(editLineItems.filter(item => item.id !== id));
  };

  const updateLineItem = (id: string, field: keyof LineItem, value: string | number) => {
    setEditLineItems(
      editLineItems.map(item =>
        item.id === id ? { ...item, [field]: value } : item
      )
    );
  };

  const calculateTotal = (template: JobTemplate) => {
    if (!template.items || template.items.length === 0) return 0;
    return template.items.reduce((sum, item) => sum + item.total, 0);
  };

  return (
    <PageContainer width="narrow" className="py-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link to="/jobs">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-5 h-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookTemplate className="w-6 h-6" />
            Job Templates
          </h1>
          <p className="text-muted-foreground">Manage your saved job templates</p>
        </div>
      </div>

      {/* Templates List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : !templates || templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <FileText className="w-16 h-16 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium mb-2">No Templates Yet</h3>
            <p className="text-muted-foreground text-center max-w-md mb-4">
              Save a job as a template from the Jobs page to see it here. Templates help you quickly create new jobs with pre-filled information.
            </p>
            <Link to="/jobs">
              <Button>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Go to Jobs
              </Button>
            </Link>
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
                      <Badge variant="outline" className={`${priorityColors[template.priority]} capitalize`}>
                        {template.priority}
                      </Badge>
                    </div>
                    <p className="text-muted-foreground">{template.title}</p>
                    
                    {template.description && (
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                        {template.description}
                      </p>
                    )}
                    
                    <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                      {template.items && template.items.length > 0 && (
                        <span>
                          {template.items.length} item{template.items.length !== 1 ? 's' : ''} • {formatCurrency(calculateTotal(template))}
                        </span>
                      )}
                      {template.estimated_duration && (
                        <span>{template.estimated_duration} min</span>
                      )}
                    </div>
                    
                    {/* Line Items Preview */}
                    {template.items && template.items.length > 0 && (
                      <div className="mt-3 pt-3 border-t space-y-1">
                        {template.items.slice(0, 3).map((item) => (
                          <div key={item.id} className="flex justify-between text-sm">
                            <span className="text-muted-foreground truncate">{item.description}</span>
                            <span className="shrink-0 ml-2">{item.quantity} × {formatCurrency(item.unit_price)}</span>
                          </div>
                        ))}
                        {template.items.length > 3 && (
                          <p className="text-xs text-muted-foreground">
                            +{template.items.length - 3} more items
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditOpen(template)}
                    >
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

      {/* Edit Template Dialog */}
      <Dialog open={!!editingTemplate} onOpenChange={(open) => !open && setEditingTemplate(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Template</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Template Name *</Label>
                <Input
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                  placeholder="e.g., Standard Service Call"
                />
              </div>
              <div className="space-y-2">
                <Label>Priority</Label>
                <Select
                  value={editFormData.priority}
                  onValueChange={(value: 'low' | 'medium' | 'high' | 'urgent') =>
                    setEditFormData({ ...editFormData, priority: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {JOB_PRIORITIES.map((p) => (
                      <SelectItem key={p} value={p} className="capitalize">
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Job Title *</Label>
              <Input
                value={editFormData.title}
                onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                placeholder="Job title"
              />
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={editFormData.description}
                onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                placeholder="Job description"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Estimated Duration (minutes)</Label>
                <Input
                  type="number"
                  value={editFormData.estimated_duration}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, estimated_duration: parseInt(e.target.value) || 60 })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={editFormData.notes}
                onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                placeholder="Additional notes"
                rows={2}
              />
            </div>

            {/* Line Items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Line Items</Label>
                <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                  <Plus className="w-4 h-4 mr-1" />
                  Add Item
                </Button>
              </div>
              
              {editLineItems.length > 0 ? (
                <div className="space-y-2">
                  {editLineItems.map((item, index) => (
                    <div key={item.id} className="flex gap-2 items-start">
                      <div className="flex-1">
                        <Input
                          placeholder="Description"
                          value={item.description}
                          onChange={(e) => updateLineItem(item.id, 'description', e.target.value)}
                        />
                      </div>
                      <div className="w-20">
                        <Input
                          type="number"
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) => updateLineItem(item.id, 'quantity', parseInt(e.target.value) || 1)}
                        />
                      </div>
                      <div className="w-28">
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Price"
                          value={item.unitPrice}
                          onChange={(e) => updateLineItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeLineItem(item.id)}
                        className="shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-2">No line items</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingTemplate(null)}>
              Cancel
            </Button>
            <Button
              onClick={handleEditSave}
              disabled={!editFormData.name.trim() || !editFormData.title.trim() || updateTemplate.isPending}
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
              Are you sure you want to delete this template? This action cannot be undone.
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
    </PageContainer>
  );
};

export default JobTemplates;
