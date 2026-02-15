

# Add OneSignal Push Delivery to Edge Function

## Step 1: Add Required Secrets
Two secrets need to be added to Supabase Edge Functions:

- **ONESIGNAL_APP_ID** -- Found in OneSignal Dashboard > Settings > Keys and IDs
- **ONESIGNAL_REST_API_KEY** -- Found in the same location (labeled "REST API Key")

I will prompt you to add these before proceeding with code changes.

## Step 2: Update `supabase/functions/send-push-notification/index.ts`

After the existing in-app notification logic, add OneSignal delivery:

1. Read `ONESIGNAL_APP_ID` and `ONESIGNAL_REST_API_KEY` from environment
2. Query the `profiles` table for users matching the target `userId` or `companyId` who have a non-null `onesignal_player_id`
3. If player IDs are found, call OneSignal's Create Notification API:

```
POST https://onesignal.com/api/v1/notifications
Authorization: Basic <ONESIGNAL_REST_API_KEY>

{
  "app_id": "<ONESIGNAL_APP_ID>",
  "include_external_user_ids": ["<user_id>"],
  "headings": { "en": "<title>" },
  "contents": { "en": "<body>" },
  "data": { "url": "<url>", "tag": "<tag>" },
  "ios_badgeType": "SetTo",
  "ios_badgeCount": <badge_count>
}
```

4. Log the OneSignal API response for debugging
5. Keep the existing VAPID/web-push path unchanged for web users

## Step 3: No Frontend Changes

The UI (`PushNotificationToggle`, `useDespiaInit`) is already correctly wired. The `setonesignalplayerid://` call on login maps user IDs to devices in OneSignal, and `onesignal_player_id` is stored in the `profiles` table.

## Flow After Fix

```text
Notification inserted in DB
        |
        v
DB trigger --> send-push-notification Edge Function
        |
        v
  1. Skip in-app insert (already exists)
  2. Query profiles for onesignal_player_id
  3. If found --> POST to OneSignal REST API --> native push delivered
  4. Also handle web push_subscriptions (existing path)
```

## What You Need To Do

When I prompt you, paste in your:
- OneSignal App ID
- OneSignal REST API Key

Both are found at: OneSignal Dashboard > Your App > Settings > Keys and IDs
