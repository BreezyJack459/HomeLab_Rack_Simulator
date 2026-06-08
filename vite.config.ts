import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/HomeLab_Rack_Simulator/',
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173
  },
  build: {
    chunkSizeWarningLimit: 400,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.indexOf('node_modules/three') !== -1 || id.indexOf('node_modules/@react-three') !== -1) {
            return 'vendor-three';
          }
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
