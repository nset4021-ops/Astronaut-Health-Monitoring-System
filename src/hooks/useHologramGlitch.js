import { useCallback, useEffect, useState } from 'react'

export function useHologramGlitch(duration = 620) {
  const [isGlitching, setIsGlitching] = useState(false)

  const triggerGlitch = useCallback(() => {
    setIsGlitching(true)
  }, [])

  useEffect(() => {
    if (!isGlitching) return undefined
    const timer = window.setTimeout(() => setIsGlitching(false), duration)
    return () => window.clearTimeout(timer)
  }, [duration, isGlitching])

  return { isGlitching, triggerGlitch }
}
