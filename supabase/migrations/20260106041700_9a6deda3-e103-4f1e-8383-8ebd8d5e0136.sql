-- Create trigger to auto-sync invoice status after any payment change
DROP TRIGGER IF EXISTS payments_sync_invoice_status ON public.payments;

CREATE TRIGGER payments_sync_invoice_status
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_payments_sync_invoice_status();