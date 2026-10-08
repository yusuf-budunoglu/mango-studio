import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Geliştirmede /api (yapay zekâyla düzenleme) yerelde çalışan Worker'a gider: `npx wrangler dev` (8787).
  server: { proxy: { '/api': 'http://127.0.0.1:8787' } },
})
