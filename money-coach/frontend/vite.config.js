import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/** Vite configuration for local development and the sandbox preview. */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    allowedHosts: ['.manus.computer'],
    proxy: { '/api': 'http://127.0.0.1:5001' }
  }
})
