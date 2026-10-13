# Snoopy's Home

A local-first app for birthdays, concerts, golden hour, focus flights, repeatable lists, countdowns, notes, and configurable trackers. The interface uses scanned-paper texture, tight lowercase typography, asymmetric collage, and muted archive colours inspired by the supplied references.

## Run it

```bash
npm install
npm run dev
```

Then open the local URL Vite prints. The app is responsive and installable as a PWA.

## What works now

- Birthday list with upcoming-day counts, notes, gift ideas, a portrait, and configurable advance reminders
- Yearly Apple Calendar birthday exports with alerts and notes
- Birthday-card studio with three paper treatments, optional portrait, and native Share Sheet/download output
- Concert-only archive with date, venue, city, companions, openers/side artists, notes, and multiple photos
- Apple Calendar concert exports with the full event context and an alert
- A location-aware golden-hour desk with sunrise, morning gold, evening gold, sunset, and a live countdown
- Airport-to-airport focus flights across 109 airports, with a route-estimated countdown, moving map, pause/resume, takeoff and arrival notes, and a persistent flight log
- Live YVR, KHN, YYZ, SIN, HEL, LHR, YEG, MYY, and ICN clocks in the desktop side rail
- Ordered repeatable lists with completion, reset, add, and remove actions
- One live point-in-time counter that automatically switches between “until” and “since”
- Plain notes with local autosave
- Three focused daily trackers
- Offline caching and installable PWA metadata
- Local persistence plus live state propagation across browser tabs
- Four locally persisted colour themes
- An optional Supabase connector for Apple/email sign-in, realtime structured-data sync, private photo storage, and reconnect upload
- Responsive iPhone and desktop layouts
- An empty first-run state with no sample people, events, messages, notes, lists, or tracker data

Structured records are written immediately to `localStorage`; photos are stored as blobs in IndexedDB; and the PWA shell is cached by its service worker. This keeps the installed app usable without a connection. When Supabase is configured and the same account is used on each device, the app mirrors the structured document to Postgres, mirrors photos to a private Storage bucket, listens for realtime changes, and retries local changes after reconnection. See [docs/SYNC_SETUP.md](docs/SYNC_SETUP.md) for the exact setup and current conflict policy.

Focus-flight time is estimated on-device from the direct great-circle distance, a nominal cruise speed, and airport overhead. It is a study-session estimate, not live airline schedule data.

## Apple notes

The current PWA can create Calendar imports and share birthday cards through the iOS Share Sheet. Direct Apple Reminders, Contacts, widgets, and background integrations require a native iOS wrapper with explicit Apple permissions; see the product plan for that boundary.

## Product plan

See [docs/PRODUCT_PLAN.md](docs/PRODUCT_PLAN.md) for the product path, [docs/SYNC_SETUP.md](docs/SYNC_SETUP.md) for cross-device configuration, and [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for Vercel and later native iOS release steps.

## Commands

```bash
npm run dev
npm run lint
npm run build
npm run preview
```

## Visual asset

The homepage editorial photograph is stored locally at `public/headphones-field.jpg`; the supplied source is never fetched from a third-party host.
