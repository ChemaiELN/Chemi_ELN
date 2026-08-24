import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      react: path.resolve('./node_modules/react'),
      'react-dom': path.resolve('./node_modules/react-dom'),
    },
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    // ketcher-react and its CJS transitive deps must be pre-bundled as ESM
    include: [
      'ketcher-react',
      'ketcher-standalone',
      'lodash',
      '@babel/runtime/regenerator',
      '@ant-design/icons',
    ],
  },
  server: {
    port: 5173,
    host: true,
  },
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('ketcher-react') || id.includes('ketcher-core') || id.includes('ketcher-standalone') || id.includes('indigo-ketcher')) {
            return 'ketcher-vendor'
          }
          if (id.includes('node_modules/antd') || id.includes('node_modules/@ant-design')) {
            return 'antd-vendor'
          }
          if (id.includes('node_modules/lucide-react')) {
            return 'lucide-vendor'
          }
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router-dom')) {
            return 'react-vendor'
          }
        },
      },
    },
  },
})
