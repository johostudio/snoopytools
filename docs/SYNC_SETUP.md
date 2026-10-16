# Cross-device sync

Snoopy's Home is offline-first. Every edit is kept on the current device immediately. A signed-in device mirrors the archive to the `snoopy-home-sync` Cloudflare Worker and checks for newer changes when it opens, regains focus, reconnects, and every 15 seconds while visible.

## Storage layout

| Data | Offline copy | Cloud copy |
| --- | --- | --- |
| birthdays, concerts, notes, repeat lists, quick todos, trackers, time target, golden-hour settings, theme, current flight, flight history, Last.fm cache, and music picks | browser `localStorage` | versioned JSON object in private R2 storage, with its current pointer in D1 |
| birthday and concert photos | IndexedDB database `snoopytools-media` | private R2 objects, with metadata in D1 |
| accounts and renewable sessions | browser stores only the random session token | password hash and hashed session token in D1 |
| app shell, fonts, map code, and static imagery | service-worker cache | Vercel deployment/CDN |

R2 is used for the full archive rather than putting the JSON in a D1 row. This avoids D1's 2 MB row limit and keeps large notes, histories, and cached music data together. Photos retain their original blobs. The Worker currently accepts an archive up to 25 MB and an individual photo up to 100 MB.

Cloudflare's Standard R2 free tier currently includes 10 GB-month of storage, one million Class A operations, ten million Class B operations, and free egress each month. D1's free tier allows a 500 MB database and 5 GB total across the account. Confirm current limits before materially expanding usage:

- https://developers.cloudflare.com/r2/pricing/
- https://developers.cloudflare.com/d1/platform/limits/

## Existing resources

The production resources are declared in `wrangler.jsonc`:

- Worker: `snoopy-home-sync`
- D1 database: `snoopy-home-db`
- R2 bucket: `snoopy-home-media`

Apply schema changes and deploy with:

```powershell
npm run cloud:migrate
npm run cloud:deploy
```

The Last.fm key is stored only as a Worker secret:

```powershell
npx wrangler secret put LASTFM_API_KEY
```

The frontend uses the public Worker URL through `VITE_SYNC_API_URL`. This URL is not a secret. Passwords and the Last.fm key must never be placed in a `VITE_` variable.

## Moving from Convex

Convex accounts cannot be copied because their original passwords are not available. On the first Cloudflare-backed release:

1. Open the updated app on the device that already contains the complete archive.
2. Open the profile panel and choose **connect + keep me signed in**. The account is created automatically if the email is new.
3. The existing local archive and IndexedDB photos upload automatically.
4. On each other device, install/open the updated app and connect once with the same email and password.
5. Leave the first device open until the panel says the archive is available on other signed-in devices.

No local records are erased during this change. The `snoopytools:data:v1` local key and `snoopytools-media` IndexedDB database are unchanged. If another device contains unique edits that never reached the main device, open that device before clearing any browser/PWA data.

## Authentication

- Passwords are processed by the Worker and stored only as salted PBKDF2 hashes.
- The browser receives a random session token; D1 stores only its SHA-256 hash.
- Sessions use a rolling ten-year expiry that renews whenever the app opens, and are reused after closing, refreshing, or updating the PWA.
- There is intentionally no sign-out control. Clearing the site's storage removes the session from that device.
- The Worker accepts browser requests only from the origins listed in `APP_ORIGINS` in `wrangler.jsonc`.

## Conflict and offline behavior

- Local edits never wait for the network.
- When reconnecting, the newest archive timestamp wins.
- The Worker rejects an older upload rather than overwriting a newer R2 version.
- A rejected upload immediately pulls the newer copy.
- Photos upload only when their referenced IDs change; removed photo references are pruned in bounded batches.
- Simultaneous edits still resolve at the whole-archive level. Field-level merging would be a later enhancement.
