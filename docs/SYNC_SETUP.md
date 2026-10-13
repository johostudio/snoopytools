# Cross-device sync setup

Snoopy's Home is offline-first. Every edit is written to the current device immediately, whether or not the network is available. Signed-in devices mirror structured records and photo blobs to private per-user data in Convex. Reactive queries deliver changes made by another signed-in device.

## What is stored where

| Data | Offline copy | Cloud copy after sign-in |
| --- | --- | --- |
| birthdays, concerts, notes, lists, trackers, point-in-time, golden-hour settings, theme, current flight, flight history, Last.fm cache, and music picks | browser `localStorage` | one private `appStates` document in Convex |
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

The web/PWA auth provider stores a renewable Convex session in that device's `localStorage`. After the first sign-in, closing the PWA, refreshing it, or installing a newer service worker does not require another password. There is no sign-out control in the app, so the session remains until site storage is cleared or the refresh session is revoked.

## Last.fm connection

The listening browser uses Last.fm's public read-only methods through a Convex action. Create an API account at `https://www.last.fm/api/account/create`, then set only the API key in Convex. The API secret is not used by this app.

After a Last.fm username connects successfully, it is stored with the rest of the app archive. The browser refreshes stale listening data when opened and keeps the last successful copy available offline.

```powershell
npx convex env set LASTFM_API_KEY
npx convex env set --prod LASTFM_API_KEY
```

Each command prompts for the value without adding it to Git or a shell command. The username is entered inside the app and syncs with the archive. Stats refresh only when requested; the most recent weekly, monthly, and 12-month results remain cached for offline browsing and top-three selection.

## Offline and conflict behavior

- The PWA opens from its cached shell after it has been loaded once. Recently viewed OpenStreetMap tiles are cached for flight-map reuse.
- Edits and photos remain available on the device while offline.
- The sync indicator changes to `offline` and automatically reconciles after the browser reconnects.
- Concurrent edits currently use document-level last-write-wins based on the app update timestamp.
- Field-level merging and tombstones are the next hardening step if simultaneous edits on several devices become common.

## Apple sign-in

The shared data model already supports adding another identity provider. Apple sign-in still requires an Apple Developer account, a Services ID, a signing key, and provider environment variables. Keep email/password enabled as the free fallback when Apple OAuth is added.
