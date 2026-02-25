import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    watch: {
      usePolling: true,
    },
    host: true, // Listen on all addresses, including LAN and public IPs
    strictPort: true,
    port: 5173,
  },
})
