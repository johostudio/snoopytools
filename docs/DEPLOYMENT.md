# Deployment

## Website on Vercel

1. Sign in to Vercel and choose **Add New → Project**.
2. Import `johostudio/snoopytools` from GitHub.
3. Keep the repository root as `./` and use the detected **Vite** preset.
4. Confirm these settings:
   - Install command: `npm install`
   - Build command: `npx convex deploy --cmd "npm run build" --cmd-url-env-var-name VITE_CONVEX_URL`
   - Output directory: `dist`
5. In the Convex dashboard, open the project's production deployment settings and generate a production deploy key with `deployment:deploy` permission.
6. In Vercel, add the key as `CONVEX_DEPLOY_KEY` for the Production environment only. Treat this value as a secret.
7. From this repository, initialize authentication on the production deployment using the final Vercel or custom domain:

   ```powershell
   npx @convex-dev/auth --prod --web-server-url https://YOUR-SITE.vercel.app
   ```

8. Select **Deploy**. Future pushes to `main` will update both the Convex backend and Vercel frontend.
9. Add a custom domain under **Project → Settings → Domains** if wanted. If the public origin changes, rerun the production auth command with that origin and redeploy.

The Convex deploy command supplies `VITE_CONVEX_URL` to the Vite build. The deployed HTTPS origin also allows the Golden Hour screen to request browser location after the user taps **Use my location**.

The current route map uses OpenStreetMap's public raster tiles with attribution. That is appropriate for development and a small personal install, but it is not a guaranteed production tile service. Before public or high-volume use, configure a production provider such as MapTiler, Mapbox, Stadia Maps, or a self-hosted tile service and follow that provider's terms.

### Install on iPhone now

Open the deployed site in Safari, tap **Share**, then **Add to Home Screen**. This installs the existing PWA without an App Store release. Location still requires explicit permission. Sign into the same in-app account on each device to restore and synchronize the private archive.

## Native iOS later

Capacitor is the shortest path from this Vite app to an iOS shell while preserving the same interface.

On a Mac with a supported Xcode installation:

```bash
npm install @capacitor/core @capacitor/cli @capacitor/ios
npx cap init "Snoopy's Home" com.johostudio.snoopyshome --web-dir dist
npm run build
npx cap add ios
npx cap sync ios
npx cap open ios
```

Then:

1. In Xcode, select an Apple Developer team and keep `com.johostudio.snoopyshome` as the unique bundle identifier, or replace it everywhere before the first release.
2. Create a 1024 × 1024 PNG master from the supplied Snoopy artwork and fill Xcode's `AppIcon` asset set. The `.ico` in this repository is already used for the website/PWA, but App Store assets must use Apple's native icon formats.
3. Add `NSLocationWhenInUseUsageDescription` to the iOS app's `Info.plist` so Golden Hour can explain why it requests location.
4. Add native notification/EventKit integrations only when birthday reminders need direct Apple Calendar or notification access. Those permissions must be requested at the moment the feature needs them.
5. Test on a physical iPhone, then create an Archive in Xcode and upload the build to App Store Connect.
6. Create the App Store record, complete privacy and age-rating details, upload screenshots, distribute through TestFlight, and submit the selected build for App Review.

After future web-code changes, refresh the native project with:

```bash
npm run build
npx cap sync ios
```

Native iOS building and App Store submission require macOS, Xcode, and Apple Developer Program access. Keep the web/PWA release as the fastest cross-device delivery path while native Apple integrations are developed.

## Official references

- [Convex on Vercel](https://docs.convex.dev/production/hosting/vercel)
- [Convex Auth production setup](https://labs.convex.dev/auth/production)
- [Vercel Git deployments](https://vercel.com/docs/git)
- [OpenStreetMap tile usage policy](https://operations.osmfoundation.org/policies/tiles/)
- [Capacitor installation](https://capacitorjs.com/docs/getting-started)
- [App Store Connect workflow](https://developer.apple.com/help/app-store-connect/get-started/app-store-connect-workflow)
