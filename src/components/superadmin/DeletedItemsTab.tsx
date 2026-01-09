import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, RotateCcw, Trash2, AlertTriangle, FileText, Briefcase, Receipt } from 'lucide-react';
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
}

interface DeletedItemsTabProps {
  companies: Company[];
}

export function DeletedItemsTab({ companies }: DeletedItemsTabProps) {
  const queryClient = useQueryClient();
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');

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
      toast.success('Document restored successfully');
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
        const total = result.jobs_deleted + result.quotes_deleted + result.invoices_deleted + result.customers_deleted;
        toast.success(`Permanently deleted ${total} records (${result.jobs_deleted} jobs, ${result.quotes_deleted} quotes, ${result.invoices_deleted} invoices, ${result.customers_deleted} customers)`);
      } else {
        toast.success('Cleanup complete - no records older than 6 months');
      }
    },
    onError: (error: any) => {
      toast.error('Failed to cleanup: ' + error.message);
    },
  });

  const getDocumentIcon = (type: string) => {
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

  const getDocumentBadgeVariant = (type: string) => {
    switch (type) {
      case 'job':
        return 'default';
      case 'quote':
        return 'secondary';
      case 'invoice':
        return 'outline';
      default:
        return 'default';
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
      default:
        return documentType + 's';
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="w-5 h-5" />
            Deleted Documents Recovery
          </CardTitle>
          <CardDescription>
            Recover deleted jobs, quotes, and invoices for any company. Documents are permanently deleted after 6 months.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 max-w-xs">
              <Select value={selectedCompanyId} onValueChange={setSelectedCompanyId}>
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
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Number</TableHead>
                    <TableHead>Title/Customer</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Deleted</TableHead>
                    <TableHead>Permanent Delete</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deletedDocuments.map((doc) => (
                    <TableRow key={`${doc.document_type}-${doc.id}`}>
                      <TableCell>
                        <Badge variant={getDocumentBadgeVariant(doc.document_type) as any} className="gap-1 capitalize">
                          {getDocumentIcon(doc.document_type)}
                          {doc.document_type}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {doc.document_number}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          {doc.title && <span className="font-medium">{doc.title}</span>}
                          {doc.customer_name && (
                            <span className="text-sm text-muted-foreground">{doc.customer_name}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {doc.total ? formatAmount(doc.total) : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-sm">
                            {format(new Date(doc.deleted_at), 'MMM d, yyyy')}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(doc.deleted_at), { addSuffix: true })}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-amber-600">
                          <AlertTriangle className="w-3 h-3" />
                          <span className="text-sm">
                            {format(new Date(doc.permanent_delete_at), 'MMM d, yyyy')}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            restoreMutation.mutate({
                              tableName: getTableName(doc.document_type),
                              documentId: doc.id,
                            })
                          }
                          disabled={restoreMutation.isPending}
                          className="gap-1"
                        >
                          {restoreMutation.isPending ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <RotateCcw className="w-3 h-3" />
                          )}
                          Restore
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
