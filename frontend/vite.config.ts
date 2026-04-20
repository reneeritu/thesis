import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    /* three.module alone is ~700kB minified; warning is informational */
    chunkSizeWarningLimit: 900,
  },
  server: {
    port: 5173,
    /**
     * If 5173 is taken, Vite picks the next free port (e.g. 5174).
     * Always use the exact `Local: http://localhost:…` URL printed in the terminal.
     */
    strictPort: false,
    proxy: {
      '/auth': 'http://localhost:3000',
      '/nodes': 'http://localhost:3000',
      '/spaces': 'http://localhost:3000',
      '/projects': 'http://localhost:3000',
      '/traces': 'http://localhost:3000',
      '/vetos': 'http://localhost:3000',
      '/pivots': 'http://localhost:3000',
      '/references': 'http://localhost:3000',
      '/credits': 'http://localhost:3000',
      '/nfts': 'http://localhost:3000',
      '/forks': 'http://localhost:3000',
      '/archives': 'http://localhost:3000',
      '/mediations': 'http://localhost:3000',
      '/flags': 'http://localhost:3000',
      '/governance': 'http://localhost:3000',
      '/notifications': 'http://localhost:3000',
    },
  },
})
