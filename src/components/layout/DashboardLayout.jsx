import { Component, useCallback, useState } from 'react'
import { motion } from 'framer-motion'
import { Activity, Moon, ShieldCheck, Waves } from 'lucide-react'
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

function MissionStrip() {
  return (
    <header className="mission-strip">
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
    </header>
  )
}

function SleepStressPanel() {
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
    </section>
  )
}

function CountermeasurePanel({ telemetry }) {
  const activation = telemetry?.activation || {}
  return (
    <section className="command-panel side-panel">
      <div className="command-panel-heading"><div><span className="telemetry-kicker">04 / COUNTERMEASURES</span><h2>Musculoskeletal load</h2></div><Activity size={17} /></div>
      <div className="load-status"><span className="status-dot" /> LIVE LOAD MODEL <strong>{telemetry?.poseLocked ? 'TRACKING' : 'STANDBY'}</strong></div>
      <div className="heatmap-card"><div className="heatmap-title"><span>DELTOIDS</span><b>{activation.deltoids || 0}%</b></div><div className="body-map deltoids"><span /></div><MetricBar label="COUNTERMEASURE LOAD" value={activation.deltoids || 0} /></div>
      <div className="heatmap-card"><div className="heatmap-title"><span>BICEPS</span><b>{activation.biceps || 0}%</b></div><div className="body-map biceps"><span /></div><MetricBar label="COUNTERMEASURE LOAD" value={activation.biceps || 0} /></div>
      <div className="heatmap-card"><div className="heatmap-title"><span>QUADRICEPS</span><b>{activation.quadriceps || 0}%</b></div><div className="body-map quadriceps"><span /></div><MetricBar label="COUNTERMEASURE LOAD" value={activation.quadriceps || 0} /></div>
      <div className="heatmap-card"><div className="heatmap-title"><span>TRAPEZIUS</span><b>{activation.trapezius || 0}%</b></div><div className="body-map trapezius"><span /></div><MetricBar label="COUNTERMEASURE LOAD" value={activation.trapezius || 0} /></div>
    </section>
  )
}

export class DashboardErrorBoundary extends Component {
  state = { hasError: false }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch(error, info) { console.error('Dashboard rendering failed', error, info) }
  render() {
    if (this.state.hasError) return <main className="app-error"><h1>Mission console unavailable</h1><p>Reload the local dashboard to restart the telemetry surfaces.</p><button type="button" onClick={() => window.location.reload()}>RELOAD CONSOLE</button></main>
    return this.props.children
  }
}

export default function DashboardLayout() {
  const camera = useCameraStream()
  const [telemetry, setTelemetry] = useState(null)
  const handleTelemetry = useCallback((nextTelemetry) => setTelemetry(nextTelemetry), [])

  return (
    <DashboardErrorBoundary>
      <main className="dashboard-shell h-screen w-screen overflow-hidden flex flex-col bg-slate-950 text-slate-100">
        <DeepSpaceCanvas />
        <MissionStrip />
        <motion.div className="command-grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.45 }}>
          <SleepStressPanel />
          <SyncedAvatarDiagnostic camera={camera} onTelemetry={handleTelemetry} />
          <CountermeasurePanel telemetry={telemetry} />
        </motion.div>
        <footer className="dashboard-footer">CLINICAL DECISION SUPPORT · NOT A DIAGNOSIS · CAMERA AND TELEMETRY REMAIN LOCAL TO THIS CONSOLE <span>SYS LINK / SECURE</span></footer>
      </main>
    </DashboardErrorBoundary>
  )
}
