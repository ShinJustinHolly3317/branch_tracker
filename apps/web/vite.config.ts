import historyApiFallback from 'connect-history-api-fallback'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    // 讓 /branch、/performance 等 client route 在重新整理或直接開 URL 時回 index.html，避免整頁 404
    {
      name: 'spa-history-fallback',
      configureServer(server) {
        return () => {
          server.middlewares.use(
            historyApiFallback({
              disableDotRule: true,
              htmlAcceptHeaders: ['text/html', 'application/xhtml+xml']
            })
          )
        }
      },
      configurePreviewServer(server) {
        return () => {
          server.middlewares.use(
            historyApiFallback({
              disableDotRule: true,
              htmlAcceptHeaders: ['text/html', 'application/xhtml+xml']
            })
          )
        }
      }
    }
  ],
  server: {
    port: 5173,
    strictPort: true,
    // Cursor / 隧道預覽：Host 非 localhost 時 Vite 預設會 403；開發機允許任意 Host
    allowedHosts: true
  },
  preview: {
    port: 5173,
    strictPort: true,
    allowedHosts: true
  }
})

