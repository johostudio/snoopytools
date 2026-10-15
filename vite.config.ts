import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['favicon.ico', 'pwa-192x192.png', 'pwa-512x512.png', 'headphones-field.jpg'],
      manifest: {
        id: '/',
        name: "Snoopy's Home",
        short_name: 'Snoopy Home',
        description: 'Local personal tools.',
        lang: 'en-CA',
        theme_color: '#171717',
        background_color: '#171717',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        scope: '/',
        categories: ['productivity', 'lifestyle', 'music'],
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,ico,svg,png,jpg,woff,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/[a-c]\.tile\.openstreetmap\.org\//i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'snoopy-map-tiles',
              cacheableResponse: { statuses: [0, 200] },
              expiration: {
                maxEntries: 300,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
          {
            urlPattern: /^https:\/\/(lastfm\.freetls\.fastly\.net|lastfm-img2\.akamaized\.net)\//i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'snoopy-lastfm-artwork',
              cacheableResponse: { statuses: [0, 200] },
              expiration: {
                maxEntries: 250,
                maxAgeSeconds: 60 * 60 * 24 * 90,
              },
            },
          },
        ],
      },
    }),
  ],
})
