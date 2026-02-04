

# Twilio SMS Integration - Implementation Plan

## Current State Analysis

After a thorough exploration of the codebase, I discovered that **your SMS infrastructure is already 90% complete**. Here's what exists:

### Already Implemented

| Component | Status |
|-----------|--------|
| `send-sms` Edge Function | ✅ Complete with all enforcement logic |
| Database tables (`sms_logs`, `sms_usage`, `company_sms_settings`) | ✅ Created |
| RPC functions (`get_sms_usage_for_period`, `increment_sms_usage`) | ✅ Created |
| Plan-based SMS limits in `subscription_plans` | ✅ Configured |
| Global kill switch in `app_settings` | ✅ Working |
| Company SMS Settings Card | ✅ Integrated in Company page |
| Super Admin SMS Tab | ✅ Full monitoring dashboard |
| Frontend hooks (`useSmsSettings`, `useSendSms`, `useSmsLogs`) | ✅ Complete |
| `SendSmsDialog` component | ✅ Built but not wired |
| `SmsLogsTable` component | ✅ Built |

### Missing Pieces

| Component | Status |
|-----------|--------|
| Twilio credentials (secrets) | ❌ Not configured |
| "On My Way" SMS using Twilio (currently uses `sms:` native links) | ❌ Not integrated |
| Invoice SMS button | ❌ Not present |
| Customer Portal link SMS | ❌ Not present |
| Company SMS logs view for admins | ❌ Not integrated |

---

## Implementation Plan

### Phase 1: Add Twilio Credentials

**Action**: Prompt you to add the required Twilio secrets.

**Secrets needed**:
- `TWILIO_ACCOUNT_SID` - Your Twilio Account SID
- `TWILIO_AUTH_TOKEN` - Your Twilio Auth Token  
- `TWILIO_PHONE_NUMBER` - Your Twilio phone number (in E.164 format, e.g., `+15551234567`)

These will be stored securely in Supabase environment variables and are only accessible by Edge Functions.

---

### Phase 2: Integrate SMS into Job Flow (Technician ETA)

**File**: `src/components/jobs/JobDetailDialog.tsx`

**Change**: Replace the current "On My Way" button that opens the device's native SMS app with an option to send via Twilio.

**Logic**:
1. Check if company has SMS enabled (via `useSmsSettings` hook)
2. If SMS is available and enabled → Show "Send via Twilio" option
3. If SMS is not available → Fall back to current native `sms:` link behavior
4. Use `useSendSms` mutation with `message_type: 'technician_eta'`

**User Experience**:
- Dropdown shows ETA options (5, 10, 15, 20, 30 minutes)
- Selecting an ETA sends the SMS immediately via Twilio
- Toast notification confirms success/failure
- Falls back gracefully for companies without SMS

---

### Phase 3: Integrate SMS into Invoice Flow

**File**: `src/components/invoices/InvoiceDetailDialog.tsx`

**Change**: Add "Send SMS" action next to the "Send Email" button in the invoice actions.

**Logic**:
1. Show SMS button only if:
   - Customer has a valid phone number
   - Company has SMS enabled
   - Plan allows SMS
2. Open `SendSmsDialog` with `message_type: 'invoice'`
3. Pre-fill variables: `customer_first_name`, `invoice_number`, `portal_link`

**User Experience**:
- Button shows "Send SMS" with phone icon
- Clicking opens dialog with preview of the message
- Disabled with tooltip if phone is missing or SMS not available

---

### Phase 4: Integrate SMS into Customer Portal Sharing

**File**: `src/pages/Customers.tsx` (and related customer actions)

**Change**: Add "Send Portal Link via SMS" option when sharing customer portal access.

**Logic**:
1. After generating portal link, offer SMS option alongside email
2. Use `message_type: 'portal_link'`
3. Pre-fill: `customer_first_name`, `company_name`, `portal_link`

**User Experience**:
- In customer detail or when sharing portal, show both email and SMS options
- SMS option disabled if no phone or SMS not available

---

### Phase 5: Add SMS Logs to Company Settings

**File**: `src/pages/Company.tsx`

**Change**: Add an "SMS Logs" section within the SMS Settings accordion.

**Logic**:
- Use existing `useSmsLogs` hook
- Display recent SMS sent by the company
- Show status (sent/failed/blocked), recipient, timestamp
- Link to view full message details

**Components Used**:
- Existing `SmsLogsTable` component (already built)

---

### Phase 6: Auto-Send SMS (Event-Triggered)

**Enhancement**: Leverage the existing `auto_send_invoice_sms` and `auto_send_portal_link_sms` settings.

**File**: `supabase/functions/send-notification/index.ts` (and similar)

**Change**: When sending invoice email, also trigger SMS if:
- `auto_send_invoice_sms = true`
- Customer has phone
- All SMS checks pass

This makes SMS truly event-driven rather than manual.

---

## Technical Details

### Edge Function Flow (Already Implemented)

```text
┌─────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Client    │────▶│  send-sms Edge  │────▶│   Twilio API    │
│  (Browser)  │     │    Function     │     │                 │
└─────────────┘     └─────────────────┘     └─────────────────┘
                           │
                           ▼
              ┌─────────────────────────────┐
              │     Enforcement Checks      │
              │  1. Global kill switch      │
              │  2. Plan SMS enabled        │
              │  3. Company SMS enabled     │
              │  4. Monthly limit check     │
              │  5. Phone format valid      │
              └─────────────────────────────┘
                           │
                           ▼
              ┌─────────────────────────────┐
              │    Database Updates         │
              │  - Log to sms_logs          │
              │  - Increment sms_usage      │
              └─────────────────────────────┘
```

### Plan Quotas (Already Configured)

| Plan | SMS Enabled | Monthly Limit |
|------|-------------|---------------|
| Free | No | 0 |
| Starter | No | 50 |
| Professional | Yes | 200 |
| Enterprise | Yes | Unlimited |

### Message Templates (Already Defined)

```text
invoice:        "Hi {{customer_first_name}}, your invoice {{invoice_number}} 
                 is ready. View and pay: {{portal_link}}"

portal_link:    "Hi {{customer_first_name}}, access your {{company_name}} 
                 customer portal here: {{portal_link}}"

technician_eta: "Hi {{customer_first_name}}, {{technician_name}} is on 
                 the way for {{job_title}}. ETA: {{eta_time}}"
```

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/jobs/JobDetailDialog.tsx` | Add Twilio SMS option for "On My Way" |
| `src/components/jobs/JobListManager.tsx` | Add Twilio SMS option in list actions |
| `src/components/invoices/InvoiceDetailDialog.tsx` | Add "Send SMS" button |
| `src/pages/Customers.tsx` | Add SMS option for portal sharing |
| `src/pages/Company.tsx` | Add SMS logs section |
| `supabase/functions/send-notification/index.ts` | Add auto-send SMS logic |

---

## Security Guarantees

All requirements from your specification are already met:

- ✅ Twilio credentials never exposed to client (Edge Function only)
- ✅ All SMS goes through backend enforcement
- ✅ JWT validation on every request
- ✅ Company ID resolved from authenticated user
- ✅ Plan limits enforced before Twilio call
- ✅ Usage tracked atomically
- ✅ All attempts logged (success, failure, blocked)
- ✅ Global kill switch for emergencies
- ✅ Super admin oversight dashboard
- ✅ No free-text messages (templates only)
- ✅ No marketing SMS capability

---

## Summary

Your SMS system is architecturally complete. The remaining work is:

1. **Add Twilio secrets** (required)
2. **Wire up UI components** (~4 files)
3. **Add auto-send logic** (1 Edge Function enhancement)

Estimated effort: **30-45 minutes** to complete integration.

