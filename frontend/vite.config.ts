import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // Force Vite's esbuild to pre-bundle both ketcher packages.
    // This converts every @babel/runtime/helpers/* and lodash/* CJS sub-path
    // they import into a proper ESM chunk — no more "does not provide an export
    // named 'default'" errors.  The WASM is loaded inside a Web Worker at
    // runtime so pre-bundling the JS entry points is safe.
    include: ['ketcher-react', 'ketcher-standalone', 'lodash'],
  },
  define: {
    'process.env': {},
    'process.env.NODE_ENV': JSON.stringify('development'),
    global: 'globalThis',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  css: {
    preprocessorOptions: {
      less: {
        javascriptEnabled: true,
        modifyVars: {
          '@primary-color': '#0F766E',
        },
      },
    },
    modules: {
      localsConvention: 'camelCase',
    },
  },
})
