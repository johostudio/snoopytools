# Cross-device sync setup

Snoopy's Home is offline-first. Every edit is written to the current device immediately, whether or not the cloud is configured or reachable. When a signed-in device is online, the app mirrors the structured records to a private Supabase row and photo blobs to a private Storage bucket. Realtime updates pull changes made on another signed-in device.

## What is stored where

| Data | Offline copy | Cloud copy after sign-in |
| --- | --- | --- |
| birthdays, concerts, notes, lists, trackers, point-in-time, golden-hour settings, theme, current flight, and flight history | browser `localStorage` | `public.app_state.data` JSON |
| birthday and concert photos | IndexedDB database `snoopytools-media` | private `snoopy-photos` Storage bucket |
| app shell, fonts, map code, and static imagery | service-worker cache | Vercel deployment/CDN |

The local copy remains authoritative while offline. Reconnecting uploads the latest saved document and missing photos. A newly signed-in device pulls the existing cloud document and photos before displaying them.

## Connect Supabase

1. Create a Supabase project.
2. Open its SQL editor and run [`supabase-setup.sql`](supabase-setup.sql).
3. In **Authentication → URL Configuration**, set the production Site URL and add `http://localhost:5173/**` plus the Vercel preview wildcard to the redirect allow list.
4. Enable email authentication. To use the app's Apple button, also configure the Apple provider with an Apple Services ID and secret.
5. Copy `.env.example` to `.env.local` and fill in the project URL and publishable key.
6. Add the same two variables to the Vercel project:

   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`

7. Redeploy. Open the sync dot in the top bar and sign in with the same account on every device.

Only the publishable browser key belongs in Vite/Vercel. Never put a Supabase `service_role` key in this client app.

## Offline behavior

- The PWA opens from its cached shell after it has been loaded once. Recently viewed OpenStreetMap tiles are cached for flight-map reuse; uncached regions fall back to the route panel and map background while offline.
- Edits and photos remain available on the device while offline.
- The top-bar sync indicator changes to `offline` and automatically retries after the browser reports that the connection is back.
- Concurrent edits currently use document-level last-write-wins based on the app's update timestamp. For one person editing their own archive, this keeps the interaction simple; field-level conflict merging is the next hardening step if simultaneous edits on several devices become common.
