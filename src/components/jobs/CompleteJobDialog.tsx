import { useState } from 'react';
import { Job, useUpdateJob, useConvertJobToInvoice } from '@/hooks/useJobs';
import { useEmailDocument } from '@/hooks/useDocumentActions';
import { useCustomers } from '@/hooks/useCustomers';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2, CheckCircle2, FileText, Mail } from 'lucide-react';
import { toast } from 'sonner';

interface CompleteJobDialogProps {
  job: Job | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete?: () => void;
}

export function CompleteJobDialog({ job, open, onOpenChange, onComplete }: CompleteJobDialogProps) {
  // When closed (or not yet selected), don't render anything to avoid null access.
  if (!job) return null;

  const [generateInvoice, setGenerateInvoice] = useState(true);
  const [emailCustomer, setEmailCustomer] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const updateJob = useUpdateJob();
  const convertToInvoice = useConvertJobToInvoice();
  const emailDocument = useEmailDocument();
  const { data: customers = [] } = useCustomers();

  const customer = customers.find((c) => c.id === job.customer_id);
  const customerEmail = customer?.email;

  const handleComplete = async () => {
    setIsProcessing(true);
    
    try {
      // Step 1: Mark job as completed
      await updateJob.mutateAsync({
        id: job.id,
        status: 'completed',
        actual_end: new Date().toISOString(),
      });
      
      let invoiceId: string | null = null;
      
      // Step 2: Generate invoice if selected
      if (generateInvoice) {
        const invoice = await convertToInvoice.mutateAsync(job);
        invoiceId = invoice.id;
        
        // Step 3: Email customer if selected and has email
        if (emailCustomer && customerEmail && invoiceId) {
          await emailDocument.mutateAsync({
            type: 'invoice',
            documentId: invoiceId,
            recipientEmail: customerEmail,
          });
        }
      }
      
      toast.success(
        generateInvoice 
          ? emailCustomer && customerEmail
            ? 'Job completed, invoice created and sent to customer!'
            : 'Job completed and invoice created!'
          : 'Job marked as completed!'
      );
      
      onOpenChange(false);
      onComplete?.();
    } catch (error) {
      // Errors are handled by individual hooks
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-success" />
            Complete Job {job.job_number}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-4 pt-2">
              <p>This will mark the job as completed. Choose what actions to take:</p>
              
              <div className="space-y-3 bg-muted/50 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="generate-invoice"
                    checked={generateInvoice}
                    onCheckedChange={(checked) => setGenerateInvoice(checked as boolean)}
                  />
                  <div className="grid gap-1.5 leading-none">
                    <Label
                      htmlFor="generate-invoice"
                      className="flex items-center gap-2 cursor-pointer font-medium"
                    >
                      <FileText className="w-4 h-4" />
                      Generate Invoice
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Create an invoice from the job details and linked quote items
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-3">
                  <Checkbox
                    id="email-customer"
                    checked={emailCustomer}
                    disabled={!generateInvoice || !customerEmail}
                    onCheckedChange={(checked) => setEmailCustomer(checked as boolean)}
                  />
                  <div className="grid gap-1.5 leading-none">
                    <Label
                      htmlFor="email-customer"
                      className={`flex items-center gap-2 cursor-pointer font-medium ${(!generateInvoice || !customerEmail) ? 'text-muted-foreground' : ''}`}
                    >
                      <Mail className="w-4 h-4" />
                      Email Invoice to Customer
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      {customerEmail 
                        ? `Send invoice to ${customerEmail}`
                        : 'Customer has no email address on file'}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="text-sm text-muted-foreground border-l-2 border-primary pl-3">
                <strong>Summary:</strong>
                <ul className="mt-1 space-y-1">
                  <li>✓ Job status will be set to "Completed"</li>
                  <li>✓ Actual end time will be recorded</li>
                  {generateInvoice && <li>✓ Invoice will be created from job</li>}
                  {generateInvoice && emailCustomer && customerEmail && (
                    <li>✓ Invoice will be emailed to customer</li>
                  )}
                </ul>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isProcessing}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleComplete} disabled={isProcessing}>
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Complete Job
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
