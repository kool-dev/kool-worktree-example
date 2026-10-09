import { defineConfig } from 'vite';

const origin = new URL(process.env.VITE_PUBLIC_ORIGIN || 'http://demo.localhost:3001');

export default defineConfig({
  server: {
    host: '0.0.0.0',
    port: 3001,
    strictPort: true,
    origin: origin.origin,
    // The app serves HTML at :80 and loads assets from this exact Vite origin.
    cors: { origin: `${origin.protocol}//${origin.hostname}` },
    allowedHosts: [origin.hostname],
    hmr: {
      host: origin.hostname,
      protocol: origin.protocol === 'https:' ? 'wss' : 'ws',
      clientPort: Number(origin.port || (origin.protocol === 'https:' ? 443 : 80)),
    },
  },
});
