import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { writeFileSync } from 'fs'
import { resolve } from 'path'
import { execSync } from 'child_process'

// One build-id per config load. Shared between the version.json plugin and the
// __BUILD_ID__ define so the green pill in the UI and the dist/version.json
// always agree. Tries git short SHA (correlates with commit history) and
// falls back to a base36 timestamp when git isn't available (e.g. some CIs).
const BUILD_ID = (() => {
  try { return execSync('git rev-parse --short=7 HEAD').toString().trim() }
  catch { return Date.now().toString(36) }
})()

function versionJsonPlugin(): Plugin {
  return {
    name: 'version-json',
    closeBundle() {
      const version = { buildHash: BUILD_ID, builtAt: new Date().toISOString() }
      writeFileSync(resolve('dist', 'version.json'), JSON.stringify(version))
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
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
        // Exclude html from precache — every navigation hits the network for a
        // fresh index.html so the asset-hash references in the HTML can never
        // drift out of sync with what the SW has cached. Offline support for
        // navigation is handled by the html-cache runtimeCaching rule below.
        globPatterns: ['**/*.{js,css,ico,png,svg,woff2}'],
        globIgnores: ['**/version.json', '**/*.html'],
        // Disable the auto-generated NavigationRoute that would otherwise try to
        // serve index.html from precache (and fail, since we removed it).
        navigateFallback: undefined,
        runtimeCaching: [
          {
            // Top-level page loads: always try network first; fall back to last-
            // good HTML only when offline. Eliminates the stale-paint state where
            // the cached HTML referenced asset hashes that no longer exist.
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'html-cache',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 5, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
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
