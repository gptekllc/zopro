-- Create a function to insert default email templates for a new company
CREATE OR REPLACE FUNCTION public.create_default_email_templates(_company_id uuid, _created_by uuid DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Invoice template
  INSERT INTO email_templates (company_id, created_by, name, template_type, subject, body, is_default)
  VALUES (
    _company_id,
    _created_by,
    'Standard Invoice',
    'invoice',
    'Invoice {{invoice_number}} from {{company_name}}',
    'Hello {{customer_name}},

Thank you for your business! Please find your invoice details below.

<b>Invoice Number:</b> {{invoice_number}}
<b>Amount Due:</b> {{invoice_total}}
<b>Due Date:</b> {{due_date}}

If you have any questions about this invoice, please don''t hesitate to reach out.

Best regards,
{{sender_name}}
{{company_name}}

{{social_links}}',
    true
  );

  -- Reminder template
  INSERT INTO email_templates (company_id, created_by, name, template_type, subject, body, is_default)
  VALUES (
    _company_id,
    _created_by,
    'Payment Reminder',
    'reminder',
    'Friendly Reminder: Invoice {{invoice_number}} Due {{due_date}}',
    'Hello {{customer_name}},

This is a friendly reminder that invoice <b>{{invoice_number}}</b> for <b>{{invoice_total}}</b> is due on <b>{{due_date}}</b>.

If you''ve already sent payment, please disregard this message. Otherwise, we kindly ask that you arrange payment at your earliest convenience.

<div style="text-align: center; margin: 20px 0;">
  <a href="{{payment_link}}" style="background-color: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">Pay Now</a>
</div>

If you have any questions or concerns, please contact us.

Thank you,
{{sender_name}}
{{company_name}}

{{social_links}}',
    true
  );

  -- Quote template
  INSERT INTO email_templates (company_id, created_by, name, template_type, subject, body, is_default)
  VALUES (
    _company_id,
    _created_by,
    'Standard Quote',
    'quote',
    'Quote {{quote_number}} from {{company_name}}',
    'Hello {{customer_name}},

Thank you for your interest in our services! We''re pleased to provide you with the following quote.

<b>Quote Number:</b> {{quote_number}}
<b>Total:</b> {{quote_total}}
<b>Valid Until:</b> {{quote_valid_until}}

Please review the attached quote at your convenience. If you have any questions or would like to proceed, simply reply to this email or give us a call.

We look forward to working with you!

Best regards,
{{sender_name}}
{{company_name}}

{{social_links}}',
    true
  );

  -- Job template
  INSERT INTO email_templates (company_id, created_by, name, template_type, subject, body, is_default)
  VALUES (
    _company_id,
    _created_by,
    'Job Scheduled',
    'job',
    'Your Service Appointment - {{job_title}}',
    'Hello {{customer_name}},

Great news! Your service appointment has been scheduled.

<b>Service:</b> {{job_title}}
<b>Date:</b> {{scheduled_date}}
<b>Time:</b> {{scheduled_time}}
<b>Technician:</b> {{technician_name}}

<h2>What to Expect</h2>
Our technician will arrive during the scheduled time window. Please ensure someone is available to provide access if needed.

If you need to reschedule or have any questions, please contact us as soon as possible.

<div style="text-align: center; margin: 20px 0;">
  <a href="{{customer_portal_link}}" style="background-color: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">View in Customer Portal</a>
</div>

Thank you for choosing {{company_name}}!

{{sender_name}}

{{social_links}}',
    true
  );

  -- General template
  INSERT INTO email_templates (company_id, created_by, name, template_type, subject, body, is_default)
  VALUES (
    _company_id,
    _created_by,
    'General Message',
    'general',
    'Message from {{company_name}}',
    'Hello {{customer_name}},

Thank you for being a valued customer of {{company_name}}.

We wanted to reach out to share some important information with you.

If you have any questions or need assistance, please don''t hesitate to contact us at {{company_phone}} or {{company_email}}.

<div style="text-align: center; margin: 20px 0;">
  <a href="{{customer_portal_link}}" style="background-color: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">Visit Customer Portal</a>
</div>

Best regards,
{{sender_name}}
{{company_name}}
{{company_full_address}}

{{social_links}}',
    true
  );
END;
$$;

-- Update the create_company_and_set_admin function to also create default email templates
CREATE OR REPLACE FUNCTION public.create_company_and_set_admin(
  _name text,
  _email text DEFAULT NULL,
  _phone text DEFAULT NULL,
  _address text DEFAULT NULL,
  _city text DEFAULT NULL,
  _state text DEFAULT NULL,
  _zip text DEFAULT NULL
)
RETURNS TABLE(company_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _company_id uuid;
BEGIN
  -- Create company
  INSERT INTO companies (name, email, phone, address, city, state, zip)
  VALUES (_name, _email, _phone, _address, _city, _state, _zip)
  RETURNING id INTO _company_id;

  -- Set profile company + admin role
  UPDATE profiles
  SET company_id = _company_id, role = 'admin'
  WHERE id = _user_id;

  -- Grant admin role in user_roles table
  INSERT INTO user_roles (user_id, role)
  VALUES (_user_id, 'admin')
  ON CONFLICT DO NOTHING;

  -- Create default email templates
  PERFORM create_default_email_templates(_company_id, _user_id);

  RETURN QUERY SELECT _company_id;
END;
$$;