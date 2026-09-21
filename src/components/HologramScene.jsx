import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, Html, OrbitControls, RoundedBox, Text } from '@react-three/drei'
import { useRef, useState } from 'react'
import * as THREE from 'three'
import DashboardLayout from './DashboardLayout'

const INSTRUMENT_MATERIALS = {
  shell: { color: '#172938', roughness: 0.34, metalness: 0.72 },
  edge: { color: '#304b5b', roughness: 0.22, metalness: 0.82 },
  dark: { color: '#06131e', roughness: 0.2, metalness: 0.55 },
  cyan: { color: '#67e8e0', roughness: 0.28, metalness: 0.62 },
  amber: { color: '#ffbd5c', roughness: 0.3, metalness: 0.55 },
  red: { color: '#ec6d68', roughness: 0.28, metalness: 0.5 },
}

function Material({ type = 'shell', emissive = false }) {
  const material = INSTRUMENT_MATERIALS[type]
  return <meshStandardMaterial {...material} emissive={emissive ? material.color : '#000000'} emissiveIntensity={emissive ? 0.65 : 0} />
}

function InstrumentMount({ position, children, label, selected, onSelect }) {
  const group = useRef()
  const [dragging, setDragging] = useState(false)
  const lastX = useRef(0)
  const lastY = useRef(0)
  const { gl } = useThree()

  useFrame((_, delta) => {
    if (!group.current || dragging) return
    group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, selected ? 0.04 : 0, delta * 2.8)
    group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, selected ? -0.025 : 0, delta * 2.8)
  })

  const startDrag = (event) => {
    event.stopPropagation()
    setDragging(true)
    lastX.current = event.clientX
    lastY.current = event.clientY
    gl.domElement.setPointerCapture(event.pointerId)
    onSelect(label)
  }
  const drag = (event) => {
    if (!dragging || !group.current) return
    group.current.rotation.y += (event.clientX - lastX.current) * 0.012
    group.current.rotation.x += (event.clientY - lastY.current) * 0.008
    lastX.current = event.clientX
    lastY.current = event.clientY
  }
  const stopDrag = (event) => {
    setDragging(false)
    if (gl.domElement.hasPointerCapture(event.pointerId)) gl.domElement.releasePointerCapture(event.pointerId)
  }

  return <group ref={group} position={position} onPointerDown={startDrag} onPointerMove={drag} onPointerUp={stopDrag} onClick={(event) => { event.stopPropagation(); onSelect(label) }}>
    {children}
  </group>
}

function PulseOximeter({ selected, onSelect }) {
  return <InstrumentMount position={[-2.35, 1.2, 0.15]} label="cardio" selected={selected} onSelect={onSelect}>
    <RoundedBox args={[1.72, 0.92, 0.38]} radius={0.12} smoothness={4}><Material /></RoundedBox>
    <RoundedBox args={[1.5, 0.7, 0.08]} radius={0.08} smoothness={3} position={[0, 0, 0.23]}><Material type="edge" /></RoundedBox>
    <mesh position={[0, 0.04, 0.29]}><boxGeometry args={[0.9, 0.36, 0.018]} /><Material type="dark" /></mesh>
    <Text position={[-0.38, 0.13, 0.31]} fontSize={0.12} color="#a9ffb5" anchorX="left">SpO2</Text>
    <Text position={[-0.38, -0.05, 0.31]} fontSize={0.18} color="#e9fffb" anchorX="left">97%</Text>
    <Text position={[0.2, -0.05, 0.31]} fontSize={0.13} color="#67e8e0" anchorX="left">78</Text>
    <mesh position={[0.64, 0.17, 0.3]}><sphereGeometry args={[0.045, 16, 16]} /><Material type="cyan" emissive /></mesh>
    <Text position={[-0.78, -0.67, 0]} fontSize={0.11} color="#67e8e0" anchorX="left">CARDIO / PULSE OX</Text>
    <Text position={[-0.78, -0.84, 0]} fontSize={0.08} color="#7898a2" anchorX="left">PRESS TO ROTATE</Text>
  </InstrumentMount>
}

function Dosimeter({ selected, onSelect }) {
  return <InstrumentMount position={[2.2, 1.12, 0.12]} label="radiation" selected={selected} onSelect={onSelect}>
    <RoundedBox args={[1.35, 1.05, 0.42]} radius={0.14} smoothness={4}><Material /></RoundedBox>
    <mesh position={[0, 0.18, 0.27]}><boxGeometry args={[0.88, 0.32, 0.02]} /><Material type="dark" /></mesh>
    <Text position={[-0.34, 0.2, 0.3]} fontSize={0.12} color="#ffbd5c" anchorX="left">0.42</Text>
    <Text position={[0.18, 0.2, 0.3]} fontSize={0.08} color="#7898a2" anchorX="left">mSv</Text>
    <mesh position={[0, -0.2, 0.27]}><boxGeometry args={[0.88, 0.04, 0.02]} /><Material type="amber" emissive /></mesh>
    <mesh position={[-0.47, -0.26, 0.27]}><boxGeometry args={[0.05, 0.16, 0.02]} /><Material type="red" emissive /></mesh>
    <mesh position={[0.45, 0.02, 0.1]} rotation={[0, Math.PI / 2, 0]}><boxGeometry args={[0.24, 0.42, 0.06]} /><Material type="dark" /></mesh>
    <Text position={[-0.62, -0.72, 0]} fontSize={0.11} color="#ffbd5c" anchorX="left">RADIATION / DOSIMETER</Text>
    <Text position={[-0.62, -0.89, 0]} fontSize={0.08} color="#7898a2" anchorX="left">CUMULATIVE 24H DOSE</Text>
  </InstrumentMount>
}

function MobilityBezel({ onOpen }) {
  return <group position={[0, -2.18, 0.2]} onClick={(event) => { event.stopPropagation(); onOpen() }}>
    <RoundedBox args={[3.25, 0.78, 0.3]} radius={0.1} smoothness={4}><Material /></RoundedBox>
    <RoundedBox args={[2.72, 0.5, 0.08]} radius={0.06} smoothness={3} position={[0, 0, 0.2]}><Material type="dark" /></RoundedBox>
    <mesh position={[-1.08, 0, 0.26]}><boxGeometry args={[0.78, 0.25, 0.02]} /><Material type="cyan" emissive /></mesh>
    <mesh position={[-0.13, 0, 0.26]}><boxGeometry args={[0.78, 0.25, 0.02]} /><Material type="amber" emissive /></mesh>
    <mesh position={[0.82, 0, 0.26]}><boxGeometry args={[0.45, 0.25, 0.02]} /><Material type="dark" /></mesh>
    <Text position={[-1.25, 0.04, 0.32]} fontSize={0.11} color="#06131e" anchorX="left">POSE</Text>
    <Text position={[-0.3, 0.04, 0.32]} fontSize={0.11} color="#06131e" anchorX="left">READY</Text>
    <Text position={[-1.34, -0.21, 0.31]} fontSize={0.1} color="#67e8e0" anchorX="left">MOBILITY / MEDICAL ANALYSIS BEZEL</Text>
    <Text position={[-1.34, -0.39, 0.31]} fontSize={0.08} color="#7898a2" anchorX="left">CLICK TO ARM CAMERA ALIGNMENT</Text>
  </group>
}

function CockpitDeck() {
  return <group position={[0, 0, -0.6]}>
    <RoundedBox args={[6.7, 5.8, 0.16]} radius={0.18} smoothness={5} position={[0, 0, -0.12]}><Material type="dark" /></RoundedBox>
    <mesh position={[0, 0, -0.02]}><boxGeometry args={[6.3, 5.42, 0.04]} /><meshStandardMaterial color="#102333" roughness={0.42} metalness={0.65} /></mesh>
    <mesh position={[0, -0.16, 0.03]}><boxGeometry args={[0.025, 4.9, 0.03]} /><Material type="edge" /></mesh>
    <mesh position={[0, 0.12, 0.03]}><boxGeometry args={[6.1, 0.025, 0.03]} /><Material type="edge" /></mesh>
  </group>
}

function CockpitScene({ selectedMetric, onSelectMetric, onOpenMobility, onOpenBriefing, activeAlert, onAcknowledge, healthScore, queueLength, alertCount, voice, onApplyCountermeasure }) {
  const [selectedInstrument, setSelectedInstrument] = useState(selectedMetric)
  const dashboard = useRef()
  useFrame((state, delta) => {
    if (!dashboard.current) return
    dashboard.current.rotation.y = THREE.MathUtils.lerp(dashboard.current.rotation.y, state.pointer.x * 0.018, delta * 1.8)
    dashboard.current.rotation.x = THREE.MathUtils.lerp(dashboard.current.rotation.x, state.pointer.y * -0.012, delta * 1.8)
  })
  const selectInstrument = (id) => { setSelectedInstrument(id); onSelectMetric(id) }
  return <>
    <color attach="background" args={['#07131f']} />
    <ambientLight intensity={1.15} color="#b9d7d8" />
    <directionalLight position={[-3, 5, 5]} intensity={2.6} color="#d5ffff" />
    <directionalLight position={[4, 2, 1]} intensity={1.8} color="#8db6ff" />
    <pointLight position={[0, -1, 2]} intensity={4} distance={8} color="#52d9d1" />
    <group ref={dashboard}>
      <CockpitDeck />
      <PulseOximeter selected={selectedInstrument === 'cardio'} onSelect={selectInstrument} />
      <Dosimeter selected={selectedInstrument === 'radiation'} onSelect={selectInstrument} />
      <MobilityBezel onOpen={onOpenMobility} />
      <DashboardLayout healthScore={healthScore} queueLength={queueLength} alertCount={alertCount} activeAlert={activeAlert} voice={voice} onSelectMetric={selectInstrument} onOpenMobility={onOpenMobility} onOpenBriefing={onOpenBriefing} onApplyCountermeasure={onApplyCountermeasure} />
    </group>
    <ContactShadows position={[0, -2.92, 0]} opacity={0.55} scale={9} blur={2.4} far={4.5} />
    <OrbitControls makeDefault enableZoom enablePan rotateSpeed={0.35} minDistance={5.5} maxDistance={10} target={[0, 0, 0]} />
    {activeAlert && <Html position={[0, 2.7, 0.2]} center style={{ pointerEvents: 'auto' }}><button className="scene-alert-beacon" onClick={() => onAcknowledge(activeAlert.id)}>{activeAlert.severity} / ACKNOWLEDGE</button></Html>}
  </>
}

export function HologramScene(props) {
  return <div className="immersive-canvas physical-cockpit" aria-label="Interactive 3D astronaut health cockpit">
    <Canvas camera={{ position: [0, 0.15, 8.2], fov: 42 }} dpr={[1, 1.8]} gl={{ alpha: false, antialias: true }}>
      <CockpitScene {...props} />
    </Canvas>
  </div>
}
