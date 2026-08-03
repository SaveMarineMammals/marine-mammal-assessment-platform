import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const apiProxyTarget = process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:3001';

const apiProxy = {
  target: apiProxyTarget,
  changeOrigin: true,
};

export default defineConfig({
  plugins: [react()],
  appType: 'spa',
  server: {
    // 5173 is reserved for Docker (public web). Use 5175 for local dev alongside compose.
    port: 5175,
    strictPort: true,
    fs: {
      allow: [fileURLToPath(new URL('../..', import.meta.url))],
    },
    proxy: {
      '/v1': apiProxy,
      // OpenAPI/Swagger UI + static assets (API routePrefix /api/docs).
      '/api': apiProxy,
    },
  },
  preview: {
    port: 5175,
    strictPort: true,
    proxy: {
      '/v1': apiProxy,
      '/api': apiProxy,
    },
  },
  build: {
    outDir: 'dist',
  },
});
