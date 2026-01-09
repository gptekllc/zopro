import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, RotateCcw, Trash2, AlertTriangle, FileText, Briefcase, Receipt, Image } from 'lucide-react';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { formatAmount } from '@/lib/formatAmount';

interface Company {
  id: string;
  name: string;
}

interface DeletedDocument {
  id: string;
  document_type: string;
  document_number: string;
  title: string | null;
  customer_name: string | null;
  deleted_at: string;
  permanent_delete_at: string;
  total: number | null;
  photo_url: string | null;
}

interface DeletedItemsTabProps {
  companies: Company[];
}

export function DeletedItemsTab({ companies }: DeletedItemsTabProps) {
  const queryClient = useQueryClient();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  // Fetch deleted documents for selected company
  const { data: deletedDocuments = [], isLoading } = useQuery({
    queryKey: ['deleted-documents', selectedCompanyId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_deleted_documents', {
        p_company_id: selectedCompanyId,
      });
      if (error) throw error;
      return data as DeletedDocument[];
    },
    enabled: !!selectedCompanyId,
  });

  // Group documents by type
  const groupedDocuments = useMemo(() => {
    const groups: Record<string, DeletedDocument[]> = {
      job: [],
      quote: [],
      invoice: [],
      photo: [],
    };

    deletedDocuments.forEach((doc) => {
      if (doc.document_type.includes('photo')) {
        groups.photo.push(doc);
      } else if (groups[doc.document_type]) {
        groups[doc.document_type].push(doc);
      }
    });

    return groups;
  }, [deletedDocuments]);

  // Restore document mutation
  const restoreMutation = useMutation({
    mutationFn: async ({ tableName, documentId }: { tableName: string; documentId: string }) => {
      const { data, error } = await supabase.rpc('restore_deleted_document', {
        p_table_name: tableName,
        p_document_id: documentId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deleted-documents'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: (error: any) => {
      toast.error('Failed to restore: ' + error.message);
    },
  });

  // Bulk restore mutation
  const bulkRestoreMutation = useMutation({
    mutationFn: async (items: { tableName: string; documentId: string }[]) => {
      for (const item of items) {
        const { error } = await supabase.rpc('restore_deleted_document', {
          p_table_name: item.tableName,
          p_document_id: item.documentId,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deleted-documents'] });
      queryClient.invalidateQueries({ queryKey: ['jobs'] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      setSelectedItems(new Set());
      toast.success('Selected items restored successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to restore: ' + error.message);
    },
  });

  // Permanent cleanup mutation
  const cleanupMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc('permanent_delete_old_soft_deleted_records');
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['deleted-documents'] });
      const result = data?.[0];
      if (result) {
        const total = result.jobs_deleted + result.quotes_deleted + result.invoices_deleted + result.customers_deleted + (result.photos_deleted || 0);
        toast.success(`Permanently deleted ${total} records`);
      } else {
        toast.success('Cleanup complete - no records older than 6 months');
      }
    },
    onError: (error: any) => {
      toast.error('Failed to cleanup: ' + error.message);
    },
  });

  const getDocumentIcon = (type: string) => {
    if (type.includes('photo')) return <Image className="w-4 h-4" />;
    switch (type) {
      case 'job':
        return <Briefcase className="w-4 h-4" />;
      case 'quote':
        return <FileText className="w-4 h-4" />;
      case 'invoice':
        return <Receipt className="w-4 h-4" />;
      default:
        return <FileText className="w-4 h-4" />;
    }
  };

  const getTableName = (documentType: string) => {
    switch (documentType) {
      case 'job':
        return 'jobs';
      case 'quote':
        return 'quotes';
      case 'invoice':
        return 'invoices';
      case 'job_photo':
        return 'job_photos';
      case 'quote_photo':
        return 'quote_photos';
      case 'invoice_photo':
        return 'invoice_photos';
      default:
        return documentType + 's';
    }
  };

  const toggleItem = (docId: string, docType: string) => {
    const key = `${docType}:${docId}`;
    const newSelected = new Set(selectedItems);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    setSelectedItems(newSelected);
  };

  const toggleSection = (docs: DeletedDocument[]) => {
    const keys = docs.map((d) => `${d.document_type}:${d.id}`);
    const allSelected = keys.every((k) => selectedItems.has(k));
    const newSelected = new Set(selectedItems);
    
    if (allSelected) {
      keys.forEach((k) => newSelected.delete(k));
    } else {
      keys.forEach((k) => newSelected.add(k));
    }
    setSelectedItems(newSelected);
  };

  const handleBulkRestore = () => {
    const items = Array.from(selectedItems).map((key) => {
      const [docType, docId] = key.split(':');
      return { tableName: getTableName(docType), documentId: docId };
    });
    bulkRestoreMutation.mutate(items);
  };

  const renderSection = (title: string, icon: React.ReactNode, docs: DeletedDocument[], variant: 'default' | 'secondary' | 'outline' | 'destructive') => {
    if (docs.length === 0) return null;

    const sectionKeys = docs.map((d) => `${d.document_type}:${d.id}`);
    const allSelected = sectionKeys.every((k) => selectedItems.has(k));
    const someSelected = sectionKeys.some((k) => selectedItems.has(k));

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 pb-2 border-b">
          <Checkbox 
            checked={allSelected} 
            onCheckedChange={() => toggleSection(docs)}
            className={someSelected && !allSelected ? 'data-[state=checked]:bg-primary/50' : ''}
          />
          <Badge variant={variant} className="gap-1">
            {icon}
            {title}
          </Badge>
          <span className="text-sm text-muted-foreground">({docs.length})</span>
        </div>
        <div className="space-y-2 pl-2">
          {docs.map((doc) => {
            const key = `${doc.document_type}:${doc.id}`;
            const isSelected = selectedItems.has(key);
            const isPhoto = doc.document_type.includes('photo');

            return (
              <div
                key={key}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                  isSelected ? 'bg-primary/5 border-primary/30' : 'bg-muted/30'
                }`}
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggleItem(doc.id, doc.document_type)}
                />
                
                {isPhoto && doc.photo_url ? (
                  <img
                    src={doc.photo_url}
                    alt={doc.title || 'Photo'}
                    className="w-12 h-12 rounded object-cover"
                  />
                ) : (
                  <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                    {getDocumentIcon(doc.document_type)}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-medium">{doc.document_number}</span>
                    {doc.title && (
                      <span className="text-sm truncate">{doc.title}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {doc.customer_name && <span>{doc.customer_name}</span>}
                    {doc.total != null && <span>• {formatAmount(doc.total)}</span>}
                  </div>
                </div>

                <div className="flex flex-col items-end text-xs">
                  <span className="text-muted-foreground">
                    {formatDistanceToNow(new Date(doc.deleted_at), { addSuffix: true })}
                  </span>
                  <div className="flex items-center gap-1 text-amber-600">
                    <AlertTriangle className="w-3 h-3" />
                    <span>{format(new Date(doc.permanent_delete_at), 'MMM d')}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Trash2 className="w-5 h-5" />
                Deleted Documents Recovery
              </CardTitle>
              <CardDescription>
                Recover deleted jobs, quotes, invoices, and photos. Documents are permanently deleted after 6 months.
              </CardDescription>
            </div>
            {selectedItems.size > 0 && (
              <Button
                onClick={handleBulkRestore}
                disabled={bulkRestoreMutation.isPending}
                className="gap-2"
              >
                {bulkRestoreMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RotateCcw className="w-4 h-4" />
                )}
                Restore Selected ({selectedItems.size})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 max-w-xs">
              <Select 
                value={selectedCompanyId} 
                onValueChange={(value) => {
                  setSelectedCompanyId(value);
                  setSelectedItems(new Set());
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a company..." />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="destructive"
              onClick={() => cleanupMutation.mutate()}
              disabled={cleanupMutation.isPending}
              className="gap-2"
            >
              {cleanupMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Cleanup Old Records (&gt;6 months)
            </Button>
          </div>

          {!selectedCompanyId ? (
            <div className="text-center py-8 text-muted-foreground">
              Select a company to view deleted documents
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : deletedDocuments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No deleted documents found for this company
            </div>
          ) : (
            <div className="space-y-6">
              {renderSection('Jobs', <Briefcase className="w-3 h-3" />, groupedDocuments.job, 'default')}
              {renderSection('Quotes', <FileText className="w-3 h-3" />, groupedDocuments.quote, 'secondary')}
              {renderSection('Invoices', <Receipt className="w-3 h-3" />, groupedDocuments.invoice, 'outline')}
              {renderSection('Photos', <Image className="w-3 h-3" />, groupedDocuments.photo, 'destructive')}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}