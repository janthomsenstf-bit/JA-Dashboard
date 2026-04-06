import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Proxy leitet /api/claude/* → https://api.anthropic.com/* weiter.
// Dadurch können wir die Anthropic-API direkt aus dem Browser aufrufen
// ohne CORS-Probleme (funktioniert beim lokalen `npm run dev`).
export default defineConfig({
  // Relative Pfade für Electron-Prod-Build (loadFile statt loadURL)
  base: './',
  plugins: [react()],
  server: {
    proxy: {
      '/api/claude': {
        target: 'https://api.anthropic.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/claude/, ''),
      },
    },
  },
})
