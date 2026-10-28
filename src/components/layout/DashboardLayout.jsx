import { Component, useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Activity, CheckCircle2, Eye, Headphones, Moon, Play, ShieldCheck, Volume2, Waves } from 'lucide-react'
import DeepSpaceCanvas from '../background/DeepSpaceCanvas'
import SyncedAvatarDiagnostic from '../diagnostics/SyncedAvatarDiagnostic'
import { useCameraStream } from '../../hooks/useCameraStream'

function MetricBar({ label, value, tone = 'cyan' }) {
  return (
    <div className="metric-bar">
      <div><span>{label}</span><strong>{value}%</strong></div>
      <i className={tone}><b style={{ width: `${value}%` }} /></i>
    </div>
  )
}

function speak(message, enabled) {
  if (!enabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(message))
}

function MissionStrip({ highContrast, setHighContrast, audioAssist, setAudioAssist }) {
  return (
    <header className="mission-strip" aria-label="Mission status and accessibility controls">
      <div className="mission-identity">
        <span className="mission-mark">A73</span>
        <div><span className="telemetry-kicker">AURORA MEDICAL / HAB-01</span><strong>EXPEDITION-73 COMMAND DECK</strong></div>
      </div>
      <div className="mission-facts">
        <span>MISSION ID: <b>EXPEDITION-73</b></span>
        <span>ORBIT: <b>ISS-LEO</b></span>
        <span>MET: <b>142D:06H:12M</b></span>
      </div>
      <div className="system-pills">
        <span className="system-pill nominal">RAD-SHIELD: NOMINAL</span>
        <span className="system-pill nominal">CABIN O2: 21.1%</span>
        <span className="system-pill amber">CO2: 0.04%</span>
      </div>
      <div className="accessibility-controls" aria-label="Accessibility controls">
        <button
          type="button"
          className={`accessibility-toggle ${highContrast ? 'is-selected' : ''}`}
          aria-label={`${highContrast ? 'Disable' : 'Enable'} high contrast mode`}
          aria-pressed={highContrast}
          onClick={() => setHighContrast((current) => !current)}
        >
          <Eye size={16} aria-hidden="true" /> HIGH CONTRAST
        </button>
        <button
          type="button"
          className={`accessibility-toggle ${audioAssist ? 'is-selected' : ''}`}
          aria-label={`${audioAssist ? 'Disable' : 'Enable'} audio assist`}
          aria-pressed={audioAssist}
          onClick={() => setAudioAssist((current) => !current)}
        >
          <Headphones size={16} aria-hidden="true" /> AUDIO ASSIST
        </button>
      </div>
    </header>
  )
}

function ActionButton({ label, description, tone, icon, onClick }) {
  return (
    <button type="button" className={`one-touch-action ${tone}`} aria-label={`${label}. ${description}`} onClick={onClick}>
      <span className="one-touch-icon" aria-hidden="true">{icon}</span>
      <span><strong>{label}</strong><small>{description}</small></span>
    </button>
  )
}

function SleepStressPanel({ audioAssist }) {
  return (
    <section className="command-panel side-panel">
      <div className="command-panel-heading"><div><span className="telemetry-kicker">01 / CREW WELLNESS</span><h2>Sleep & stress telemetry</h2></div><Moon size={17} /></div>
      <div className="wellness-readout"><strong>07:42</strong><span>REST CYCLE / LAST 24 HRS</span></div>
      <MetricBar label="SLEEP QUALITY" value={78} />
      <MetricBar label="EAR SYMMETRY" value={91} />
      <MetricBar label="FATIGUE INDEX" value={24} tone="amber" />
      <MetricBar label="STRESS LOAD" value={31} tone="amber" />
      <div className="panel-divider" />
      <div className="subsystem-label"><Waves size={13} /> BIO-CARE ACTION CARDS</div>
      <article className="care-card"><div><span>RECOVERY READINESS</span><b>82%</b></div><p>Complete a guided mobility hold before next scheduled EVA simulation.</p><small><ShieldCheck size={12} /> LOCAL CLINICAL RULESET</small></article>
      <article className="care-card"><div><span>HYDRATION WINDOW</span><b className="amber-text">OPEN</b></div><p>Consume 250 ml electrolyte solution during the next rest interval.</p><small><ShieldCheck size={12} /> CREW ROUTINE ADVISORY</small></article>
      <div className="panel-divider" />
      <div className="subsystem-label"><Volume2 size={13} /> ONE-TOUCH ACTIONS</div>
      <ActionButton label="ALL GOOD" description="No action needed" tone="green" icon={<CheckCircle2 size={25} />} onClick={() => speak('All good. No action needed.', audioAssist)} />
      <ActionButton label="CHECK POSTURE" description="Run a posture check" tone="amber-action" icon={<Eye size={25} />} onClick={() => speak('Posture check selected. Stand naturally in front of the camera.', audioAssist)} />
    </section>
  )
}

function CountermeasurePanel({ telemetry, audioAssist, onStartScan }) {
  const activation = telemetry?.activation || {}
  return (
    <section className="command-panel side-panel">
      <div className="command-panel-heading"><div><span className="telemetry-kicker">04 / COUNTERMEASURES</span><h2>Musculoskeletal load</h2></div><Activity size={17} /></div>
      <div className="load-status"><span className="status-dot" /> LIVE LOAD MODEL <strong>{telemetry?.poseLocked ? 'TRACKING' : 'STANDBY'}</strong></div>
      <div className="heatmap-card"><div className="heatmap-title"><span>DELTOIDS</span><b>{activation.deltoids || 0}%</b></div><div className="body-map deltoids"><span /></div><MetricBar label="COUNTERMEASURE LOAD" value={activation.deltoids || 0} /></div>
      <div className="heatmap-card"><div className="heatmap-title"><span>BICEPS</span><b>{activation.biceps || 0}%</b></div><div className="body-map biceps"><span /></div><MetricBar label="COUNTERMEASURE LOAD" value={activation.biceps || 0} /></div>
      <div className="heatmap-card"><div className="heatmap-title"><span>QUADRICEPS</span><b>{activation.quadriceps || 0}%</b></div><div className="body-map quadriceps"><span /></div><MetricBar label="COUNTERMEASURE LOAD" value={activation.quadriceps || 0} /></div>
      <div className="heatmap-card"><div className="heatmap-title"><span>TRAPEZIUS</span><b>{activation.trapezius || 0}%</b></div><div className="body-map trapezius"><span /></div><MetricBar label="COUNTERMEASURE LOAD" value={activation.trapezius || 0} /></div>
      <ActionButton label="START SCAN" description="Begin a live posture scan" tone="cyan-action" icon={<Play size={25} />} onClick={() => { onStartScan(); speak('Live posture scan started.', audioAssist) }} />
    </section>
  )
}

export class DashboardErrorBoundary extends Component {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch(error, info) { console.error('Dashboard rendering failed', error, info) }
  render() {
    if (this.state.hasError) return <main className="app-error"><h1>Mission console unavailable</h1><p>Reload the local dashboard to restart the telemetry surfaces.</p><button type="button" aria-label="Reload mission console" onClick={() => window.location.reload()}>RELOAD CONSOLE</button></main>
    return this.props.children
  }
}

export default function DashboardLayout() {
  const camera = useCameraStream()
  const [telemetry, setTelemetry] = useState(null)
  const [highContrast, setHighContrast] = useState(false)
  const [audioAssist, setAudioAssist] = useState(false)
  const [scanRequested, setScanRequested] = useState(false)
  const handleTelemetry = useCallback((nextTelemetry) => setTelemetry(nextTelemetry), [])
  const startScan = useCallback(() => {
    setScanRequested(true)
    if (!camera.isActive) void camera.start()
  }, [camera])

  useEffect(() => {
    if (!scanRequested || telemetry?.poseLocked) return
    setScanRequested(false)
  }, [scanRequested, telemetry?.poseLocked])

  return (
    <DashboardErrorBoundary>
      <main className={`dashboard-shell h-screen w-screen overflow-hidden flex flex-col bg-slate-950 text-slate-100 ${highContrast ? 'high-contrast-mode' : ''}`} aria-label="Aurora astronaut health command deck">
        <DeepSpaceCanvas />
        <MissionStrip highContrast={highContrast} setHighContrast={setHighContrast} audioAssist={audioAssist} setAudioAssist={setAudioAssist} />
        <motion.div className="command-grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.45 }}>
          <SleepStressPanel audioAssist={audioAssist} />
          <SyncedAvatarDiagnostic camera={camera} onTelemetry={handleTelemetry} />
          <CountermeasurePanel telemetry={telemetry} audioAssist={audioAssist} onStartScan={startScan} />
        </motion.div>
        <footer className="dashboard-footer">CLINICAL DECISION SUPPORT · NOT A DIAGNOSIS · CAMERA AND TELEMETRY REMAIN LOCAL TO THIS CONSOLE <span>{scanRequested ? 'SCAN / ACTIVE' : 'SYS LINK / SECURE'}</span></footer>
      </main>
    </DashboardErrorBoundary>
  )
}
