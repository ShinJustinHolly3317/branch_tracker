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
    // Cursor 隧道 Host 非 localhost；`.cursorvm.com` 後綴允許所有子網域
    allowedHosts: ['.cursorvm.com']
  },
  preview: {
    port: 5173,
    strictPort: true,
    allowedHosts: ['.cursorvm.com']
  }
})

