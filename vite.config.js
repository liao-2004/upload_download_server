import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      // 把 /api 请求转发到 Express 后端
      '/api': {
        // 本机开发时转发到本地后端（线上部署走 Nginx，不受此影响）
        target: 'http://localhost:3008',
        changeOrigin: true,
      },
    },
  },
})
