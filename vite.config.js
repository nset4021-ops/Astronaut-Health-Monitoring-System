import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
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
