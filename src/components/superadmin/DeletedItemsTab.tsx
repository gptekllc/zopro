import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Loader2, RotateCcw, Trash2, AlertTriangle, FileText, Briefcase, Receipt, Image, User, Users, ChevronDown } from 'lucide-react';
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

// Helper to determine bucket name from document type
const getBucketName = (documentType: string): string => {
  switch (documentType) {
    case 'job_photo':
      return 'job-photos';
    case 'quote_photo':
      return 'quote-photos';
    case 'invoice_photo':
      return 'invoice-photos';
    default:
      return '';
  }
};

export function DeletedItemsTab({ companies }: DeletedItemsTabProps) {
  const queryClient = useQueryClient();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [showCleanupConfirm, setShowCleanupConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});

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

  // Generate signed URLs for photo thumbnails
  useEffect(() => {
    const generateSignedUrls = async () => {
      const photoItems = deletedDocuments.filter(d => d.document_type.includes('photo') && d.photo_url);
      if (photoItems.length === 0) {
        setSignedUrls({});
        return;
      }

      const urls: Record<string, string> = {};
      
      await Promise.all(photoItems.map(async (photo) => {
        const bucketName = getBucketName(photo.document_type);
        if (!bucketName || !photo.photo_url) return;
        
        try {
          const { data } = await supabase.storage
            .from(bucketName)
            .createSignedUrl(photo.photo_url, 3600); // 1 hour expiry
          
          if (data?.signedUrl) {
            urls[photo.id] = data.signedUrl;
          }
        } catch (err) {
          console.warn('Failed to generate signed URL for photo:', photo.id, err);
        }
      }));
      
      setSignedUrls(urls);
    };

    if (deletedDocuments.length > 0) {
      generateSignedUrls();
    } else {
      setSignedUrls({});
    }
  }, [deletedDocuments]);

  // Group documents by type
  const groupedDocuments = useMemo(() => {
    const groups: Record<string, DeletedDocument[]> = {
      job: [],
      quote: [],
      invoice: [],
      customer: [],
      user: [],
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
      queryClient.invalidateQueries({ queryKey: ['job'] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['job-photos'] });
      queryClient.invalidateQueries({ queryKey: ['quote-photos'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-photos'] });
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
      queryClient.invalidateQueries({ queryKey: ['job'] });
      queryClient.invalidateQueries({ queryKey: ['quotes'] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['job-photos'] });
      queryClient.invalidateQueries({ queryKey: ['quote-photos'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-photos'] });
      setSelectedItems(new Set());
      toast.success('Selected items restored successfully');
    },
    onError: (error: any) => {
      toast.error('Failed to restore: ' + error.message);
    },
  });

  // Bulk permanent delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (items: { tableName: string; documentId: string }[]) => {
      for (const item of items) {
        // For photos, also delete the file from storage
        if (item.tableName.includes('photos')) {
          const doc = deletedDocuments.find(d => d.id === item.documentId);
          if (doc?.photo_url) {
            const bucketName = getBucketName(doc.document_type);
            if (bucketName) {
              const { error: storageError } = await supabase.storage
                .from(bucketName)
                .remove([doc.photo_url]);
              if (storageError) {
                console.warn('Failed to delete photo from storage:', storageError);
              }
            }
          }
        }
        
        const { error } = await supabase.rpc('permanent_delete_document', {
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
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      queryClient.invalidateQueries({ queryKey: ['job-photos'] });
      queryClient.invalidateQueries({ queryKey: ['quote-photos'] });
      queryClient.invalidateQueries({ queryKey: ['invoice-photos'] });
      const count = selectedItems.size;
      setSelectedItems(new Set());
      toast.success(`Permanently deleted ${count} items`);
    },
    onError: (error: any) => {
      toast.error('Failed to delete: ' + error.message);
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
        const total = result.jobs_deleted + result.quotes_deleted + result.invoices_deleted + result.customers_deleted + (result.photos_deleted || 0) + (result.users_deleted || 0);
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
      case 'customer':
        return <Users className="w-4 h-4" />;
      case 'user':
        return <User className="w-4 h-4" />;
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
      case 'customer':
        return 'customers';
      case 'user':
        return 'profiles';
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

  const handleCleanupConfirm = () => {
    cleanupMutation.mutate();
    setShowCleanupConfirm(false);
  };

  const handleBulkDelete = () => {
    const items = Array.from(selectedItems).map((key) => {
      const [docType, docId] = key.split(':');
      return { tableName: getTableName(docType), documentId: docId };
    });
    bulkDeleteMutation.mutate(items);
    setShowDeleteConfirm(false);
  };

  const renderSection = (title: string, icon: React.ReactNode, docs: DeletedDocument[], variant: 'default' | 'secondary' | 'outline' | 'destructive') => {
    if (docs.length === 0) return null;

    const sectionKeys = docs.map((d) => `${d.document_type}:${d.id}`);
    const allSelected = sectionKeys.every((k) => selectedItems.has(k));
    const someSelected = sectionKeys.some((k) => selectedItems.has(k));

    return (
      <Collapsible defaultOpen className="space-y-3">
        <div className="flex items-center gap-3 pb-2 border-b">
          <Checkbox 
            checked={allSelected} 
            onCheckedChange={() => toggleSection(docs)}
            className={someSelected && !allSelected ? 'data-[state=checked]:bg-primary/50' : ''}
          />
          <CollapsibleTrigger className="flex items-center gap-2 hover:opacity-80 transition-opacity group flex-1">
            <Badge variant={variant} className="gap-1">
              {icon}
              {title}
            </Badge>
            <span className="text-sm text-muted-foreground">({docs.length})</span>
            <ChevronDown className="w-4 h-4 text-muted-foreground ml-auto transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent>
          <div className="space-y-2 pl-2">
            {docs.map((doc) => {
              const key = `${doc.document_type}:${doc.id}`;
              const isSelected = selectedItems.has(key);
              const isPhoto = doc.document_type.includes('photo');
              const isUser = doc.document_type === 'user';
              const isCustomer = doc.document_type === 'customer';

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
                  
                  {isPhoto && (doc.photo_url || signedUrls[doc.id]) ? (
                    <img
                      src={signedUrls[doc.id] || doc.photo_url || ''}
                      alt={doc.title || 'Photo'}
                      className="w-12 h-12 rounded object-cover bg-muted"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : isUser && doc.photo_url ? (
                    <img
                      src={doc.photo_url}
                      alt={doc.title || 'User'}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                      {getDocumentIcon(doc.document_type)}
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {isUser ? (
                        <>
                          <span className="font-medium">{doc.title || 'Unknown User'}</span>
                          <span className="text-sm text-muted-foreground truncate">{doc.document_number}</span>
                        </>
                      ) : isCustomer ? (
                        <>
                          <span className="font-medium">{doc.title || 'Unknown Customer'}</span>
                          {doc.document_number && (
                            <span className="text-sm text-muted-foreground truncate">{doc.document_number}</span>
                          )}
                        </>
                      ) : (
                        <>
                          <span className="font-mono text-sm font-medium">{doc.document_number}</span>
                          {doc.title && (
                            <span className="text-sm truncate">{doc.title}</span>
                          )}
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {isUser ? (
                        <span className="capitalize">{doc.customer_name || 'No role'}</span>
                      ) : isCustomer ? (
                        <span>{doc.customer_name || 'No additional info'}</span>
                      ) : (
                        <>
                          {doc.customer_name && <span>{doc.customer_name}</span>}
                          {doc.total != null && <span>• {formatAmount(doc.total)}</span>}
                        </>
                      )}
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
        </CollapsibleContent>
      </Collapsible>
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
                Recover deleted jobs, quotes, invoices, customers, users, and photos. Documents are permanently deleted after 6 months.
              </CardDescription>
            </div>
            {selectedItems.size > 0 && (
              <div className="flex gap-2">
                <Button
                  onClick={handleBulkRestore}
                  disabled={bulkRestoreMutation.isPending || bulkDeleteMutation.isPending}
                  className="gap-2"
                >
                  {bulkRestoreMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <RotateCcw className="w-4 h-4" />
                  )}
                  Restore Selected ({selectedItems.size})
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={bulkRestoreMutation.isPending || bulkDeleteMutation.isPending}
                  className="gap-2"
                >
                  {bulkDeleteMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  Delete Permanently
                </Button>
              </div>
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
              onClick={() => setShowCleanupConfirm(true)}
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
              {renderSection('Customers', <Users className="w-3 h-3" />, groupedDocuments.customer, 'default')}
              {renderSection('Users', <User className="w-3 h-3" />, groupedDocuments.user, 'default')}
              {renderSection('Photos', <Image className="w-3 h-3" />, groupedDocuments.photo, 'destructive')}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cleanup Confirmation Dialog */}
      <AlertDialog open={showCleanupConfirm} onOpenChange={setShowCleanupConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently Delete Old Records?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all soft-deleted records older than 6 months across all companies. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleCleanupConfirm}
            >
              Yes, Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Selected Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Permanently Delete Selected Items?</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to permanently delete {selectedItems.size} selected item(s). This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={handleBulkDelete}
            >
              Yes, Delete Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}