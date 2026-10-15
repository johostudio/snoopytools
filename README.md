# Snoopy's Home

A private, offline-first archive for birthdays, concerts, quick todos, repeat lists, notes, focused flights, listening history, and specific trackers.

The web app is hosted on Vercel. Cross-device sync runs through a Cloudflare Worker:

- D1 stores accounts, long-lived sessions, and object metadata.
- R2 stores the complete archive and original birthday/concert photos.
- `localStorage` and IndexedDB keep the app usable offline on every installed device.

## Development

Install dependencies and start the frontend:

```powershell
npm install
npm run dev
```

To run the Worker locally in another terminal:

```powershell
npx wrangler d1 migrations apply DB --local
npm run dev:worker
```

Set `VITE_SYNC_API_URL` in `.env.local` to the local or deployed Worker URL. See [docs/SYNC_SETUP.md](docs/SYNC_SETUP.md) for the storage and migration details.

## Deploy

```powershell
npm run cloud:migrate
npm run cloud:deploy
git push origin main
```

Vercel builds the PWA from `main`. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for the full checklist.
