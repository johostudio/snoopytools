# Product plan

## Product rule

Snoopy's Home should feel smaller than the sum of its features. It is not a general-purpose productivity suite. Every tool earns its place by reducing repeated cognitive load.

## V1 surface

1. **Birthday archive** — upcoming birthdays, advance alerts, personal notes, gift ideas, a portrait, and shareable birthday-card artwork.
2. **Concert archive** — concert-only memories with venue, city, companions, openers and side artists, notes, and multiple photos.
3. **Golden hour** — location-aware sunrise, golden-hour windows, sunset, and a countdown to the next light event.
4. **Focus flight** — a study timer framed as an airport journey, with a moving route map, takeoff intention, and a private note revealed on arrival. The selected route's estimated flight time is the countdown duration.
5. **Repeat lists** — ordered checklists designed to complete and reset, with optional reset schedules.
6. **Point in time** — one primary event that counts up or down with minute/second precision.
7. **Notes** — fast plain-text capture, not a document database.
8. **Specific trackers** — user-defined increments, units, targets, and reset cadence.

The current app implements the core interactions locally and includes a deployed Convex development schema, private per-account photo records, reactive sync, and email/password authentication. Production deployment configuration and Apple OAuth credentials are the remaining account-infrastructure steps.

## Apple integration

The web app uses the parts of Apple's ecosystem that a PWA can access reliably today:

- Birthday exports create yearly `.ics` events with the selected alert and attached notes.
- Concert exports create dated `.ics` events with location, companions, supporting artists, notes, and a one-day alert.
- Birthday cards render as PNG files and open the iOS Share Sheet where supported, with a download fallback.
- A Home Screen PWA can receive Web Push notifications after a notification service and user opt-in flow are added.

Direct writes to Apple Reminders, native contacts, widgets, and background photo sync require a native iOS shell with EventKit/Contacts/WidgetKit permissions. That is a later native bridge, not simulated in this PWA.

## Sync architecture

Treat the server as a mirror rather than a live hard dependency.

- **Client store:** structured records in `localStorage`, photo blobs in IndexedDB, and the installable shell in the service-worker cache.
- **Authentication:** a Cloudflare Worker handles one-step account creation/sign-in and renewable per-device sessions.
- **Server:** one private JSON document per user in R2, with account, session, and object metadata in D1.
- **Transport:** debounced document uploads, reconnect retry, photo upload/download, and periodic/focus refreshes.
- **Conflict policy:** document-level last-write-wins based on the app update timestamp. Field-level merge is the next hardening step for truly simultaneous multi-device editing.
- **Presence:** a small status surface only—offline, syncing, synced, or needs attention.
- **Recovery:** soft deletes, 30-day restore window, and export/import as JSON.

This gives instant local writes on iPhone and desktop while making network interruptions boring rather than destructive.

## Delivery phases

### Phase 1 — foundation (current)

- Responsive React/TypeScript PWA
- Real local interactions and persistence
- Birthday and concert archives with local photo attachments
- Apple Calendar exports and birthday-card sharing
- Golden-hour calculations with opt-in browser geolocation
- Route-estimated focus flights with a real airport route map and sealed arrival message
- Persistent flight history and an expanded global airport catalog
- Local themes and sync-state UI
- Reference-matched visual system
- Install/offline shell

### Phase 2 — accounts and sync

- Maintain the production Cloudflare Worker, D1 database, and R2 media bucket connected to Vercel
- Configure Apple sign-in credentials and production redirect URLs when an Apple Developer account is available
- Add field-level conflict merging and tombstones for simultaneous edits
- Add photo resizing and resumable uploads for large originals
- Multi-device and conflict tests

### Phase 3 — iPhone depth

- Home-screen install onboarding
- Web Push reminders where supported
- Lock-screen-friendly notification actions
- EventKit/Contacts integration through a lightweight native wrapper if direct Apple Reminders or contact birthdays become essential
- A production map-tile provider and offline map fallback before significant public traffic

### Phase 4 — refinement

- User-created tracker templates
- Scheduled list resets
- Widget strategy (native wrapper if the product proves it needs iOS widgets)
- Encrypted exports and account deletion

## Non-goals for the first release

- Team collaboration
- Rich-text documents
- Nested projects and tags
- Habit streak gamification
- Social features
- Large analytics dashboards
