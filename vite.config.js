import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import legacy from '@vitejs/plugin-legacy'

// https://vitejs.dev/config/
export default defineConfig({
  base: './', // 改为相对路径，支持双击打开
  build: {
    chunkSizeWarningLimit: 1500, // 调整 chunk 警告阈值，避免终端报错/警告
    rollupOptions: {
      output: {
        manualChunks: {
          echarts: ['echarts', 'vue-echarts'],
          vue: ['vue']
        }
      }
    }
  },
  plugins: [
    vue(),
    legacy({
      targets: ['defaults', 'not IE 11']
    })
  ],
})