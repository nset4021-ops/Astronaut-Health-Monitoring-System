import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    // Three.js is intentionally isolated as a vendor chunk; its minified runtime
    // is larger than Vite's default warning threshold even when code-split.
    chunkSizeWarningLimit: 750,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          motion: ['framer-motion'],
          three: ['three'],
          'react-three': ['@react-three/fiber', '@react-three/drei'],
          tensorflow: ['@tensorflow/tfjs', '@tensorflow/tfjs-backend-webgl'],
          'pose-detection': ['@tensorflow-models/pose-detection'],
          mediapipe: ['@mediapipe/tasks-vision'],
          icons: ['lucide-react'],
        },
      },
    },
  },
})
