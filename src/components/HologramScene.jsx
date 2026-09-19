import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Float, OrbitControls, Sparkles, Text } from '@react-three/drei'
import { useRef, useState } from 'react'
import * as THREE from 'three'
import { metricDefinitions } from '../data/metrics'
import DashboardLayout from './DashboardLayout'

const vertexShader = `
  varying vec3 vNormal;
  varying vec3 vPosition;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const fragmentShader = `
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vPosition;
  void main() {
    float fresnel = pow(1.0 - abs(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0))), 2.6);
    float scan = smoothstep(0.36, 0.5, sin((vPosition.y * 10.0) - uTime * 4.5) * 0.5 + 0.5);
    float flicker = 0.88 + 0.12 * sin(uTime * 5.0 + vPosition.y * 7.0);
    vec3 cyan = vec3(0.18, 0.95, 0.92);
    vec3 blue = vec3(0.07, 0.3, 0.53);
    vec3 color = mix(blue, cyan, fresnel + scan * 0.22) * flicker;
    float alpha = 0.16 + fresnel * 0.58 + scan * 0.12;
    gl_FragColor = vec4(color, alpha);
  }
`

function HoloCore({ onSelect }) {
  const mesh = useRef()
  const material = useRef()
  const { pointer } = useThree()

  useFrame((state, delta) => {
    if (!mesh.current || !material.current) return
    mesh.current.rotation.y += delta * 0.2
    mesh.current.rotation.x = THREE.MathUtils.lerp(mesh.current.rotation.x, pointer.y * 0.16, 0.04)
    mesh.current.rotation.z = THREE.MathUtils.lerp(mesh.current.rotation.z, pointer.x * -0.1, 0.04)
    material.current.uniforms.uTime.value = state.clock.elapsedTime
  })

  return (
    <Float speed={1.15} rotationIntensity={0.16} floatIntensity={0.28}>
      <group>
        <mesh ref={mesh} onClick={(event) => { event.stopPropagation(); onSelect('core') }}>
          <icosahedronGeometry args={[1.9, 3]} />
          <shaderMaterial
            ref={material}
            vertexShader={vertexShader}
            fragmentShader={fragmentShader}
            uniforms={{ uTime: { value: 0 } }}
            transparent
            depthWrite={false}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[2.25, 0.008, 16, 128]} />
          <meshBasicMaterial color="#6fffe9" transparent opacity={0.65} blending={THREE.AdditiveBlending} />
        </mesh>
        <mesh rotation={[0.2, Math.PI / 2, 0]}>
          <torusGeometry args={[2.48, 0.004, 16, 128]} />
          <meshBasicMaterial color="#4b9fff" transparent opacity={0.3} blending={THREE.AdditiveBlending} />
        </mesh>
        <pointLight color="#41f5e1" intensity={2.4} distance={6} />
      </group>
    </Float>
  )
}

function DragLayer({ children, position, onPositionChange }) {
  const group = useRef()
  const [dragging, setDragging] = useState(false)
  const { camera, gl } = useThree()
  const plane = useRef(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0))
  const point = useRef(new THREE.Vector3())

  const move = (event) => {
    if (!dragging) return
    const bounds = gl.domElement.getBoundingClientRect()
    const ndc = new THREE.Vector2(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1,
    )
    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(ndc, camera)
    raycaster.ray.intersectPlane(plane.current, point.current)
    onPositionChange([point.current.x, point.current.y, 0])
  }

  return <group ref={group} position={position} onPointerDown={(event) => { event.stopPropagation(); setDragging(true); gl.domElement.setPointerCapture(event.pointerId) }} onPointerMove={move} onPointerUp={(event) => { setDragging(false); gl.domElement.releasePointerCapture(event.pointerId) }}>
    {children}
  </group>
}

function MetricNode({ metric, position, selected, onSelect, onPositionChange }) {
  const color = metric.color
  return <DragLayer position={position} onPositionChange={onPositionChange}>
    <group onClick={(event) => { event.stopPropagation(); onSelect(metric.id) }}>
      <mesh>
        <sphereGeometry args={[0.22, 24, 24]} />
        <meshBasicMaterial color={color} transparent opacity={selected ? 0.95 : 0.72} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.34, selected ? 0.025 : 0.012, 8, 64]} />
        <meshBasicMaterial color={color} transparent opacity={selected ? 0.9 : 0.35} blending={THREE.AdditiveBlending} />
      </mesh>
      <Text position={[0.42, 0.14, 0]} fontSize={0.14} color={color} anchorX="left">{metric.shortLabel}</Text>
      <Text position={[0.42, -0.04, 0]} fontSize={0.19} color="#e8fbf8" anchorX="left">{metric.value} {metric.unit}</Text>
      <Text position={[0.42, -0.23, 0]} fontSize={0.09} color="#7eaaa9" anchorX="left">DRAG TO INSPECT</Text>
    </group>
  </DragLayer>
}

function MobilityStation({ onOpen }) {
  return <group position={[0, -2.2, 0]} onClick={(event) => { event.stopPropagation(); onOpen() }}>
    <mesh>
      <boxGeometry args={[2.7, 0.58, 0.12]} />
      <meshBasicMaterial color="#0f4b58" transparent opacity={0.48} blending={THREE.AdditiveBlending} />
    </mesh>
    <mesh position={[-1.34, 0, 0.08]}>
      <boxGeometry args={[0.03, 0.36, 0.04]} />
      <meshBasicMaterial color="#6fffe9" />
    </mesh>
    <Text position={[-1.18, 0.08, 0.1]} fontSize={0.12} color="#6fffe9" anchorX="left">MOBILITY / POSE TRACKER</Text>
    <Text position={[-1.18, -0.13, 0.1]} fontSize={0.1} color="#e8fbf8" anchorX="left">CAMERA STATION // CLICK TO ARM</Text>
  </group>
}

function AlertBeacon({ alert, onAcknowledge }) {
  if (!alert) return null
  const color = alert.status === 'urgent' ? '#ff8d7c' : '#ffce6a'
  return <group position={[0, 2.9, 0]} onClick={(event) => { event.stopPropagation(); onAcknowledge(alert.id) }}>
    <mesh>
      <octahedronGeometry args={[0.13, 0]} />
      <meshBasicMaterial color={color} transparent opacity={0.9} blending={THREE.AdditiveBlending} />
    </mesh>
    <Text position={[0.24, 0.07, 0]} fontSize={0.12} color={color} anchorX="left">{alert.severity} // {alert.title}</Text>
    <Text position={[0.24, -0.13, 0]} fontSize={0.09} color="#7eaaa9" anchorX="left">CLICK TO ACKNOWLEDGE LOCALLY</Text>
  </group>
}

function SceneContent({ selectedMetric, onSelectMetric, nodePositions, onPositionChange, onOpenMobility, onOpenBriefing, activeAlert, onAcknowledge, healthScore, queueLength, alertCount, activeTab, onTabChange, hudLocked, onToggleHud }) {
  const dashboard = useRef()
  const { pointer } = useThree()
  useFrame((_, delta) => {
    if (!dashboard.current) return
    dashboard.current.rotation.y = THREE.MathUtils.lerp(dashboard.current.rotation.y, pointer.x * 0.12, 0.025)
    dashboard.current.rotation.x = THREE.MathUtils.lerp(dashboard.current.rotation.x, pointer.y * -0.08, 0.025)
    dashboard.current.rotation.z += delta * 0.008
  })
  return (
    <>
      <ambientLight intensity={0.1} />
      <Sparkles count={140} scale={[12, 8, 8]} size={1.1} speed={0.18} color="#82fff2" opacity={0.5} />
      <Sparkles count={45} scale={[7, 5, 5]} size={2.2} speed={0.08} color="#669eff" opacity={0.24} />
      <group ref={dashboard}>
        <DashboardLayout healthScore={healthScore} queueLength={queueLength} alertCount={alertCount} activeTab={activeTab} onTabChange={onTabChange} onSelectMetric={onSelectMetric} onOpenMobility={onOpenMobility} onOpenBriefing={onOpenBriefing} hudLocked={hudLocked} onToggleHud={onToggleHud} />
        <Text position={[-3.4, 2.55, 0]} fontSize={0.14} color="#7eaaa9" anchorX="left">ORBITAL HEALTH // HOLOGRAPHIC CONSOLE</Text>
        <Text position={[-3.4, 2.28, 0]} fontSize={0.3} color="#e8fbf8" anchorX="left">MISSION READINESS</Text>
        <Text position={[-0.48, 2.28, 0]} fontSize={0.3} color="#6fffe9" anchorX="left">88%</Text>
        <AlertBeacon alert={activeAlert} onAcknowledge={onAcknowledge} />
        {metricDefinitions.map((metric) => <MetricNode key={metric.id} metric={metric} position={nodePositions[metric.id]} selected={selectedMetric === metric.id} onSelect={onSelectMetric} onPositionChange={(next) => onPositionChange(metric.id, next)} />)}
        <MobilityStation onOpen={onOpenMobility} />
      </group>
      <OrbitControls makeDefault enableZoom enablePan rotateSpeed={0.65} minDistance={4.5} maxDistance={11} />
    </>
  )
}

export function HologramScene({ selectedMetric, onSelectMetric, onOpenMobility, onOpenBriefing, activeAlert, onAcknowledge, healthScore, queueLength, alertCount, activeTab, onTabChange, hudLocked, onToggleHud }) {
  const [nodePositions, setNodePositions] = useState({ cardio: [-3.0, 1.25, 0], bone: [2.8, 1.15, 0], immune: [-2.8, -1.05, 0], behavior: [2.55, -1.0, 0] })
  return (
    <div className="immersive-canvas" aria-label="Interactive 3D astronaut health dashboard">
      <Canvas camera={{ position: [0, 0, 7.4], fov: 42 }} dpr={[1, 1.8]} gl={{ alpha: true, antialias: true }}>
        <SceneContent selectedMetric={selectedMetric} onSelectMetric={onSelectMetric} nodePositions={nodePositions} onPositionChange={(id, position) => setNodePositions((current) => ({ ...current, [id]: position }))} onOpenMobility={onOpenMobility} onOpenBriefing={onOpenBriefing} activeAlert={activeAlert} onAcknowledge={onAcknowledge} healthScore={healthScore} queueLength={queueLength} alertCount={alertCount} activeTab={activeTab} onTabChange={onTabChange} hudLocked={hudLocked} onToggleHud={onToggleHud} />
      </Canvas>
    </div>
  )
}
