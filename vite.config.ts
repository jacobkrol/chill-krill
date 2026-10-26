import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',  // Automatically update Service Worker
      includeAssets: ['chill-schooler.png', 'robots.txt', 'apple-touch-icon.png'],  // Files to cache
      manifest: {
        id: '/chill-krill', // defaults to "start_url"
        name: 'Chill Krill',  // Full app name
        short_name: 'Chill Krill',  // Short name displayed on home screen
        description: 'General knowledge trivia at your pace',
        theme_color: '#4de3ff',  // Color of the top bar
        background_color: '#1E293C',  // Splash screen background color
        display: 'standalone',  // Makes it look like a native app (hides browser UI)
        start_url: '/chill-krill',
        scope: '/chill-krill',
        icons: [
          {
            src: 'pwa-192x192.png',  // Small icon
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',  // Large icon
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'  // Works in various environments
          }
        ]
      }
    })
  ],
  base: '/chill-krill/',
  server: {
    port: 3000
  }
})
