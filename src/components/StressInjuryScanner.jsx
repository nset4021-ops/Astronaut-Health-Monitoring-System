import { useEffect, useRef, useState } from 'react'
import { Activity, Brain, Camera, CircleAlert, HeartPulse, Moon, X } from 'lucide-react'
import './stress-injury-scanner.css'

const INITIAL_METRICS = [
  { id: 'stress', label: 'CORTISOL / STRESS PROXY', value: 28, unit: '/ 100', detail: 'HRV 64 ms · facial tension low', icon: HeartPulse },
  { id: 'strain', label: 'MUSCULOSKELETAL STRAIN', value: 36, unit: '/ 100', detail: 'Shoulder + right knee load', icon: Activity },
  { id: 'fatigue', label: 'CELLULAR / FATIGUE INDEX', value: 42, unit: '/ 100', detail: 'Sleep debt 1.8 h · alertness 78%', icon: Moon },
]

function triage(value) {
  if (value >= 70) return { label: 'CRITICAL ACTION REQUIRED', tone: 'critical' }
  if (value >= 45) return { label: 'ELEVATED WARNING', tone: 'warning' }
  return { label: 'OPTIMAL', tone: 'optimal' }
}

function MetricCard({ metric }) {
  const Icon = metric.icon
  const state = triage(metric.value)
  return <article className={`stress-metric-card is-${state.tone}`}>
    <div className="stress-metric-heading"><Icon size={17} /><span>{metric.label}</span><CircleAlert size={14} /></div>
    <div className="stress-metric-number"><strong>{metric.value}</strong><small>{metric.unit}</small></div>
    <div className="stress-metric-track"><span style={{ width: `${metric.value}%` }} /></div>
    <div className="stress-metric-footer"><b>{state.label}</b><small>{metric.detail}</small></div>
  </article>
}

export default function StressInjuryScanner({ onClose }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [metrics, setMetrics] = useState(INITIAL_METRICS)
  const [cameraState, setCameraState] = useState('standby')
  const [scanPhase, setScanPhase] = useState(18)

  useEffect(() => {
    const telemetryTimer = window.setInterval(() => {
      setMetrics((current) => current.map((metric, index) => ({
        ...metric,
        value: Math.max(12, Math.min(88, metric.value + (Math.random() - 0.52) * (index === 1 ? 5 : 3))),
      })))
      setScanPhase((phase) => (phase + 7) % 100)
    }, 1400)
    return () => window.clearInterval(telemetryTimer)
  }, [])

  useEffect(() => () => streamRef.current?.getTracks().forEach((track) => track.stop()), [])

  const initializeCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) return setCameraState('unavailable')
    setCameraState('requesting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
      streamRef.current = stream
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      setCameraState('active')
    } catch {
      setCameraState('denied')
    }
  }

  const overall = Math.round(metrics.reduce((sum, metric) => sum + metric.value, 0) / metrics.length)
  const overallState = triage(overall)

  return <div className="stress-scanner-layer"><section className="stress-scanner-modal" role="dialog" aria-modal="true" aria-labelledby="stress-scanner-title">
    <header className="stress-scanner-header"><div><span className="stress-scanner-eyebrow">AURORA MEDICAL // BIOMETRIC TRIAGE</span><h2 id="stress-scanner-title">Stress & injury scanner</h2></div><button className="stress-scanner-close" onClick={onClose} aria-label="Close stress and injury scanner"><X size={20} /></button></header>
    <div className="stress-scanner-grid">
      <div className="stress-scan-viewport">
        <video ref={videoRef} muted playsInline aria-label="Local astronaut biometric camera feed" />
        <div className="stress-scan-placeholder"><Camera size={28} /><strong>{cameraState === 'active' ? 'LIVE SENSOR FEED' : 'SIMULATED SENSOR FEED'}</strong><small>{cameraState === 'denied' ? 'CAMERA DENIED / TELEMETRY SIMULATION CONTINUES' : 'LOCAL PROCESSING / NO VIDEO UPLINK'}</small></div>
        <div className="stress-scan-grid-lines" /><div className="stress-scan-sweep" style={{ top: `${scanPhase}%` }} />
        <span className="stress-scan-chip">{cameraState === 'active' ? 'CAMERA LINKED' : 'SENSOR MODEL ACTIVE'}</span><span className="stress-scan-corner">SCAN // {String(Math.round(scanPhase)).padStart(3, '0')}%</span>
        <div className="stress-heatmap heatmap-shoulder" /><div className="stress-heatmap heatmap-knee" /><span className="stress-zone-label zone-shoulder">R SHOULDER / LOAD</span><span className="stress-zone-label zone-knee">R KNEE / FATIGUE</span>
      </div>
      <aside className="stress-scan-summary"><span className="stress-scanner-eyebrow">TRIAGE STATUS</span><strong className={`stress-overall is-${overallState.tone}`}>{overallState.label}</strong><div className="stress-overall-score"><b>{overall}</b><span>COMPOSITE<br />LOAD INDEX</span></div><p>Signal fusion combines HRV variance, facial tension proxy, recent mobility logs, sleep debt, and cognitive alertness.</p><button className="stress-camera-button" onClick={initializeCamera} disabled={cameraState === 'requesting'}><Camera size={15} />{cameraState === 'active' ? 'CAMERA LINK ACTIVE' : cameraState === 'requesting' ? 'REQUESTING ACCESS...' : 'LINK LIVE CAMERA'}</button></aside>
    </div>
    <div className="stress-metric-grid">{metrics.map((metric) => <MetricCard key={metric.id} metric={metric} />)}</div>
    <footer className="stress-scanner-footer"><span><Brain size={14} /> COGNITIVE ALERTNESS 78%</span><span>LAST MOBILITY LOG 06:18 UTC</span><span>LOCAL SCREENING ONLY · NOT A DIAGNOSIS</span></footer>
  </section></div>
}

export { INITIAL_METRICS, triage }
