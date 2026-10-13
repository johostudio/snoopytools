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
      includeAssets: ['favicon.ico', 'field-at-dusk.jpg'],
      manifest: {
        name: "Snoopy's Home",
        short_name: 'Snoopy Home',
        description: "A personal archive for the little things worth keeping.",
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
      },
    }),
  ],
})
