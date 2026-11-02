import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
// Library groups kept in their own bundle file. Matched against the module id,
// so each entry is a directory name under node_modules.
const vendorGroups: Array<{ chunk: string; packages: RegExp }> = [
  // React runtime: changes rarely, so the browser can cache it across releases.
  { chunk: 'react', packages: /^(react|react-dom|scheduler)$/ },
  // Charts: recharts (and its own sub-packages such as recharts-scale) plus the
  // d3 modules and helpers it pulls in. They must stay in the same chunk,
  // otherwise Rollup reports a circular dependency between chunks.
  {
    chunk: 'charts',
    packages:
      /^(recharts(-[a-z]+)?|victory-vendor|d3-array|d3-color|d3-ease|d3-format|d3-interpolate|d3-path|d3-scale|d3-shape|d3-time|d3-time-format|d3-timer|internmap|decimal\.js-light|fast-equals|eventemitter3|react-smooth|react-transition-group|dom-helpers|tiny-invariant|lodash)$/,
  },
  // Map rendering.
  { chunk: 'map', packages: /^leaflet$/ },
  // FIT file writer for the workout export.
  { chunk: 'fitsdk', packages: /^@garmin$/ },
  // Icon set: large, and only the used icons survive tree shaking.
  { chunk: 'icons', packages: /^lucide-react$/ },
];

// Returns the top-level package name of a module inside node_modules
// ("@scope" for scoped packages, which is enough to group them).
function packageOf(id: string): string | undefined {
  const parts = id.split('node_modules/');
  const last = parts[parts.length - 1];
  return last.split('/')[0];
}

export default defineConfig({
  // Relative asset paths: required by the Electron build, which loads
  // dist/index.html over file://, and safe for the web and Capacitor builds.
  base: './',
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // One bundle per library group instead of a single large file. The web
        // build is served from Kubernetes ConfigMaps, and a ConfigMap holds at
        // most 1 MiB, so no single file may get close to that limit. Smaller
        // files also let the browser load and cache the page in pieces.
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }
          const pkg = packageOf(id);
          if (!pkg) {
            return undefined;
          }
          const group = vendorGroups.find((entry) => entry.packages.test(pkg));
          return group ? group.chunk : 'vendor';
        },
      },
    },
  },
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
