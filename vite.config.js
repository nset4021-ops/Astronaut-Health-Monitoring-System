import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const isStreamlit = mode === 'streamlit'

  return {
  base: isStreamlit ? './' : process.env.GITHUB_ACTIONS ? '/Astronaut-Health-Monitoring-System/' : '/',
  plugins: [react()],
  optimizeDeps: {
    entries: ['index.html'],
    force: true,
  },
  build: {
    cssCodeSplit: !isStreamlit,
    // The lazy pose-engine vendor payloads contain indivisible third-party WASM/ML code.
    chunkSizeWarningLimit: 1100,
    rollupOptions: {
      output: {
        inlineDynamicImports: isStreamlit,
        manualChunks: isStreamlit ? undefined : {
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
  }
})
