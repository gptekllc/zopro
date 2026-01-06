-- Keep invoice status in sync with payments (server-side)

CREATE OR REPLACE FUNCTION public.sync_invoice_status_for_invoice(_invoice_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invoice record;
  v_total_paid numeric;
  v_total_due numeric;
  v_is_overdue boolean;
  v_expected_status text;
  v_paid_at timestamptz;
BEGIN
  -- Lock the invoice row to avoid race conditions under concurrent payments
  SELECT id, status, total, late_fee_amount, due_date
  INTO v_invoice
  FROM public.invoices
  WHERE id = _invoice_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Do not change voided invoices
  IF v_invoice.status = 'voided' THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(amount), 0)
  INTO v_total_paid
  FROM public.payments
  WHERE invoice_id = _invoice_id
    AND status = 'completed';

  v_total_due := COALESCE(v_invoice.total, 0) + COALESCE(v_invoice.late_fee_amount, 0);

  v_is_overdue := (v_invoice.due_date IS NOT NULL AND v_invoice.due_date::date < now()::date);

  -- Preserve draft if still draft and no payments
  IF v_total_paid = 0 AND v_invoice.status = 'draft' THEN
    v_expected_status := 'draft';
    v_paid_at := NULL;
  ELSIF v_total_paid >= v_total_due AND v_total_due > 0 THEN
    v_expected_status := 'paid';
    v_paid_at := now();
  ELSIF v_total_paid > 0 AND v_total_paid < v_total_due THEN
    v_expected_status := 'partially_paid';
    v_paid_at := NULL;
  ELSE
    v_expected_status := CASE WHEN v_is_overdue THEN 'overdue' ELSE 'sent' END;
    v_paid_at := NULL;
  END IF;

  IF v_expected_status IS DISTINCT FROM v_invoice.status THEN
    UPDATE public.invoices
    SET status = v_expected_status,
        paid_at = v_paid_at,
        updated_at = now()
    WHERE id = _invoice_id;
  ELSE
    -- Still ensure paid_at cleared when moving away from paid
    IF v_expected_status <> 'paid' AND v_invoice.status <> 'paid' THEN
      -- no-op
      NULL;
    END IF;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_payments_sync_invoice_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Determine which invoice to sync depending on operation
  IF (TG_OP = 'DELETE') THEN
    PERFORM public.sync_invoice_status_for_invoice(OLD.invoice_id);
    RETURN OLD;
  ELSE
    PERFORM public.sync_invoice_status_for_invoice(NEW.invoice_id);
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS payments_sync_invoice_status_ins ON public.payments;
DROP TRIGGER IF EXISTS payments_sync_invoice_status_upd ON public.payments;
DROP TRIGGER IF EXISTS payments_sync_invoice_status_del ON public.payments;

CREATE TRIGGER payments_sync_invoice_status_ins
AFTER INSERT ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.trg_payments_sync_invoice_status();

CREATE TRIGGER payments_sync_invoice_status_upd
AFTER UPDATE OF amount, status, invoice_id ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.trg_payments_sync_invoice_status();

CREATE TRIGGER payments_sync_invoice_status_del
AFTER DELETE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.trg_payments_sync_invoice_status();
