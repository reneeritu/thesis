import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
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
