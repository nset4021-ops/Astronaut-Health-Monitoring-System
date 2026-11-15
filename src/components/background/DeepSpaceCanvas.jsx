import { useEffect, useRef } from 'react'

const NODE_COUNT = 34

function createNodes(width, height) {
  return Array.from({ length: NODE_COUNT }, (_, index) => ({
    x: (index * 97) % Math.max(width, 1),
    y: (index * 53) % Math.max(height, 1),
    radius: 0.6 + (index % 4) * 0.45,
    drift: 0.08 + (index % 5) * 0.025,
    phase: index * 0.7,
    tone: index % 5 === 0 ? 'amber' : 'cyan',
  }))
}

export default function DeepSpaceCanvas() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const context = canvas.getContext('2d', { alpha: true })
    if (!context) return undefined
    let frameId = 0
    let lastFrame = 0
    let width = 0
    let height = 0
    let nodes = []

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5)
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = Math.floor(width * ratio)
      canvas.height = Math.floor(height * ratio)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      nodes = createNodes(width, height)
    }

    const render = (time) => {
      if (time - lastFrame < 33) {
        frameId = window.requestAnimationFrame(render)
        return
      }
      lastFrame = time
      context.clearRect(0, 0, width, height)
      const gradient = context.createRadialGradient(width * 0.48, height * 0.22, 0, width * 0.48, height * 0.22, Math.max(width, height) * 0.8)
      gradient.addColorStop(0, 'rgba(8, 47, 73, .34)')
      gradient.addColorStop(0.52, 'rgba(2, 6, 23, .12)')
      gradient.addColorStop(1, 'rgba(2, 6, 23, .72)')
      context.fillStyle = gradient
      context.fillRect(0, 0, width, height)

      nodes.forEach((node) => {
        const x = node.x + Math.sin(time * 0.0001 * node.drift + node.phase) * 12
        const y = node.y + Math.cos(time * 0.00008 * node.drift + node.phase) * 10
        const color = node.tone === 'amber' ? '255, 190, 92' : '103, 232, 249'
        const glow = context.createRadialGradient(x, y, 0, x, y, node.radius * 12)
        glow.addColorStop(0, `rgba(${color}, .3)`)
        glow.addColorStop(1, `rgba(${color}, 0)`)
        context.fillStyle = glow
        context.beginPath()
        context.arc(x, y, node.radius * 12, 0, Math.PI * 2)
        context.fill()
        context.fillStyle = `rgba(${color}, .62)`
        context.beginPath()
        context.arc(x, y, node.radius, 0, Math.PI * 2)
        context.fill()
      })
      frameId = window.requestAnimationFrame(render)
    }

    const recoverContext = () => {
      window.cancelAnimationFrame(frameId)
      resize()
      frameId = window.requestAnimationFrame(render)
    }

    resize()
    frameId = window.requestAnimationFrame(render)
    window.addEventListener('resize', resize, { passive: true })
    canvas.addEventListener('webglcontextlost', recoverContext)
    canvas.addEventListener('webglcontextrestored', recoverContext)
    return () => {
      window.cancelAnimationFrame(frameId)
      window.removeEventListener('resize', resize)
      canvas.removeEventListener('webglcontextlost', recoverContext)
      canvas.removeEventListener('webglcontextrestored', recoverContext)
    }
  }, [])

  return <canvas ref={canvasRef} className="deep-space-canvas" aria-hidden="true" />
}
