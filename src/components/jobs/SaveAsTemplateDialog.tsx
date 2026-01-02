import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCreateJobTemplate } from '@/hooks/useJobTemplates';
import { Loader2 } from 'lucide-react';

interface Job {
  title: string;
  description: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  estimated_duration: number | null;
  notes: string | null;
  items?: Array<{
    description: string;
    quantity: number;
    unit_price: number;
  }>;
}

interface SaveAsTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  job: Job | null;
}

export function SaveAsTemplateDialog({ open, onOpenChange, job }: SaveAsTemplateDialogProps) {
  const [templateName, setTemplateName] = useState('');
  const createTemplate = useCreateJobTemplate();

  const handleSave = async () => {
    if (!job || !templateName.trim()) return;

    await createTemplate.mutateAsync({
      name: templateName.trim(),
      title: job.title,
      description: job.description || undefined,
      priority: job.priority,
      estimated_duration: job.estimated_duration || 60,
      notes: job.notes || undefined,
      items: job.items?.map(item => ({
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
      })) || [],
    });

    setTemplateName('');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save as Template</DialogTitle>
          <DialogDescription>
            Save this job configuration as a reusable template.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="template-name">Template Name</Label>
            <Input
              id="template-name"
              placeholder="e.g., Standard Service Call"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              autoFocus
            />
          </div>

          {job && (
            <div className="rounded-lg border bg-muted/50 p-3 text-sm space-y-1">
              <p><span className="font-medium">Title:</span> {job.title}</p>
              <p><span className="font-medium">Priority:</span> {job.priority}</p>
              {job.items && job.items.length > 0 && (
                <p><span className="font-medium">Line Items:</span> {job.items.length}</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!templateName.trim() || createTemplate.isPending}
          >
            {createTemplate.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Template
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
