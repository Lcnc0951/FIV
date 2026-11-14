import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Én JS-fil + én CSS-fil. MediaPipe-filene (wasm + modell) ligger i public/mediapipe og serveres ved siden av.
export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'es2022',
    assetsInlineLimit: 0,
    cssCodeSplit: false,
    rollupOptions: { output: { inlineDynamicImports: true, entryFileNames: 'app.js', assetFileNames: 'app[extname]' } },
  },
  server: { fs: { allow: ['..'] } },
})
