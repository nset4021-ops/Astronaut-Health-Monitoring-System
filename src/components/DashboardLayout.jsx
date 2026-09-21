import { Activity, Camera, CheckCircle2, Clock3, Dna, Droplets, HeartPulse, Mic, Moon, Orbit, ShieldAlert, Sparkles, TimerReset, Waves } from 'lucide-react'
import { Html } from '@react-three/drei'
import MissionHealthCore from './MissionHealthCore'

const LIQUID_GLASS_CLASSES = 'relative overflow-hidden rounded-2xl bg-slate-900/40 backdrop-blur-2xl border border-white/15 shadow-[0_8px_32px_0_rgba(0,255,255,0.1)] before:absolute before:inset-0 before:bg-gradient-to-b before:from-white/10 before:to-transparent before:pointer-events-none'

const healthMetrics = [
  { label: 'CARDIOVASCULAR', value: '78', unit: 'BPM', delta: '+4.8%', detail: 'Resting heart rate', tone: 'cyan', percent: 78, icon: HeartPulse, state: 'WATCH' },
  { label: 'RADIATION DOSE', value: '0.42', unit: 'mSv / 24h', delta: '-0.06', detail: 'Dosimeter exposure', tone: 'green', percent: 28, icon: ShieldAlert, state: 'NOMINAL' },
  { label: 'SLEEP EFFICIENCY', value: '74', unit: '%', delta: '-8.2%', detail: 'Last sleep opportunity', tone: 'amber', percent: 74, icon: Moon, state: 'WATCH' },
  { label: 'FATIGUE INDEX', value: '31', unit: '/ 100', delta: '+6', detail: 'Station-time model', tone: 'amber', percent: 31, icon: TimerReset, state: 'MONITOR' },
  { label: 'VESTIBULAR INDEX', value: '86', unit: '/ 100', delta: '+3.1%', detail: 'Balance adaptation', tone: 'cyan', percent: 86, icon: Orbit, state: 'STABLE' },
  { label: 'HYDRATION BALANCE', value: '91', unit: '%', delta: '+1.7%', detail: 'Fluid shift estimate', tone: 'green', percent: 91, icon: Droplets, state: 'STABLE' },
  { label: 'ELECTROLYTE LOAD', value: '88', unit: '%', delta: 'ON PLAN', detail: 'Na / K / Mg balance', tone: 'green', percent: 88, icon: Waves, state: 'NOMINAL' },
  { label: 'CELLULAR STRESS', value: '18', unit: '/ 100', delta: '-2.4%', detail: 'Oxidative stress proxy', tone: 'cyan', percent: 18, icon: Dna, state: 'STABLE' },
]

const moduleTabs = [
  { label: 'OVERVIEW', detail: 'MISSION HEALTH MATRIX' },
  { label: 'MOBILITY', detail: 'POSE + ALIGNMENT' },
  { label: 'BIOMETRICS', detail: 'CARDIO + CELLULAR' },
  { label: 'RECOVERY', detail: 'SLEEP + HYDRATION' },
]

function StatusDot({ tone = 'green' }) {
  return <span className={`command-status-dot ${tone}`} aria-hidden="true" />
}

function PanelHeader({ index, title, status, tone = 'green' }) {
  return <div className="command-panel-header"><div><span className="command-eyebrow">{index} / LIVE SYSTEM</span><h2>{title}</h2></div><span className={`command-status-label tone-${tone}`}><StatusDot tone={tone} />{status}</span></div>
}

function GlassMetric({ metric }) {
  const Icon = metric.icon
  return <article className={`${LIQUID_GLASS_CLASSES} liquid-glass-surface glass-metric tone-${metric.tone}`}>
    <div className="glass-metric-heading"><Icon size={15} strokeWidth={1.7} /><span>{metric.label}</span><b>{metric.state}</b></div>
    <div className="glass-metric-value"><strong>{metric.value}</strong><small>{metric.unit}</small><em>{metric.delta}</em></div>
    <div className="glass-metric-track"><span style={{ width: `${metric.percent}%` }} /></div>
    <p>{metric.detail}</p>
  </article>
}

function MobilityConsole({ onOpenMobility }) {
  return <aside className={`${LIQUID_GLASS_CLASSES} liquid-glass-surface command-left command-panel glass-panel`}>
    <PanelHeader index="01" title="Mobility station" status="CAMERA READY" />
    <button className={`${LIQUID_GLASS_CLASSES} liquid-glass-surface mobility-target`} style={{ pointerEvents: 'auto' }} onClick={onOpenMobility}>
      <div className="mobility-target-grid" />
      <div className="mobility-silhouette"><span /><i /><b /></div>
      <div className="mobility-target-copy"><strong>ALIGNMENT GATE</strong><small>FULL BODY / LOCAL POSE TRACKING</small></div>
      <span className="mobility-target-corner corner-a" /><span className="mobility-target-corner corner-b" />
    </button>
    <div className="mobility-readout"><div><span>POSE ENGINE</span><b className="tone-green">STANDBY</b></div><div><span>ALIGNMENT</span><b>AWAITING FEED</b></div><div><span>LAST CHECK</span><b>06:18 UTC</b></div></div>
    <button className="command-primary" style={{ pointerEvents: 'auto' }} onClick={onOpenMobility}><Camera size={15} /> OPEN CAMERA CALIBRATION <span>↗</span></button>
  </aside>
}

function DecisionConsole({ activeAlert, alertCount, onOpenBriefing, onApplyCountermeasure, voice }) {
  return <aside className={`${LIQUID_GLASS_CLASSES} liquid-glass-surface command-right command-panel glass-panel`}>
    <PanelHeader index="03" title="Mission watch" status={activeAlert ? `${alertCount} OPEN` : 'ALL CLEAR'} tone={activeAlert ? 'amber' : 'green'} />
    <div className={`watch-banner ${activeAlert ? 'has-alert' : ''}`}><StatusDot tone={activeAlert ? 'amber' : 'green'} /><div><strong>{activeAlert ? activeAlert.title : 'Operating envelope nominal'}</strong><small>{activeAlert ? activeAlert.body : 'No immediate countermeasure required.'}</small></div></div>
    {activeAlert && <button className="command-alert-action" style={{ pointerEvents: 'auto' }} onClick={onApplyCountermeasure}><Sparkles size={14} /> APPLY COUNTERMEASURE <span>↗</span></button>}
    <button className={`${LIQUID_GLASS_CLASSES} liquid-glass-surface briefing-card`} style={{ pointerEvents: 'auto' }} onClick={onOpenBriefing}><div><span className="command-eyebrow">NEXT CREW ACTION</span><strong>Daily recovery briefing</strong><small>Sleep · stress · mission readiness</small></div><Clock3 size={18} /></button>
    <div className="voice-console"><div><Mic size={14} /><span>VOICE LINK</span></div><strong>{voice?.isListening ? 'LISTENING...' : 'READY FOR COMMAND'}</strong><small>{voice?.transcript || '“Run daily briefing”'}</small></div>
  </aside>
}

function CommandCenterGrid({ healthScore, alertCount, queueLength, activeAlert, voice, onOpenMobility, onOpenBriefing, onApplyCountermeasure }) {
  return <Html fullscreen transform={false} style={{ pointerEvents: 'none' }}>
    <div className="command-center-shell">
      <header className={`${LIQUID_GLASS_CLASSES} liquid-glass-surface command-topbar command-panel glass-panel`}>
        <div className="command-brand"><span className="command-brand-mark">◈</span><div><span className="command-eyebrow">AURORA MEDICAL // HAB-01</span><strong>ORBITAL <i>HEALTH</i></strong></div></div>
        <div className="command-mission"><span>MISSION DAY 184 · STATION LOCAL</span><b>06:42:18 UTC</b><em><StatusDot tone="green" /> SYSTEM ONLINE / DELAY 00:03:42</em></div>
        <div className="command-score"><span>UNIFIED READINESS</span><strong>{healthScore}%</strong></div>
        <button className={`command-voice ${voice?.isListening ? 'is-listening' : ''}`} style={{ pointerEvents: 'auto' }} onClick={voice?.isListening ? voice.stopListening : voice?.startListening} aria-label="Toggle voice commands"><Mic size={15} />{voice?.isListening ? 'LISTENING' : 'VOICE LINK'}</button>
      </header>

      <MobilityConsole onOpenMobility={onOpenMobility} />
      <section className={`${LIQUID_GLASS_CLASSES} liquid-glass-surface command-center command-panel glass-panel`}>
        <PanelHeader index="02" title="Unified health matrix" status={healthScore >= 85 ? 'OPTIMAL' : 'REVIEW'} tone={healthScore >= 85 ? 'green' : 'amber'} />
        <div className="matrix-intro"><div><span className="command-eyebrow">CREW MEMBER / A. RIVERA</span><strong>Mission physiology overview</strong></div><div className="matrix-sync"><Activity size={14} /><span>LIVE MODEL</span><b>v2.4</b></div></div>
        <div className="glass-metric-grid">{healthMetrics.map((metric) => <GlassMetric key={metric.label} metric={metric} />)}</div>
        <div className="core-score-strip"><div><span>MISSION HEALTH CORE</span><strong>{healthScore}%</strong></div><div><span>LOCAL OUTBOX</span><strong>{queueLength}</strong></div><div><span>OPEN ASSESSMENTS</span><strong className={alertCount ? 'tone-amber' : 'tone-green'}>{alertCount}</strong></div><div><span>MODEL CONFIDENCE</span><strong>94%</strong></div></div>
      </section>
      <DecisionConsole activeAlert={activeAlert} alertCount={alertCount} onOpenBriefing={onOpenBriefing} onApplyCountermeasure={onApplyCountermeasure} voice={voice} />

      <nav className="command-tabs" aria-label="Dashboard modules">{moduleTabs.map((tab, index) => <button key={tab.label} className={index === 0 ? 'is-active' : ''} style={{ pointerEvents: 'auto' }} onClick={index === 1 ? onOpenMobility : index === 3 ? onOpenBriefing : undefined}><CheckCircle2 size={13} /><span>{tab.label}</span><small>{tab.detail}</small></button>)}</nav>
      <div className="command-footnote">OFFLINE-FIRST · ENCRYPTED LOCAL STORE · CLINICAL DECISION SUPPORT, NOT A DIAGNOSIS <span>◈</span> ALL TELEMETRY LOCAL TO HAB-01</div>
    </div>
  </Html>
}

export default function DashboardLayout({ healthScore, alertCount, queueLength, activeAlert, voice, onSelectMetric, onOpenMobility, onOpenBriefing, onApplyCountermeasure }) {
  return <group><MissionHealthCore healthScore={healthScore} queueLength={queueLength} alertCount={alertCount} onSelect={onSelectMetric} showReadout={false} /><CommandCenterGrid healthScore={healthScore} alertCount={alertCount} queueLength={queueLength} activeAlert={activeAlert} voice={voice} onOpenMobility={onOpenMobility} onOpenBriefing={onOpenBriefing} onApplyCountermeasure={onApplyCountermeasure} /></group>
}
