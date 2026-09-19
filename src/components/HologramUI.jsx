import { Activity, AlertTriangle, ArrowUpRight, Check, ChevronRight, CircleDot, CloudOff, Crosshair, Database, HeartPulse, Orbit, Radio, ShieldCheck, Sparkles, Wifi } from 'lucide-react'
import { alerts, metricDefinitions, systemEvents, telemetryRows } from '../data/metrics'
import { getMetricStatus } from '../lib/healthStore'

const icons = { pulse: HeartPulse, orbit: Orbit, shield: ShieldCheck, sparkles: Sparkles }

function Panel({ eyebrow, title, children, className = '' }) {
  return (
    <section className={`hud-panel ${className}`}>
      {(eyebrow || title) && <div className="panel-heading"><div><span className="eyebrow">{eyebrow}</span>{title && <h2>{title}</h2>}</div><Crosshair size={14} strokeWidth={1.5} /></div>}
      {children}
    </section>
  )
}

export function SystemHeader({ isGlitching }) {
  return (
    <header className={`system-header ${isGlitching ? 'is-glitching' : ''}`}>
      <div className="brand-lockup"><div className="brand-mark"><Orbit size={21} /></div><div><span className="eyebrow">AURORA MEDICAL // MK-IV</span><div className="brand-name">ORBITAL <span>HEALTH</span></div></div></div>
      <div className="system-state"><span className="pulse-dot" /> <span className="type-line">SYSTEM_ONLINE // SECURE_HOLO_FEED</span><span className="mono">M184 · 06:42:18</span></div>
    </header>
  )
}

export function CoreReadout() {
  return (
    <div className="core-readout">
      <div className="core-topline"><span>CREW MEMBER</span><strong>A. RIVERA</strong></div>
      <div className="core-score">88<span>%</span></div>
      <div className="core-label">MISSION READINESS INDEX</div>
      <div className="core-bar"><div style={{ width: '88%' }} /></div>
      <div className="core-foot"><span>LOCAL MODEL v2.4</span><span>+2.4% ↑</span></div>
    </div>
  )
}

export function MetricRail({ activeMetric, onSelectMetric }) {
  return (
    <div className="metric-rail">
      {metricDefinitions.map((metric) => {
        const Icon = icons[metric.icon]
        return <button key={metric.id} className={`metric-chip ${activeMetric === metric.id ? 'is-active' : ''}`} onClick={() => onSelectMetric(metric.id)} style={{ '--metric-color': metric.color }}><Icon size={15} /><span>{metric.shortLabel}</span><small>{getMetricStatus(metric)}</small></button>
      })}
    </div>
  )
}

export function TelemetryPanel({ activeMetric, onSelectMetric }) {
  const selected = metricDefinitions.find((metric) => metric.id === activeMetric) || metricDefinitions[0]
  return <Panel eyebrow="01 / LIVE TELEMETRY" title="Signal matrix" className="telemetry-panel">
    <div className="telemetry-focus"><div><span className="eyebrow">{selected.detail}</span><div className="focus-value">{selected.value}<small>{selected.unit}</small></div></div><div className="focus-trend"><ArrowUpRight size={15} /> {selected.trend}<small>{selected.trendLabel}</small></div></div>
    <MetricRail activeMetric={activeMetric} onSelectMetric={onSelectMetric} />
    <div className="range-line"><span>BASELINE WINDOW</span><strong>{selected.range}</strong></div>
    <p className="muted-copy">{selected.description}</p>
    <div className="telemetry-table">{telemetryRows.map((row) => <div className="telemetry-row" key={row.label}><div><span className={`status-led ${row.status}`} />{row.label}</div><strong>{row.value} <small>{row.unit}</small></strong><span className="mono muted-copy">{row.time}</span></div>)}</div>
  </Panel>
}

export function AlertPanel({ activeAlerts, onAcknowledge }) {
  return <Panel eyebrow="02 / DECISION SUPPORT" title="Attention queue" className="alert-panel">
    <div className="alert-summary"><AlertTriangle size={16} /><span>{activeAlerts.length} signals require crew attention</span><span className="mono">LOCAL ONLY</span></div>
    {activeAlerts.length === 0 ? <div className="empty-alert"><Check size={20} /><span>All current assessments acknowledged.</span></div> : activeAlerts.map((alert) => <div className="alert-item" key={alert.id} style={{ '--alert-color': alert.color }}><div className="alert-marker"><span>{alert.severity}</span><div /></div><div className="alert-copy"><span className="eyebrow">{alert.domain}</span><h3>{alert.title}</h3><p>{alert.body}</p><strong><span>↳</span> {alert.action}</strong><button onClick={() => onAcknowledge(alert.id)}><Check size={13} /> Acknowledge</button></div></div>)}
  </Panel>
}

export function CheckInPanel({ onSave }) {
  return <Panel eyebrow="03 / CREW INPUT" title="Private check-in" className="checkin-panel">
    <p className="muted-copy">Quick subjective signals are encrypted locally and added to the downlink queue.</p>
    <div className="checkin-grid"><label>MOOD / COPING<input type="range" min="1" max="10" defaultValue="7" /><span>7 / 10</span></label><label>PERCEIVED STRESS<input type="range" min="1" max="10" defaultValue="4" /><span>4 / 10</span></label></div>
    <div className="checkin-actions"><button className="primary-button" onClick={onSave}><Database size={14} /> Save local check-in</button><span className="mono">NO LINK REQUIRED</span></div>
  </Panel>
}

export function SystemLog({ localEvents }) {
  const events = [...localEvents, ...systemEvents.map(([time, label, tag]) => ({ time, label, tag }))].slice(0, 6)
  return <Panel eyebrow="04 / AUDIT TRAIL" title="Mission log" className="log-panel"><div className="event-list">{events.map((event, index) => <div className="event-row" key={`${event.time}-${event.label}-${index}`}><span className="event-time">{event.time}</span><div><strong>{event.label}</strong><span className="mono">{event.tag}</span></div><ChevronRight size={14} /></div>)}</div></Panel>
}

export function StatusStrip({ syncQueue }) {
  return <div className="status-strip"><div><span className="pulse-dot" />LOCAL STORE <strong>ENCRYPTED</strong></div><div><CloudOff size={14} /> OFFLINE READY</div><div><Radio size={14} /> LAST GROUND HANDSHAKE <strong>02:14 UTC</strong></div><div><Wifi size={14} /> OUTBOX <strong>{syncQueue} EVENTS</strong></div></div>
}
