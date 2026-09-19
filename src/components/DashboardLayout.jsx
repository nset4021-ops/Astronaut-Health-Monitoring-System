import { Html, Text } from '@react-three/drei'
import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import MissionHealthCore from './MissionHealthCore'

const tabs = [
  { id: 'mobility', label: 'MOBILITY & CAMERA', short: 'MOBILITY' },
  { id: 'biometrics', label: 'BIOMETRICS & RADIATION', short: 'BIOMETRICS' },
  { id: 'briefing', label: 'DAILY BRIEFING', short: 'BRIEFING' },
]

const panelData = {
  mobility: {
    title: 'MOBILITY / CAMERA',
    subtitle: 'SYSTEM CALIBRATION',
    rows: [['Pose confidence', 'READY', 'green'], ['Knee flexion', '92° / 88°', 'green'], ['Posture', 'NEUTRAL', 'green']],
  },
  biometrics: {
    title: 'BIOMETRICS / RAD',
    subtitle: 'MULTI-MODAL TELEMETRY',
    rows: [['Resting heart rate', '78 BPM', 'yellow'], ['Radiation dose', '0.42 mSv', 'green'], ['Sleep recovery', '5.8 HRS', 'yellow']],
  },
  briefing: {
    title: 'DAILY BRIEFING',
    subtitle: 'MISSION DAY 184',
    rows: [['Crew check-in', 'DUE NOW', 'yellow'], ['Ground handshake', '02:14 UTC', 'green'], ['Open assessments', '02', 'red']],
  },
}

function PanelSurface({ title, subtitle, rows, position, rotation = [0, 0, 0], active, onClick }) {
  return <group position={position} rotation={rotation} onClick={(event) => { event.stopPropagation(); onClick?.() }}>
    <mesh>
      <planeGeometry args={[3.25, 2.2]} />
      <meshBasicMaterial color={active ? '#0c4350' : '#082630'} transparent opacity={0.8} side={THREE.DoubleSide} />
    </mesh>
    <lineSegments>
      <edgesGeometry args={[new THREE.PlaneGeometry(3.25, 2.2)]} />
      <lineBasicMaterial color={active ? '#6fffe9' : '#2f7880'} transparent opacity={active ? 0.9 : 0.48} />
    </lineSegments>
    <mesh position={[-1.48, 0.93, 0.025]}>
      <planeGeometry args={[0.04, 0.38]} />
      <meshBasicMaterial color={active ? '#6fffe9' : '#2f7880'} />
    </mesh>
    <Text position={[-1.28, 0.83, 0.04]} fontSize={0.14} color={active ? '#6fffe9' : '#9ac9c4'} anchorX="left">{title}</Text>
    <Text position={[-1.28, 0.62, 0.04]} fontSize={0.075} color="#5d8c90" anchorX="left">{subtitle}</Text>
    {rows.map(([label, value, tone], index) => <group key={label} position={[-1.28, 0.23 - index * 0.47, 0.04]}>
      <Text position={[0, 0.1, 0]} fontSize={0.085} color="#8fb8b7" anchorX="left">{label}</Text>
      <Text position={[1.22, 0.1, 0]} fontSize={0.105} color={tone === 'green' ? '#a9ffb5' : tone === 'yellow' ? '#ffce6a' : '#ff8d7c'} anchorX="right">{value}</Text>
      <mesh position={[0.02, -0.1, 0]}>
        <planeGeometry args={[2.48, 0.012]} />
        <meshBasicMaterial color={tone === 'green' ? '#a9ffb5' : tone === 'yellow' ? '#ffce6a' : '#ff8d7c'} transparent opacity={0.5} />
      </mesh>
    </group>)}
    <Html center position={[0, -1.13, 0]} style={{ pointerEvents: 'none' }}>
      <div className="cockpit-panel-caption">CLICK TO FOCUS</div>
    </Html>
  </group>
}

function FixedHud({ healthScore, alertCount, queueLength }) {
  return <Html fullscreen transform={false} style={{ pointerEvents: 'none' }}>
    <div className="fixed-cockpit-hud">
      <div><span>MISSION HEALTH</span><strong>{healthScore}%</strong></div>
      <div><span>OPEN ALERTS</span><strong className={alertCount ? 'hud-warn' : ''}>{alertCount}</strong></div>
      <div><span>LOCAL OUTBOX</span><strong>{queueLength}</strong></div>
    </div>
  </Html>
}

function QuickTabs({ activeTab, onTabChange }) {
  return <Html fullscreen transform={false} style={{ pointerEvents: 'none' }}>
    <nav className="cockpit-tabs" aria-label="Mission modules">
      {tabs.map((tab) => <button key={tab.id} className={activeTab === tab.id ? 'is-active' : ''} onClick={() => onTabChange?.(tab.id)}>{tab.short}<small>{tab.label}</small></button>)}
    </nav>
  </Html>
}

export default function DashboardLayout({ healthScore, alertCount, queueLength, activeTab = 'biometrics', onTabChange, onSelectMetric, onOpenMobility, onOpenBriefing, hudLocked = true }) {
  const cockpit = useRef()
  useFrame((state) => {
    if (!cockpit.current) return
    cockpit.current.rotation.x = THREE.MathUtils.lerp(cockpit.current.rotation.x, state.pointer.y * -0.035, 0.035)
  })
  const focused = panelData[activeTab] || panelData.biometrics

  return <group ref={cockpit}>
    <MissionHealthCore healthScore={healthScore} queueLength={queueLength} alertCount={alertCount} onSelect={onSelectMetric} />
    <PanelSurface {...panelData.mobility} position={[-3.7, 0.45, -0.25]} rotation={[0, 0.24, 0]} active={activeTab === 'mobility'} onClick={() => { onTabChange?.('mobility'); onOpenMobility?.() }} />
    <PanelSurface {...panelData.biometrics} position={[3.7, 0.45, -0.25]} rotation={[0, -0.24, 0]} active={activeTab === 'biometrics'} onClick={() => onTabChange?.('biometrics')} />
    <PanelSurface {...panelData.briefing} position={[0, -2.72, -0.1]} active={activeTab === 'briefing'} onClick={() => { onTabChange?.('briefing'); onOpenBriefing?.() }} />
    <Text position={[-3.7, 1.72, -0.26]} rotation={[0, 0.24, 0]} fontSize={0.09} color="#557f84" anchorX="left">PORT // 01</Text>
    <Text position={[2.25, 1.72, -0.26]} rotation={[0, -0.24, 0]} fontSize={0.09} color="#557f84" anchorX="left">PORT // 02</Text>
    <Text position={[-1.65, -1.52, -0.1]} fontSize={0.09} color="#557f84" anchorX="left">PORT // 03</Text>
    <Text position={[-1.65, 2.58, 0]} fontSize={0.1} color="#6fffe9" anchorX="left">COCKPIT CONFIGURATION // {focused.title}</Text>
    {hudLocked && <FixedHud healthScore={healthScore} alertCount={alertCount} queueLength={queueLength} />}
    <QuickTabs activeTab={activeTab} onTabChange={onTabChange} />
  </group>
}

export { tabs }
