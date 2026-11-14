import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev proxy: /api and /health are forwarded to the FastAPI backend.
// In production, serve the built assets behind the same origin as the API,
// or set VITE_API_BASE_URL and use it in src/lib/api.ts.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
});
