import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, MessageSquare, AlertCircle, Phone } from 'lucide-react';
import { useSendSms, useSmsSettings } from '@/hooks/useSmsSettings';

interface SendSmsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messageType: 'invoice' | 'portal_link' | 'technician_eta';
  customerId?: string;
  defaultPhone?: string;
  defaultVariables?: Record<string, string>;
  onSuccess?: () => void;
}

// Template previews
const TEMPLATE_PREVIEWS = {
  invoice: 'Hi {{customer_first_name}}, your invoice {{invoice_number}} is ready. View and pay: {{portal_link}}',
  portal_link: 'Hi {{customer_first_name}}, access your {{company_name}} customer portal here: {{portal_link}}',
  technician_eta: 'Hi {{customer_first_name}}, {{technician_name}} is on the way for {{job_title}}. ETA: {{eta_time}}',
};

const REQUIRED_VARIABLES: Record<string, string[]> = {
  invoice: ['customer_first_name', 'invoice_number', 'portal_link'],
  portal_link: ['customer_first_name', 'company_name', 'portal_link'],
  technician_eta: ['customer_first_name', 'technician_name', 'job_title', 'eta_time'],
};

export function SendSmsDialog({
  open,
  onOpenChange,
  messageType,
  customerId,
  defaultPhone = '',
  defaultVariables = {},
  onSuccess,
}: SendSmsDialogProps) {
  const { isSmsEnabled, usage } = useSmsSettings();
  const sendSms = useSendSms();
  
  const [phone, setPhone] = useState(defaultPhone);
  const [variables, setVariables] = useState<Record<string, string>>(defaultVariables);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setPhone(defaultPhone);
      setVariables(defaultVariables);
    }
  }, [open, defaultPhone, defaultVariables]);

  const handleSend = async () => {
    // Validate phone
    if (!phone || !/^\+[1-9]\d{1,14}$/.test(phone)) {
      return;
    }

    await sendSms.mutateAsync({
      message_type: messageType,
      recipient_phone: phone,
      customer_id: customerId,
      variables,
    });

    onOpenChange(false);
    onSuccess?.();
  };

  // Generate preview
  let preview = TEMPLATE_PREVIEWS[messageType];
  for (const [key, value] of Object.entries(variables)) {
    preview = preview.replace(new RegExp(`{{${key}}}`, 'g'), value || `[${key}]`);
  }

  const requiredVars = REQUIRED_VARIABLES[messageType] || [];
  const missingVars = requiredVars.filter(v => !variables[v]);
  const isLimitReached = usage && usage.messages_limit && usage.messages_sent >= usage.messages_limit;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />
            Send SMS
          </DialogTitle>
          <DialogDescription>
            Send a {messageType.replace('_', ' ')} SMS to the customer
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* SMS not enabled */}
          {!isSmsEnabled && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                SMS is not enabled. Please enable it in Company Settings first.
              </AlertDescription>
            </Alert>
          )}

          {/* Limit reached */}
          {isLimitReached && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Monthly SMS limit reached ({usage?.messages_sent}/{usage?.messages_limit}).
              </AlertDescription>
            </Alert>
          )}

          {/* Phone Number */}
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                id="phone"
                placeholder="+15551234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="pl-9"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Must be in E.164 format (e.g., +15551234567)
            </p>
          </div>

          {/* Variable Inputs */}
          {requiredVars.map((varName) => (
            <div key={varName} className="space-y-2">
              <Label htmlFor={varName}>
                {varName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              </Label>
              <Input
                id={varName}
                value={variables[varName] || ''}
                onChange={(e) => setVariables(prev => ({ ...prev, [varName]: e.target.value }))}
                placeholder={`Enter ${varName.replace(/_/g, ' ')}`}
              />
            </div>
          ))}

          {/* Preview */}
          <div className="space-y-2">
            <Label>Message Preview</Label>
            <div className="p-3 bg-muted rounded-md text-sm">
              {preview}
            </div>
            <p className="text-xs text-muted-foreground">
              ~{preview.length} characters
            </p>
          </div>

          {/* Usage info */}
          {usage && (
            <p className="text-xs text-muted-foreground">
              Usage: {usage.messages_sent}/{usage.messages_limit === null ? '∞' : usage.messages_limit} messages this month
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={
              !isSmsEnabled ||
              isLimitReached ||
              !phone ||
              !/^\+[1-9]\d{1,14}$/.test(phone) ||
              missingVars.length > 0 ||
              sendSms.isPending
            }
          >
            {sendSms.isPending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <MessageSquare className="w-4 h-4 mr-2" />
                Send SMS
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
