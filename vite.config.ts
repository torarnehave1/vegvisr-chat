import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { writeFileSync } from 'fs'
import { resolve } from 'path'

/** Writes version.json with a unique build hash into dist/ after each build */
function versionJsonPlugin(): Plugin {
  return {
    name: 'version-json',
    closeBundle() {
      const version = { buildHash: Date.now().toString(36), builtAt: new Date().toISOString() }
      writeFileSync(resolve('dist', 'version.json'), JSON.stringify(version))
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    versionJsonPlugin(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        id: 'vegvisr-chat',
        name: 'Vegvisr Chat',
        short_name: 'Vegvisr Chat',
        description: 'Open words. Clear intentions. Communication without walls.',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'https://favicons.vegvisr.org/favicons/1773237743072-1-1773237750881-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'https://favicons.vegvisr.org/favicons/1773237743072-1-1773237750881-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallbackDenylist: [/^\/version\.json$/],
        globIgnores: ['**/version.json'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/favicons\.vegvisr\.org\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'favicon-cache', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 30 } },
          },
          {
            urlPattern: /^https:\/\/group-chat-worker\.torarnehave\.workers\.dev\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'api-cache', expiration: { maxEntries: 50, maxAgeSeconds: 60 * 5 } },
          },
        ],
      },
    }),
  ],
})
