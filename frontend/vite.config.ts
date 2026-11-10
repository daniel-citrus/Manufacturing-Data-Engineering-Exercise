import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // An explicit IPv4 host lets Vite see a port another app holds on 127.0.0.1 and move to
    // the next one. With "localhost" it can share the port over IPv6 instead.
    host: '127.0.0.1',
    // Forward API calls to the FastAPI dev server so the browser sees one origin.
    proxy: {
      '/api': `http://127.0.0.1:${process.env.API_PORT ?? 8000}`,
    },
  },
})
