import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, X, Users, Mail, AlertCircle } from 'lucide-react';
import { useCustomers } from '@/hooks/useCustomers';
import { useProfiles } from '@/hooks/useProfiles';

interface Recipient {
  id: string;
  name: string;
  email: string;
  type: 'customer' | 'technician' | 'manual';
}

interface ReportEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: (emails: string[]) => Promise<{ successful: string[]; failed: { email: string; reason: string }[] }>;
  isSending: boolean;
  title?: string;
}

export const ReportEmailDialog = ({
  open,
  onOpenChange,
  onSend,
  isSending,
  title = 'Email Report',
}: ReportEmailDialogProps) => {
  const [manualEmails, setManualEmails] = useState('');
  const [selectedRecipients, setSelectedRecipients] = useState<Recipient[]>([]);
  const [searchCustomers, setSearchCustomers] = useState('');
  const [searchTeam, setSearchTeam] = useState('');
  const [sendResult, setSendResult] = useState<{ successful: string[]; failed: { email: string; reason: string }[] } | null>(null);

  const { data: customers = [] } = useCustomers();
  const { data: profiles = [] } = useProfiles();

  // Filter customers with valid emails
  const customersWithEmail = useMemo(() => {
    return customers
      .filter(c => c.email && c.email.trim() !== '')
      .filter(c => c.name.toLowerCase().includes(searchCustomers.toLowerCase()) ||
                   c.email?.toLowerCase().includes(searchCustomers.toLowerCase()))
      .map(c => ({
        id: c.id,
        name: c.name,
        email: c.email!,
        type: 'customer' as const,
      }));
  }, [customers, searchCustomers]);

  // Filter team members with valid emails
  const teamWithEmail = useMemo(() => {
    return profiles
      .filter(p => p.email && p.email.trim() !== '')
      .filter(p => (p.full_name?.toLowerCase() || '').includes(searchTeam.toLowerCase()) ||
                   p.email.toLowerCase().includes(searchTeam.toLowerCase()))
      .map(p => ({
        id: p.id,
        name: p.full_name || p.email,
        email: p.email,
        type: 'technician' as const,
      }));
  }, [profiles, searchTeam]);

  // Parse manual emails
  const parseManualEmails = (): Recipient[] => {
    if (!manualEmails.trim()) return [];
    
    return manualEmails
      .split(/[,;\s]+/)
      .map(e => e.trim())
      .filter(e => e.length > 0)
      .map(email => ({
        id: `manual-${email}`,
        name: email,
        email,
        type: 'manual' as const,
      }));
  };

  // Get all unique recipients
  const allRecipients = useMemo(() => {
    const manualParsed = parseManualEmails();
    const allEmails = new Set<string>();
    const result: Recipient[] = [];

    [...selectedRecipients, ...manualParsed].forEach(r => {
      const emailLower = r.email.toLowerCase();
      if (!allEmails.has(emailLower)) {
        allEmails.add(emailLower);
        result.push(r);
      }
    });

    return result;
  }, [selectedRecipients, manualEmails]);

  const toggleRecipient = (recipient: Recipient) => {
    setSelectedRecipients(prev => {
      const exists = prev.find(r => r.id === recipient.id);
      if (exists) {
        return prev.filter(r => r.id !== recipient.id);
      }
      return [...prev, recipient];
    });
  };

  const removeRecipient = (recipient: Recipient) => {
    if (recipient.type === 'manual') {
      // Remove from manual emails string
      const emails = manualEmails
        .split(/[,;\s]+/)
        .filter(e => e.trim().toLowerCase() !== recipient.email.toLowerCase())
        .join(', ');
      setManualEmails(emails);
    } else {
      setSelectedRecipients(prev => prev.filter(r => r.id !== recipient.id));
    }
  };

  const handleSend = async () => {
    if (allRecipients.length === 0) return;

    const emails = allRecipients.map(r => r.email);
    const result = await onSend(emails);
    setSendResult(result);

    // If all successful, close after a brief delay
    if (result.failed.length === 0) {
      setTimeout(() => {
        handleClose();
      }, 1500);
    }
  };

  const handleClose = () => {
    setManualEmails('');
    setSelectedRecipients([]);
    setSearchCustomers('');
    setSearchTeam('');
    setSendResult(null);
    onOpenChange(false);
  };

  const isSelected = (id: string) => selectedRecipients.some(r => r.id === id);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            {title}
          </DialogTitle>
          <DialogDescription>
            Send this report to multiple recipients. Enter emails manually or select from your customers and team members.
          </DialogDescription>
        </DialogHeader>

        {/* Send Result Display */}
        {sendResult && (
          <div className="space-y-2">
            {sendResult.successful.length > 0 && (
              <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-3">
                <p className="text-sm font-medium text-green-800 dark:text-green-200">
                  ✓ Successfully sent to {sendResult.successful.length} recipient{sendResult.successful.length !== 1 ? 's' : ''}
                </p>
              </div>
            )}
            {sendResult.failed.length > 0 && (
              <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <p className="text-sm font-medium text-red-800 dark:text-red-200 flex items-center gap-1 mb-2">
                  <AlertCircle className="h-4 w-4" />
                  Failed to send to {sendResult.failed.length} recipient{sendResult.failed.length !== 1 ? 's' : ''}:
                </p>
                <ul className="text-sm text-red-700 dark:text-red-300 space-y-1">
                  {sendResult.failed.map((f, i) => (
                    <li key={i} className="flex justify-between">
                      <span>{f.email}</span>
                      <span className="text-xs text-red-500">{f.reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Selected Recipients */}
        {allRecipients.length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Recipients ({allRecipients.length})
            </Label>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-2 bg-muted/50 rounded-lg">
              {allRecipients.map(recipient => (
                <Badge 
                  key={recipient.id} 
                  variant="secondary" 
                  className="flex items-center gap-1 pr-1"
                >
                  <span className="max-w-[150px] truncate">{recipient.name}</span>
                  <button
                    onClick={() => removeRecipient(recipient)}
                    className="ml-1 hover:bg-muted rounded-full p-0.5"
                    disabled={isSending}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>
        )}

        <Tabs defaultValue="manual" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="manual">Manual Entry</TabsTrigger>
            <TabsTrigger value="customers">
              Customers ({customersWithEmail.length})
            </TabsTrigger>
            <TabsTrigger value="team">
              Team ({teamWithEmail.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manual" className="flex-1 space-y-3 mt-4">
            <div className="space-y-2">
              <Label htmlFor="emails">Email Addresses</Label>
              <Input
                id="emails"
                placeholder="Enter emails separated by commas (e.g., john@example.com, jane@example.com)"
                value={manualEmails}
                onChange={(e) => setManualEmails(e.target.value)}
                disabled={isSending}
              />
              <p className="text-xs text-muted-foreground">
                Separate multiple emails with commas, semicolons, or spaces
              </p>
            </div>
          </TabsContent>

          <TabsContent value="customers" className="flex-1 overflow-hidden flex flex-col mt-4">
            <div className="space-y-2">
              <Input
                placeholder="Search customers..."
                value={searchCustomers}
                onChange={(e) => setSearchCustomers(e.target.value)}
                disabled={isSending}
              />
            </div>
            <ScrollArea className="flex-1 mt-3 border rounded-lg">
              {customersWithEmail.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-sm">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  {customers.length === 0 ? 'No customers found' : 'No customers with email addresses'}
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {customersWithEmail.map(customer => (
                    <label
                      key={customer.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer"
                    >
                      <Checkbox
                        checked={isSelected(customer.id)}
                        onCheckedChange={() => toggleRecipient(customer)}
                        disabled={isSending}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{customer.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{customer.email}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          <TabsContent value="team" className="flex-1 overflow-hidden flex flex-col mt-4">
            <div className="space-y-2">
              <Input
                placeholder="Search team members..."
                value={searchTeam}
                onChange={(e) => setSearchTeam(e.target.value)}
                disabled={isSending}
              />
            </div>
            <ScrollArea className="flex-1 mt-3 border rounded-lg">
              {teamWithEmail.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-sm">
                  <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  No team members found
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {teamWithEmail.map(member => (
                    <label
                      key={member.id}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer"
                    >
                      <Checkbox
                        checked={isSelected(member.id)}
                        onCheckedChange={() => toggleRecipient(member)}
                        disabled={isSending}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{member.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={handleClose} disabled={isSending}>
            Cancel
          </Button>
          <Button 
            onClick={handleSend} 
            disabled={isSending || allRecipients.length === 0}
          >
            {isSending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="mr-2 h-4 w-4" />
                Send to {allRecipients.length} recipient{allRecipients.length !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
