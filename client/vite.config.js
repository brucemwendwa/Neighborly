import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Anything the client requests at /api is forwarded to the Express server.
    // This keeps the browser on a single origin, so there are no CORS
    // surprises in development and no absolute URLs hardcoded in React.
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})
