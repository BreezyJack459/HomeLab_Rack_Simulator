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
          if (
            id.indexOf('node_modules/react') !== -1 ||
            id.indexOf('node_modules/react-dom') !== -1 ||
            id.indexOf('node_modules/zustand') !== -1
          ) {
            return 'vendor-core';
          }
        }
      }
    }
  }
});
