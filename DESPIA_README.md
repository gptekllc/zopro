> 🚦 **Native Setup Source of Truth**
> Before any native feature work, open **`DESPIA_README.md`**, then open the **Despia sitemap**, pick the feature page, and use the **latest Lovable Prompt** from that page.

# Despia Native Integration — ZoPro

This project uses [Despia](https://despia.com) to wrap the Lovable web app as a native iOS/Android application with real device features.

## Package
- `despia-native` (npm)

## Features Integrated
- **Platform Detection**: User agent check for Despia runtime (`src/lib/despia.ts`)
- **Safe Areas**: CSS variables `var(--safe-area-top)` and `var(--safe-area-bottom)` — already used in AppLayout
- **Haptic Feedback**: Despia native haptics (`heavyhaptic://`, `lighthaptic://`, etc.) with web fallback
- **Device Indexing**: `despia.uuid` for unique device identification
- **OneSignal Push**: `setonesignalplayerid://` called after login
- **Deep Links**: AASA and assetlinks.json hosted at `/.well-known/`
- **RevenueCat IAP**: Purchase flow via `revenuecat://purchase`, `iapSuccess` handler, server-driven offerings
- **Sign in with Apple**: AppleJS inline + custom Edge Functions (concept — needs Apple Developer credentials)

## Documentation Sources (memory-proof)
- Primary sitemap: https://setup.despia.com/llms.txt
- Feature page(s) used most recently:
  - https://setup.despia.com/lovable/native-features/safe-areas
  - https://setup.despia.com/lovable/native-features/haptic-feedback
  - https://setup.despia.com/lovable/native-features/user-agent
  - https://setup.despia.com/lovable/native-features/device-indexing
  - https://setup.despia.com/lovable/native-features/onesignal
  - https://setup.despia.com/lovable/native-features/deeplinking
  - https://setup.despia.com/lovable/native-features/paywalls
  - https://setup.despia.com/lovable/native-features/o-auth-2-0/apple-auth

## Configuration Placeholders (fill before publishing)
- `TEAMID` — Apple Developer Team ID
- `BUNDLEID` — iOS Bundle ID from Despia Publishing Panel
- `PACKAGE_NAME` — Android package name from Despia Publishing Panel
- `SHA256_FINGERPRINT` — From Google Play Console → App Integrity
- `ONESIGNAL_APP_ID` — OneSignal App ID (add to Despia project settings)
- `REVENUECAT_API_KEY` — RevenueCat public API key
- `APPLE_CLIENT_ID` — Apple Services ID for Sign in with Apple
