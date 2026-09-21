import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  publicDir: false,
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    outDir: 'dist-workspace',
    emptyOutDir: true,
    lib: {
      entry: 'packages/chat-workspace/src/index.tsx',
      name: 'VegvisrChatWorkspace',
      formats: ['iife'],
      fileName: () => 'vegvisr-chat-workspace.js',
    },
    rollupOptions: { output: { inlineDynamicImports: true } },
  },
})
