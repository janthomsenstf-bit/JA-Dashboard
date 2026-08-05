import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  base: '/',
  resolve: {
    alias: {
      // Der übernommene Easy-B2B-Bereich behält seine ursprüngliche
      // Ordnerstruktur (lib/, components/). Über diesen Alias bleiben seine
      // Importe unverändert – dort steht durchgehend '@easyb2b/lib/...'.
      '@easyb2b': fileURLToPath(new URL('./src/easyb2b', import.meta.url)),
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'JA-Dashboard',
        short_name: 'JA-Dash',
        description: 'Jahresabschluss-Dashboard – Steuerkanzlei',
        theme_color: '#1e40af',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        orientation: 'portrait-primary',
        icons: [
          {
            src: 'icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        // Cache static assets; API calls pass through to network
        globPatterns: ['**/*.{js,css,html,svg,woff2}'],
        // Haupt-Bundle ist > 2 MiB (xlsx u. a.) – Precache-Limit anheben,
        // damit der Service Worker den App-Chunk weiterhin cacht.
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        // WICHTIG: /api/* NICHT auf index.html umleiten – sonst fängt der
        // Service Worker den OneDrive-OAuth-Popup (/api/onedrive-callback) ab
        // und zeigt die App statt des Microsoft-Logins.
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts', expiration: { maxEntries: 4, maxAgeSeconds: 365 * 24 * 60 * 60 } },
          },
        ],
      },
    }),
  ],
  server: {
    proxy: {
      '/api/claude': {
        target: 'https://api.anthropic.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/claude/, ''),
      },
    },
  },
})
