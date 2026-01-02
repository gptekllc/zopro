import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, FileText } from 'lucide-react';
import { useQuoteTemplates, QuoteTemplate } from '@/hooks/useQuoteTemplates';

interface SelectQuoteTemplateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (template: QuoteTemplate) => void;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

export function SelectQuoteTemplateDialog({ open, onOpenChange, onSelect }: SelectQuoteTemplateDialogProps) {
  const { data: templates, isLoading } = useQuoteTemplates();

  const calculateTotal = (template: QuoteTemplate) => {
    if (!template.items || template.items.length === 0) return 0;
    return template.items.reduce((sum, item) => sum + item.total, 0);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Select Quote Template</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : !templates || templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <FileText className="w-12 h-12 text-muted-foreground/50 mb-3" />
            <p className="text-muted-foreground">No quote templates available.</p>
            <p className="text-sm text-muted-foreground mt-1">
              Save a quote as a template first.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {templates.map((template) => (
              <Card
                key={template.id}
                className="cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => {
                  onSelect(template);
                  onOpenChange(false);
                }}
              >
                <CardContent className="p-4">
                  <h3 className="font-medium">{template.name}</h3>
                  {template.notes && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                      {template.notes}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                    {template.items && template.items.length > 0 && (
                      <span>
                        {template.items.length} item{template.items.length !== 1 ? 's' : ''} • {formatCurrency(calculateTotal(template))}
                      </span>
                    )}
                    <span>Valid {template.valid_days} days</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
