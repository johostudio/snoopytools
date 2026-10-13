# Snoopy's Home

A local-first personal archive for birthdays, concerts, golden hour, focus flights, repeatable lists, one meaningful point in time, plain notes, and deliberately specific trackers. The interface uses scanned-paper texture, tight editorial typography, asymmetric collage, and muted archive colours inspired by the supplied references.

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
- Airport-to-airport focus flights with a duration-controlled countdown, moving route map, pause/resume, a takeoff intention, and a sealed arrival note
- Ordered repeatable lists with completion, reset, add, and remove actions
- One live point-in-time counter that automatically switches between “until” and “since”
- Plain notes with local autosave
- Three focused daily trackers
- Offline caching and installable PWA metadata
- Local persistence plus live state propagation across browser tabs
- Responsive iPhone and desktop layouts

Structured data is intentionally local-only in this first boilerplate, with photos stored as blobs in IndexedDB. Changes propagate between tabs on the same browser, but iPhone-to-desktop cloud sync is not simulated. The next product phase adds accounts, object storage, and an offline mutation queue.

## Apple notes

The current PWA can create Calendar imports and share birthday cards through the iOS Share Sheet. Direct Apple Reminders, Contacts, widgets, and background integrations require a native iOS wrapper with explicit Apple permissions; see the product plan for that boundary.

## Product plan

See [docs/PRODUCT_PLAN.md](docs/PRODUCT_PLAN.md) for the scoped path from this prototype to reliable iPhone ↔ desktop sync. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for Vercel and later native iOS release steps.

## Commands

```bash
npm run dev
npm run lint
npm run build
npm run preview
```

## Visual asset

`public/field-at-dusk.jpg` is an original generated image made for this project. It is not copied from the reference site.
