# Deployment

## Cloudflare sync service

The Worker, D1 database, and R2 bucket are configured in `wrangler.jsonc`.

```powershell
npm install
npx wrangler login
npm run cloud:migrate
npm run cloud:deploy
```

Add or rotate the private Last.fm API key separately:

```powershell
npx wrangler secret put LASTFM_API_KEY
```

The deployed API URL is:

```text
https://snoopy-home-sync.johnnyho766.workers.dev
```

Test it with:

```powershell
Invoke-RestMethod https://snoopy-home-sync.johnnyho766.workers.dev/health
```

When the public site domain changes, add its exact origin to `APP_ORIGINS` in `wrangler.jsonc` and redeploy the Worker.

## Website on Vercel

The linked Vercel project is `snoopytools`. It uses:

- Framework preset: Vite
- Install command: `npm install`
- Build command: `npm run build`
- Output directory: `dist`
- Public environment variable: `VITE_SYNC_API_URL=https://snoopy-home-sync.johnnyho766.workers.dev`

Push `main` to deploy the PWA:

```powershell
git push origin main
```

The old `CONVEX_DEPLOY_KEY` environment variable is no longer read and can be removed from Vercel after the Cloudflare migration is confirmed on the primary device.

## Install on phones and computers

- iPhone/iPad: open the production URL in Safari, tap **Share**, then **Add to Home Screen**.
- Android: open the production URL in Chrome, open the three-dot menu, then choose **Install app**.
- Windows/macOS: open the production URL in Edge or Chrome and choose **Install app** from the address bar or browser menu.

Sign into the same in-app account on every device. Each installation keeps its own offline copy and syncs when online.

## Native iOS later

Capacitor remains the shortest path to a native iOS shell while preserving this interface. On a Mac with Xcode:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios
npx cap init "Snoopy's Home" com.johostudio.snoopyshome --web-dir dist
npm run build
npx cap add ios
npx cap sync ios
npx cap open ios
```

Native calendar/reminder access requires the relevant iOS permission strings and runtime permission prompts. App Store distribution additionally requires an Apple Developer account and App Store Connect setup.

## References

- https://developers.cloudflare.com/d1/reference/migrations/
- https://developers.cloudflare.com/r2/api/workers/workers-api-reference/
- https://developers.cloudflare.com/workers/wrangler/configuration/
- https://vercel.com/docs/git
- https://capacitorjs.com/docs/getting-started
