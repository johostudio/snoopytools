# Deployment

## Website on Vercel

1. Sign in to Vercel and choose **Add New → Project**.
2. Import `johostudio/snoopytools` from GitHub.
3. Keep the repository root as `./` and use the detected **Vite** preset.
4. Confirm these settings:
   - Install command: `npm install`
   - Build command: `npm run build`
   - Output directory: `dist`
5. Select **Deploy**. Future pushes to `main` will update production; branches and pull requests receive preview deployments.
6. Add a custom domain under **Project → Settings → Domains** if wanted.

The deployed HTTPS origin allows the Golden Hour screen to request browser location after the user taps **Use my location**. No environment variables are required for this local-first build.

The current route map uses OpenStreetMap's public raster tiles with attribution. That is appropriate for development and a small personal install, but it is not a guaranteed production tile service. Before public or high-volume use, configure a production provider such as MapTiler, Mapbox, Stadia Maps, or a self-hosted tile service and follow that provider's terms.

### Install on iPhone now

Open the deployed site in Safari, tap **Share**, then **Add to Home Screen**. This installs the existing PWA without an App Store release. Location still requires explicit permission, and the app's structured data remains on that device/browser until the sync backend in the product plan is built.

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

- [Vercel Git deployments](https://vercel.com/docs/git)
- [Vercel deployment overview](https://vercel.com/docs/deployments/overview)
- [OpenStreetMap tile usage policy](https://operations.osmfoundation.org/policies/tiles/)
- [Capacitor installation](https://capacitorjs.com/docs/getting-started)
- [Capacitor environment setup](https://capacitorjs.com/docs/getting-started/environment-setup)
- [App Store Connect workflow](https://developer.apple.com/help/app-store-connect/get-started/app-store-connect-workflow)
- [Upload an app build](https://developer.apple.com/help/app-store-connect/manage-builds/upload-builds)
- [Submit an app for review](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-app/)
