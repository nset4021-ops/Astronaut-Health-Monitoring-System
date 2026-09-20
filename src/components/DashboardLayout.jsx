import { Html } from '@react-three/drei'
import MissionHealthCore from './MissionHealthCore'

const metrics = [
  { label: 'CARDIOVASCULAR', value: '78', unit: 'BPM', percent: 78, tone: 'cyan', detail: 'Resting heart rate · +4.8% baseline' },
  { label: 'RADIATION EXPOSURE', value: '0.42', unit: 'mSv', percent: 28, tone: 'green', detail: 'Dosimeter dose · 24h window' },
  { label: 'BONE DENSITY', value: '96', unit: '% BASELINE', percent: 96, tone: 'yellow', detail: 'Loading response · trend stable' },
  { label: 'IMMUNE READINESS', value: '92', unit: 'INDEX', percent: 92, tone: 'green', detail: 'Symptoms clear · recovery stable' },
]

const tabs = [
  { id: 'mobility', label: 'MOBILITY & CAMERA', action: 'mobility' },
  { id: 'biometrics', label: 'BIOMETRICS & RADIATION' },
  { id: 'briefing', label: 'DAILY BRIEFING', action: 'briefing' },
]

function StatusDot({ tone }) {
  return <span className={`command-status-dot ${tone}`} aria-hidden="true" />
}

function PanelHeader({ eyebrow, title, status }) {
  return <div className="command-panel-header"><div><span className="command-eyebrow">{eyebrow}</span><h2>{title}</h2></div>{status && <span className="command-status-label"><StatusDot tone={status.tone} />{status.label}</span>}</div>
}

function MetricGrid() {
  return <div className="metric-grid">{metrics.map((metric) => <article className="metric-card" key={metric.label}><div className="metric-card-top"><StatusDot tone={metric.tone} /><span>{metric.label}</span><strong>{metric.value}<small>{metric.unit}</small></strong></div><div className="metric-bar"><div className={metric.tone} style={{ width: `${metric.percent}%` }} /></div><p>{metric.detail}</p></article>)}</div>
}

function CommandCenterGrid({ healthScore, alertCount, queueLength, activeAlert, voice, onOpenMobility, onOpenBriefing, onApplyCountermeasure }) {
  return <Html fullscreen transform={false} style={{ pointerEvents: 'none' }}>
    <div className="command-center-shell">
      <header className="command-topbar command-panel">
        <div className="command-brand"><span className="command-brand-mark">◈</span><div><span className="command-eyebrow">AURORA MEDICAL // HAB-01</span><strong>ORBITAL <i>HEALTH</i></strong></div></div>
        <div className="command-mission"><span>MISSION DAY 184</span><b>06:42:18 UTC</b><em><StatusDot tone="green" /> SYSTEM ONLINE</em></div>
        <div className="command-score"><span>UNIFIED HEALTH</span><strong>{healthScore}%</strong></div>
        <button className={`command-voice ${voice?.isListening ? 'is-listening' : ''}`} style={{ pointerEvents: 'auto' }} onClick={voice?.isListening ? voice.stopListening : voice?.startListening} aria-label="Toggle voice commands"><span>{voice?.isListening ? '●' : '◉'}</span>{voice?.isListening ? 'LISTENING' : 'VOICE COMMANDS'}</button>
      </header>

      <aside className="command-left command-panel">
        <PanelHeader eyebrow="01 / LIVE SENSOR" title="Mobility check" status={{ tone: 'green', label: 'READY' }} />
        <button className="webcam-preview" style={{ pointerEvents: 'auto' }} onClick={onOpenMobility}><div className="webcam-grid-lines" /><span className="webcam-icon">◉</span><strong>CAMERA STATION</strong><small>CLICK TO INITIALIZE LOCAL POSE TRACKING</small></button>
        <div className="posture-readout"><span>AI POSTURE STATUS</span><strong className="tone-green">NEUTRAL / READY</strong><div><span>POSE CONFIDENCE</span><b>--</b></div><div><span>JOINT RANGE</span><b>AWAITING FEED</b></div></div>
        <button className="command-secondary" style={{ pointerEvents: 'auto' }} onClick={onOpenMobility}>OPEN MOBILITY MODULE <span>→</span></button>
      </aside>

      <section className="command-center command-panel"><PanelHeader eyebrow="02 / UNIFIED TELEMETRY" title="Core health metrics" status={{ tone: healthScore >= 85 ? 'green' : healthScore >= 65 ? 'yellow' : 'red', label: healthScore >= 85 ? 'OPTIMAL' : 'REVIEW' }} /><MetricGrid /><div className="core-score-strip"><div><span>MISSION HEALTH CORE</span><strong>{healthScore}%</strong></div><div><span>LOCAL OUTBOX</span><strong>{queueLength}</strong></div><div><span>OPEN ASSESSMENTS</span><strong className={alertCount ? 'tone-yellow' : 'tone-green'}>{alertCount}</strong></div></div></section>

      <aside className="command-right command-panel">
        <PanelHeader eyebrow="03 / DECISION SUPPORT" title="Action queue" status={activeAlert ? { tone: activeAlert.status === 'urgent' ? 'red' : 'yellow', label: `${alertCount} OPEN` } : { tone: 'green', label: 'CLEAR' }} />
        {activeAlert ? <div className="command-alert"><div className="command-alert-title"><StatusDot tone={activeAlert.status === 'urgent' ? 'red' : 'yellow'} /><strong>{activeAlert.title}</strong></div><p>{activeAlert.body}</p><button className="countermeasure-cta" style={{ pointerEvents: 'auto' }} onClick={onApplyCountermeasure}>APPLY COUNTERMEASURE <span>→</span></button></div> : <div className="command-clear"><StatusDot tone="green" /> No active countermeasures.</div>}
        <button className="briefing-cta" style={{ pointerEvents: 'auto' }} onClick={onOpenBriefing}><span><b>DAILY BRIEFING</b><small>60 SEC · SLEEP / MOBILITY / RADIATION</small></span><strong>→</strong></button>
        <div className="command-alert-note"><span>VOICE READY</span><small>{voice?.transcript || 'Say “run daily briefing”'}</small></div>
      </aside>

      <nav className="command-tabs" aria-label="Dashboard modules">{tabs.map((tab) => <button key={tab.id} style={{ pointerEvents: 'auto' }} onClick={() => tab.action === 'mobility' ? onOpenMobility?.() : tab.action === 'briefing' ? onOpenBriefing?.() : null}><span>{tab.label}</span><small>{tab.id === 'mobility' ? 'CAMERA + AI POSTURE' : tab.id === 'biometrics' ? 'CARDIO + RAD + SYSTEMS' : 'CREW CHECK-IN'}</small></button>)}</nav>
      <div className="command-footnote">OFFLINE-FIRST · ENCRYPTED LOCAL STORE · CLINICAL DECISION SUPPORT, NOT A DIAGNOSIS</div>
    </div>
  </Html>
}

export default function DashboardLayout({ healthScore, alertCount, queueLength, activeAlert, voice, onSelectMetric, onOpenMobility, onOpenBriefing, onApplyCountermeasure }) {
  return <group><MissionHealthCore healthScore={healthScore} queueLength={queueLength} alertCount={alertCount} onSelect={onSelectMetric} /><CommandCenterGrid healthScore={healthScore} alertCount={alertCount} queueLength={queueLength} activeAlert={activeAlert} voice={voice} onOpenMobility={onOpenMobility} onOpenBriefing={onOpenBriefing} onApplyCountermeasure={onApplyCountermeasure} /></group>
}
