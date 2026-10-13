import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.ico', 'headphones-field.jpg'],
      manifest: {
        name: "Snoopy's Home",
        short_name: 'Snoopy Home',
        description: 'Local personal tools.',
        theme_color: '#171717',
        background_color: '#171717',
        display: 'standalone',
        orientation: 'any',
        start_url: '/',
        icons: [
          {
            src: '/favicon.ico',
            sizes: 'any',
            type: 'image/x-icon',
            purpose: 'any',
          },
        ],
      },
      workbox: {
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
