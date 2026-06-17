// vite.config.js — Configuration for Vite (our frontend build tool)
// The most important part here is the "proxy" section
// Without it, our React app (port 5173) can't talk to our backend (port 3001)
// The proxy automatically forwards any /api request to the backend

import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Uses VITE_BACKEND_PORT from your env (defaults to 3001) so the proxy stays in sync
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendPort = env.VITE_BACKEND_PORT || '3001'

  return {
    plugins: [react()],
    server: {
      proxy: {
        // Any request starting with /api will be forwarded to our backend
        '/api': {
          target: `http://localhost:${backendPort}`,
          changeOrigin: true
        }
      }
    }
  }
})
