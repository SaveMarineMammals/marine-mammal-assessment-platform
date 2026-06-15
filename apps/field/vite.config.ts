import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:3001';

const apiProxy = {
  target: apiProxyTarget,
  changeOrigin: true,
};

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'MMAP Field',
        short_name: 'MMAP Field',
        description: 'Offline-first manatee assessment capture for field biologists',
        theme_color: '#0b1f2a',
        background_color: '#0b1f2a',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
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
        globPatterns: ['**/*.{js,css,html,ico,svg,woff2}'],
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
      devOptions: {
        // Avoid registering dev-sw.js on localhost — it can hijack Docker ports after dev stops.
        enabled: false,
      },
    }),
  ],
  server: {
    port: 5174,
    strictPort: true,
    fs: {
      allow: [fileURLToPath(new URL('../..', import.meta.url))],
    },
    proxy: {
      '/v1': apiProxy,
    },
  },
  preview: {
    port: 5174,
    strictPort: true,
    proxy: {
      '/v1': apiProxy,
    },
  },
});
