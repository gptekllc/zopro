import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Search, FileText, Trash2, Edit, DollarSign } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { toast } from 'sonner';
import { QuoteLineItem } from '@/types';

const Quotes = () => {
  const { quotes, customers, currentUser, addQuote, updateQuote, deleteQuote } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingQuote, setEditingQuote] = useState<string | null>(null);
  const [formData, setFormData] = useState<{
    customerId: string;
    items: QuoteLineItem[];
    notes: string;
    status: 'draft' | 'sent' | 'approved' | 'rejected';
    validDays: number;
  }>({
    customerId: '',
    items: [{ id: '1', description: '', quantity: 1, unitPrice: 0 }],
    notes: '',
    status: 'draft',
    validDays: 30,
  });

  const filteredQuotes = quotes.filter(q => {
    const matchesSearch = q.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.quoteNumber.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || q.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const resetForm = () => {
    setFormData({
      customerId: '',
      items: [{ id: '1', description: '', quantity: 1, unitPrice: 0 }],
      notes: '',
      status: 'draft',
      validDays: 30,
    });
    setEditingQuote(null);
  };

  const handleAddItem = () => {
    setFormData({
      ...formData,
      items: [...formData.items, { id: Date.now().toString(), description: '', quantity: 1, unitPrice: 0 }],
    });
  };

  const handleRemoveItem = (id: string) => {
    if (formData.items.length > 1) {
      setFormData({
        ...formData,
        items: formData.items.filter(item => item.id !== id),
      });
    }
  };

  const handleItemChange = (id: string, field: keyof QuoteLineItem, value: string | number) => {
    setFormData({
      ...formData,
      items: formData.items.map(item =>
        item.id === id ? { ...item, [field]: value } : item
      ),
    });
  };

  const calculateTotal = (items: QuoteLineItem[]) => {
    return items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const customer = customers.find(c => c.id === formData.customerId);
    if (!customer) {
      toast.error('Please select a customer');
      return;
    }

    if (editingQuote) {
      updateQuote(editingQuote, {
        customerId: formData.customerId,
        customerName: customer.name,
        items: formData.items,
        notes: formData.notes,
        status: formData.status,
        validUntil: addDays(new Date(), formData.validDays),
      });
      toast.success('Quote updated successfully');
    } else {
      addQuote({
        customerId: formData.customerId,
        customerName: customer.name,
        items: formData.items,
        notes: formData.notes,
        status: formData.status,
        validUntil: addDays(new Date(), formData.validDays),
        createdBy: currentUser?.id || '',
      });
      toast.success('Quote created successfully');
    }
    
    setIsDialogOpen(false);
    resetForm();
  };

  const handleEdit = (quote: typeof quotes[0]) => {
    setFormData({
      customerId: quote.customerId,
      items: quote.items,
      notes: quote.notes || '',
      status: quote.status,
      validDays: 30,
    });
    setEditingQuote(quote.id);
    setIsDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this quote?')) {
      deleteQuote(id);
      toast.success('Quote deleted');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'bg-success/10 text-success';
      case 'sent': return 'bg-primary/10 text-primary';
      case 'rejected': return 'bg-destructive/10 text-destructive';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Quotes</h1>
          <p className="text-muted-foreground mt-1">{quotes.length} total quotes</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="w-4 h-4" />
              Create Quote
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingQuote ? 'Edit Quote' : 'Create New Quote'}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Customer *</Label>
                  <Select
                    value={formData.customerId}
                    onValueChange={(value) => setFormData({ ...formData, customerId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Valid For (days)</Label>
                  <Input
                    type="number"
                    value={formData.validDays}
                    onChange={(e) => setFormData({ ...formData, validDays: parseInt(e.target.value) || 30 })}
                  />
                </div>
              </div>

              {/* Line Items */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Line Items</Label>
                  <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
                    <Plus className="w-4 h-4 mr-1" /> Add Item
                  </Button>
                </div>
                
                {formData.items.map((item, idx) => (
                  <div key={item.id} className="flex gap-2 items-start">
                    <Input
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) => handleItemChange(item.id, 'description', e.target.value)}
                      className="flex-1"
                    />
                    <Input
                      type="number"
                      placeholder="Qty"
                      value={item.quantity}
                      onChange={(e) => handleItemChange(item.id, 'quantity', parseInt(e.target.value) || 0)}
                      className="w-20"
                    />
                    <Input
                      type="number"
                      placeholder="Price"
                      value={item.unitPrice}
                      onChange={(e) => handleItemChange(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                      className="w-24"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveItem(item.id)}
                      disabled={formData.items.length === 1}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}

                <div className="text-right font-semibold text-lg">
                  Total: ${calculateTotal(formData.items).toLocaleString()}
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={3}
                />
              </div>
              
              <div className="flex gap-3 pt-4">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1">
                  {editingQuote ? 'Update' : 'Create'} Quote
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search quotes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Quote List */}
      <div className="space-y-3">
        {filteredQuotes.map((quote) => (
          <Card key={quote.id} className="overflow-hidden hover:shadow-md transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                    <FileText className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{quote.quoteNumber}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${getStatusColor(quote.status)}`}>
                        {quote.status}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{quote.customerName}</p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right hidden sm:block">
                    <p className="font-semibold flex items-center gap-1">
                      <DollarSign className="w-4 h-4" />
                      {calculateTotal(quote.items).toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Valid until {format(new Date(quote.validUntil), 'MMM d, yyyy')}
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(quote)}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(quote.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredQuotes.length === 0 && (
        <div className="text-center py-12">
          <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-medium">No quotes found</h3>
          <p className="text-muted-foreground mt-1">
            {searchQuery || statusFilter !== 'all' ? 'Try adjusting your filters' : 'Create your first quote to get started'}
          </p>
        </div>
      )}
    </div>
  );
};

export default Quotes;
