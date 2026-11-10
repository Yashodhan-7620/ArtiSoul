
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  server: {
    host: '0.0.0.0',

    allowedHosts: [
      '.trycloudflare.com'
    ],

    // Forward requests through the same Cloudflare HTTPS origin
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        xfwd: true,
      },

      '/uploads': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        xfwd: true,
      },

      '/health': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        xfwd: true,
      },
    },
  },
})
