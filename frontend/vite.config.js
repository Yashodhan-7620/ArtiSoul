import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    allowedHosts: [
      'careers-timer-illustrations-tooth.trycloudflare.com'
    ],
    // One tunnel/origin for everything: the browser only talks to Vite,
    // which forwards API calls and uploaded files to the Express backend.
    proxy: {
      '/api': { target: 'http://localhost:5000', xfwd: true },
      '/uploads': { target: 'http://localhost:5000', xfwd: true },
    },
  }
})