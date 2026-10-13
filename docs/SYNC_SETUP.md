# Cross-device sync setup

Snoopy's Home is offline-first. Every edit is written to the current device immediately, whether or not the network is available. Signed-in devices mirror structured records and photo blobs to private per-user data in Convex. Reactive queries deliver changes made by another signed-in device.

## What is stored where

| Data | Offline copy | Cloud copy after sign-in |
| --- | --- | --- |
| birthdays, concerts, notes, lists, trackers, point-in-time, golden-hour settings, theme, current flight, and flight history | browser `localStorage` | one private `appStates` document in Convex |
| birthday and concert photos | IndexedDB database `snoopytools-media` | Convex Storage plus private `photos` metadata |
| app shell, fonts, map code, and static imagery | service-worker cache | Vercel deployment/CDN |

The local copy remains available while offline. Reconnecting compares the cloud and local timestamps, uploads the newest document and missing photos, and removes cloud photos that are no longer referenced. A newly signed-in device pulls the existing document and downloads its photos.

## Development setup

The repository is linked to the `snoopyhome` Convex project. On another development machine:

```powershell
npm install
npx convex dev
```

Log into the same Convex account and select the existing project. The command creates a private `.env.local` with `VITE_CONVEX_URL` and starts a development watcher. The public deployment URLs may be copied to Vercel; the deployment selector and any deploy keys must remain private.

Open the app's sync panel, create an account with an email and a password of at least eight characters, and use the same credentials on each device. Password reset email is not enabled yet, so save the password in a password manager.

## Offline and conflict behavior

- The PWA opens from its cached shell after it has been loaded once. Recently viewed OpenStreetMap tiles are cached for flight-map reuse.
- Edits and photos remain available on the device while offline.
- The sync indicator changes to `offline` and automatically reconciles after the browser reconnects.
- Concurrent edits currently use document-level last-write-wins based on the app update timestamp.
- Field-level merging and tombstones are the next hardening step if simultaneous edits on several devices become common.

## Apple sign-in

The shared data model already supports adding another identity provider. Apple sign-in still requires an Apple Developer account, a Services ID, a signing key, and provider environment variables. Keep email/password enabled as the free fallback when Apple OAuth is added.
