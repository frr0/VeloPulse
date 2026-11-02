import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  // Relative asset paths: required by the Electron build, which loads
  // dist/index.html over file://, and safe for the web and Capacitor builds.
  base: './',
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      '/api': {
        target: 'https://intervals.icu',
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
