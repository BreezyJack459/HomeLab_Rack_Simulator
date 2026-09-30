import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/HomeLab_Rack_Simulator/',
  plugins: [react()],
  server: {
    // Bind every local interface so phones and other devices on the same LAN
    // can use the development server. Vite still validates host headers.
    host: '0.0.0.0',
    port: 5173,
    strictPort: true
  },
  build: {
    chunkSizeWarningLimit: 400,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Match package boundaries: react-reconciler and other viewer-only
          // React helpers must stay with the lazy 3D chunks, not startup.
          if (/\/node_modules\/(react|react-dom|zustand)\//.test(id)) {
            return 'vendor-core';
          }
        }
      }
    }
  }
});
