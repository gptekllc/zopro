import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { useCreateQuoteTemplate } from '@/hooks/useQuoteTemplates';
import { Quote } from '@/hooks/useQuotes';

interface SaveAsQuoteTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quote: Quote | null;
}

export function SaveAsQuoteTemplateDialog({ open, onOpenChange, quote }: SaveAsQuoteTemplateDialogProps) {
  const [templateName, setTemplateName] = useState('');
  const createTemplate = useCreateQuoteTemplate();

  const handleSave = async () => {
    if (!quote || !templateName.trim()) return;

    await createTemplate.mutateAsync({
      name: templateName,
      notes: quote.notes || undefined,
      valid_days: 30,
      items: quote.items?.map(item => ({
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Save as Quote Template</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Template Name *</Label>
            <Input
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="e.g., Standard Quote"
              autoFocus
            />
          </div>

          {quote?.items && quote.items.length > 0 && (
            <div className="text-sm text-muted-foreground">
              This template will include {quote.items.length} line item{quote.items.length !== 1 ? 's' : ''}.
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
