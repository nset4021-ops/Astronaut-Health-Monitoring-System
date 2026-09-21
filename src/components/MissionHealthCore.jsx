import { Html, RoundedBox } from '@react-three/drei'
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

function healthPalette(healthScore) {
  if (healthScore >= 85) return { color: '#6fffe9', accent: '#a9ffb5', label: 'OPTIMAL' }
  if (healthScore >= 65) return { color: '#ffce6a', accent: '#ffe6a4', label: 'CAUTION' }
  return { color: '#ff6f91', accent: '#ffb0bd', label: 'CRITICAL' }
}

export default function MissionHealthCore({ healthScore = 88, queueLength = 0, alertCount = 0, onSelect, showReadout = true }) {
  const group = useRef()
  const shell = useRef()
  const palette = useMemo(() => healthPalette(healthScore), [healthScore])
  const pulseSpeed = healthScore >= 85 ? 1.2 : healthScore >= 65 ? 2.1 : 3.2
  const pulseScale = healthScore >= 85 ? 1.04 : healthScore >= 65 ? 1.1 : 1.16

  useFrame((state, delta) => {
    if (!group.current || !shell.current) return
    const pulse = 1 + Math.sin(state.clock.elapsedTime * pulseSpeed) * (pulseScale - 1)
    group.current.rotation.y += delta * (0.16 + (100 - healthScore) * 0.002)
    group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, pulse * 0.06, 0.04)
    shell.current.scale.setScalar(pulse)
  })

  return <group ref={group} onClick={(event) => { event.stopPropagation(); onSelect?.('mission-health-core') }}>
    <RoundedBox ref={shell} args={[2.5, 1.05, 0.34]} radius={0.14} smoothness={4} position={[0, 0.15, 0]}>
      <meshStandardMaterial color="#172938" roughness={0.32} metalness={0.78} />
    </RoundedBox>
    <mesh position={[0, 0.18, 0.2]}><boxGeometry args={[2.08, 0.62, 0.03]} /><meshStandardMaterial color="#06131e" roughness={0.18} metalness={0.58} /></mesh>
    <mesh position={[-0.8, 0.18, 0.23]}><boxGeometry args={[0.45, 0.035, 0.02]} /><meshStandardMaterial color={palette.color} emissive={palette.color} emissiveIntensity={0.7} /></mesh>
    <mesh position={[-0.8, 0.06, 0.23]}><boxGeometry args={[0.28, 0.035, 0.02]} /><meshStandardMaterial color={palette.accent} emissive={palette.accent} emissiveIntensity={0.6} /></mesh>
    <mesh position={[0.84, 0.18, 0.23]}><sphereGeometry args={[0.07, 16, 16]} /><meshStandardMaterial color={palette.accent} emissive={palette.accent} emissiveIntensity={0.8} /></mesh>
    <mesh position={[0, -0.48, 0.08]}><boxGeometry args={[2.3, 0.06, 0.08]} /><meshStandardMaterial color={palette.color} roughness={0.28} metalness={0.7} /></mesh>
    <pointLight color={palette.color} intensity={healthScore >= 65 ? 1.2 : 2.2} distance={4} />
    {showReadout && <Html center distanceFactor={7} position={[0, 0, 0.1]} style={{ pointerEvents: 'none' }}>
      <div style={{ color: '#e8fbf8', fontFamily: 'DM Mono, monospace', textAlign: 'center', textShadow: `0 0 18px ${palette.color}`, whiteSpace: 'nowrap' }}>
        <div style={{ color: palette.accent, fontSize: 10, letterSpacing: '0.18em' }}>MISSION HEALTH CORE</div>
        <div style={{ fontSize: 42, letterSpacing: '-0.08em', lineHeight: 1.05 }}>{healthScore}<span style={{ color: palette.color, fontSize: 18 }}>%</span></div>
        <div style={{ color: palette.color, fontSize: 10, letterSpacing: '0.2em' }}>{palette.label} // UNIFIED SCORE</div>
        <div style={{ color: '#7eaaa9', fontSize: 8, letterSpacing: '0.1em', marginTop: 8 }}>{alertCount} ALERTS · {queueLength} QUEUED</div>
      </div>
    </Html>}
  </group>
}

export { healthPalette }
