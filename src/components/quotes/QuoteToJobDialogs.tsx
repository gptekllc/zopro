import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Briefcase, Plus } from 'lucide-react';

interface QuoteItem {
  id: string;
  description: string;
  quantity: number;
  unit_price: number;
  total: number;
}

interface Quote {
  id: string;
  quote_number: string;
  customer_id: string;
  items?: QuoteItem[];
  notes?: string | null;
}

interface Job {
  id: string;
  job_number: string;
  title: string;
  customer_id: string;
}

interface CreateJobFromQuoteDialogProps {
  quote: Quote | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (quoteId: string, selectedItemIds: string[], copyPhotos: boolean) => Promise<void>;
  isPending: boolean;
}

export function CreateJobFromQuoteDialog({
  quote,
  open,
  onOpenChange,
  onConfirm,
  isPending,
}: CreateJobFromQuoteDialogProps) {
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [copyPhotos, setCopyPhotos] = useState(true);

  // Initialize selection when quote changes
  useMemo(() => {
    if (quote?.items) {
      setSelectedItemIds(quote.items.map(item => item.id));
    }
    setCopyPhotos(true);
  }, [quote?.id]);

  const handleToggleItem = (itemId: string) => {
    setSelectedItemIds(prev =>
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleSelectAll = () => {
    if (quote?.items) {
      setSelectedItemIds(quote.items.map(item => item.id));
    }
  };

  const handleDeselectAll = () => {
    setSelectedItemIds([]);
  };

  const selectedTotal = useMemo(() => {
    if (!quote?.items) return 0;
    return quote.items
      .filter(item => selectedItemIds.includes(item.id))
      .reduce((sum, item) => sum + item.total, 0);
  }, [quote?.items, selectedItemIds]);

  const handleConfirm = async () => {
    if (quote && selectedItemIds.length > 0) {
      await onConfirm(quote.id, selectedItemIds, copyPhotos);
      onOpenChange(false);
    }
  };

  if (!quote) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-xl md:max-w-2xl max-h-[100dvh] sm:max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-primary" />
            Create Job from Quote
          </DialogTitle>
          <DialogDescription>
            Select which items from {quote.quote_number} to include in the new job.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Select All / Deselect All */}
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={handleSelectAll}>
              Select All
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={handleDeselectAll}>
              Deselect All
            </Button>
          </div>

          {/* Items List */}
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {quote.items && quote.items.length > 0 ? (
              quote.items.map((item) => (
                <label
                  key={item.id}
                  className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors"
                >
                  <Checkbox
                    checked={selectedItemIds.includes(item.id)}
                    onCheckedChange={() => handleToggleItem(item.id)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{item.description}</p>
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>{item.quantity} × ${Number(item.unit_price).toLocaleString()}</span>
                      <span className="font-medium text-foreground">${Number(item.total).toLocaleString()}</span>
                    </div>
                  </div>
                </label>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No items in this quote
              </p>
            )}
          </div>

          {/* Selected Total */}
          <div className="flex justify-between items-center p-3 bg-primary/5 rounded-lg border">
            <span className="font-medium">Selected Items Total:</span>
            <span className="text-lg font-semibold text-primary">
              ${selectedTotal.toLocaleString()}
            </span>
          </div>

          {/* Copy Photos Option */}
          <label className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors">
            <Checkbox
              checked={copyPhotos}
              onCheckedChange={(checked) => setCopyPhotos(checked === true)}
            />
            <div className="flex-1">
              <p className="font-medium text-sm">Copy photos to job</p>
              <p className="text-xs text-muted-foreground">
                Include all photos from this quote in the new job
              </p>
            </div>
          </label>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isPending || selectedItemIds.length === 0}
            className="w-full sm:w-auto"
          >
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Create Job ({selectedItemIds.length} items)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface AddQuoteItemsToJobDialogProps {
  quote: Quote | null;
  jobs: Job[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (quoteId: string, jobId: string, selectedItemIds: string[]) => Promise<void>;
  isPending: boolean;
}

export function AddQuoteItemsToJobDialog({
  quote,
  jobs,
  open,
  onOpenChange,
  onConfirm,
  isPending,
}: AddQuoteItemsToJobDialogProps) {
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  // Filter jobs to same customer and exclude completed/paid jobs
  const eligibleJobs = useMemo(() => {
    if (!quote) return [];
    return jobs.filter(
      job => job.customer_id === quote.customer_id && 
             !['completed', 'invoiced', 'paid'].includes((job as any).status || '')
    );
  }, [jobs, quote?.customer_id]);

  // Initialize selection when quote changes
  useMemo(() => {
    if (quote?.items) {
      setSelectedItemIds(quote.items.map(item => item.id));
    }
    setSelectedJobId('');
  }, [quote?.id]);

  const handleToggleItem = (itemId: string) => {
    setSelectedItemIds(prev =>
      prev.includes(itemId)
        ? prev.filter(id => id !== itemId)
        : [...prev, itemId]
    );
  };

  const handleSelectAll = () => {
    if (quote?.items) {
      setSelectedItemIds(quote.items.map(item => item.id));
    }
  };

  const handleDeselectAll = () => {
    setSelectedItemIds([]);
  };

  const selectedTotal = useMemo(() => {
    if (!quote?.items) return 0;
    return quote.items
      .filter(item => selectedItemIds.includes(item.id))
      .reduce((sum, item) => sum + item.total, 0);
  }, [quote?.items, selectedItemIds]);

  const handleConfirm = async () => {
    if (quote && selectedJobId && selectedItemIds.length > 0) {
      await onConfirm(quote.id, selectedJobId, selectedItemIds);
      onOpenChange(false);
    }
  };

  if (!quote) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-xl md:max-w-2xl max-h-[100dvh] sm:max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-primary" />
            Add Items to Existing Job
          </DialogTitle>
          <DialogDescription>
            Select items from {quote.quote_number} and choose a job to add them to.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Job Selection */}
          <div className="space-y-2">
            <Label>Select Job</Label>
            <Select value={selectedJobId} onValueChange={setSelectedJobId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a job..." />
              </SelectTrigger>
              <SelectContent>
                {eligibleJobs.length > 0 ? (
                  eligibleJobs.map((job) => (
                    <SelectItem key={job.id} value={job.id}>
                      {job.job_number} - {job.title}
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="none" disabled>
                    No eligible jobs for this customer
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
            {eligibleJobs.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Only in-progress or scheduled jobs for the same customer can receive additional items.
              </p>
            )}
          </div>

          {/* Select All / Deselect All */}
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={handleSelectAll}>
              Select All
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={handleDeselectAll}>
              Deselect All
            </Button>
          </div>

          {/* Items List */}
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {quote.items && quote.items.length > 0 ? (
              quote.items.map((item) => (
                <label
                  key={item.id}
                  className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg cursor-pointer hover:bg-muted transition-colors"
                >
                  <Checkbox
                    checked={selectedItemIds.includes(item.id)}
                    onCheckedChange={() => handleToggleItem(item.id)}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{item.description}</p>
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>{item.quantity} × ${Number(item.unit_price).toLocaleString()}</span>
                      <span className="font-medium text-foreground">${Number(item.total).toLocaleString()}</span>
                    </div>
                  </div>
                </label>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">
                No items in this quote
              </p>
            )}
          </div>

          {/* Selected Total */}
          <div className="flex justify-between items-center p-3 bg-primary/5 rounded-lg border">
            <span className="font-medium">Selected Items Total:</span>
            <span className="text-lg font-semibold text-primary">
              ${selectedTotal.toLocaleString()}
            </span>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isPending || selectedItemIds.length === 0 || !selectedJobId}
            className="w-full sm:w-auto"
          >
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Add to Job ({selectedItemIds.length} items)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
