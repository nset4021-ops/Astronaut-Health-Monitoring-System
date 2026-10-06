import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // The lazy pose-engine vendor payloads contain indivisible third-party WASM/ML code.
    chunkSizeWarningLimit: 1100,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          fiber: ['@react-three/fiber'],
          drei: ['@react-three/drei'],
          tfjs: ['@tensorflow/tfjs'],
          tfjsBackend: ['@tensorflow/tfjs-backend-webgl'],
          poseDetection: ['@tensorflow-models/pose-detection'],
          icons: ['lucide-react'],
        },
      },
    },
  },
})
