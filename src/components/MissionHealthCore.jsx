import { Html, Sparkles } from '@react-three/drei'
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

function healthPalette(healthScore) {
  if (healthScore >= 85) return { color: '#6fffe9', accent: '#a9ffb5', label: 'OPTIMAL' }
  if (healthScore >= 65) return { color: '#ffce6a', accent: '#ffe6a4', label: 'CAUTION' }
  return { color: '#ff6f91', accent: '#ffb0bd', label: 'CRITICAL' }
}

export default function MissionHealthCore({ healthScore = 88, queueLength = 0, alertCount = 0, onSelect }) {
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
    <mesh ref={shell}>
      <icosahedronGeometry args={[1.56, 2]} />
      <meshBasicMaterial color={palette.color} transparent opacity={0.12} wireframe blending={THREE.AdditiveBlending} />
    </mesh>
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[1.82, 0.014, 12, 96]} />
      <meshBasicMaterial color={palette.accent} transparent opacity={0.72} blending={THREE.AdditiveBlending} />
    </mesh>
    <mesh rotation={[0.45, 0.8, 0]}>
      <torusGeometry args={[1.98, 0.008, 10, 96]} />
      <meshBasicMaterial color={palette.color} transparent opacity={0.34} blending={THREE.AdditiveBlending} />
    </mesh>
    <pointLight color={palette.color} intensity={healthScore >= 65 ? 1.8 : 3.4} distance={5} />
    <Sparkles count={healthScore >= 85 ? 36 : 70} scale={[3.7, 3.7, 3.7]} size={healthScore >= 65 ? 1.2 : 2} speed={pulseSpeed * 0.35} color={palette.accent} opacity={0.7} />
    <Html center distanceFactor={7} position={[0, 0, 0.1]} style={{ pointerEvents: 'none' }}>
      <div style={{ color: '#e8fbf8', fontFamily: 'DM Mono, monospace', textAlign: 'center', textShadow: `0 0 18px ${palette.color}`, whiteSpace: 'nowrap' }}>
        <div style={{ color: palette.accent, fontSize: 10, letterSpacing: '0.18em' }}>MISSION HEALTH CORE</div>
        <div style={{ fontSize: 42, letterSpacing: '-0.08em', lineHeight: 1.05 }}>{healthScore}<span style={{ color: palette.color, fontSize: 18 }}>%</span></div>
        <div style={{ color: palette.color, fontSize: 10, letterSpacing: '0.2em' }}>{palette.label} // UNIFIED SCORE</div>
        <div style={{ color: '#7eaaa9', fontSize: 8, letterSpacing: '0.1em', marginTop: 8 }}>{alertCount} ALERTS · {queueLength} QUEUED</div>
      </div>
    </Html>
  </group>
}

export { healthPalette }
