import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In dev, /api (including the SSE stream) is proxied to FastAPI on :8000, so everything is same-origin.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
})
