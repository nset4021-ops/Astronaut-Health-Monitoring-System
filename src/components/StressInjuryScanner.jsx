import { useEffect, useRef, useState } from 'react'
import { Activity, Brain, Camera, Download, HeartPulse, Moon, RotateCcw, ScanLine, X } from 'lucide-react'
import './stress-injury-scanner.css'

const INITIAL_METRICS = [
  { id: 'stress', label: 'CORTISOL / HRV STRESS INDEX', value: 28, detail: 'HRV 64 ms · facial tension low', icon: HeartPulse },
  { id: 'strain', label: 'MUSCULOSKELETAL STRAIN', value: 36, detail: 'Shoulder + right knee load', icon: Activity },
  { id: 'fatigue', label: 'CIRCADIAN / SLEEP DEBT', value: 42, detail: 'Sleep debt 1.8 h · alertness 78%', icon: Moon },
]
const HEAT_ZONES = [{ label: 'SHOULDERS', value: 34 }, { label: 'SPINE', value: 22 }, { label: 'KNEES', value: 48 }, { label: 'LOWER BACK', value: 39 }]
const FACE_METRICS = [
  { id: 'facial-stress', label: 'CORTISOL / HRV STRESS INDEX', value: 31, detail: 'HRV variance · micro-tension proxy', icon: HeartPulse },
  { id: 'sleep-debt', label: 'ESTIMATED SLEEP DEBT', value: 44, detail: 'Circadian recovery model · 1.8 h', icon: Moon },
  { id: 'blink-fatigue', label: 'EYE / BLINK FATIGUE INDEX', value: 26, detail: 'Blink cadence · gaze stability', icon: Brain },
]
const BODY_METRICS = INITIAL_METRICS

function triage(value) {
  if (value >= 70) return { label: 'CRITICAL', tone: 'critical' }
  if (value >= 45) return { label: 'ELEVATED WARNING', tone: 'warning' }
  return { label: 'OPTIMAL', tone: 'optimal' }
}

function classifyPresentation(faceResult, poseResult) {
  const face = faceResult?.faceLandmarks?.[0]
  const pose = poseResult?.landmarks?.[0]
  if (face?.length) {
    const bounds = face.reduce((box, landmark) => ({ minX: Math.min(box.minX, landmark.x), maxX: Math.max(box.maxX, landmark.x), minY: Math.min(box.minY, landmark.y), maxY: Math.max(box.maxY, landmark.y) }), { minX: 1, maxX: 0, minY: 1, maxY: 0 })
    if (bounds.maxX - bounds.minX >= 0.22) return 'face'
  }
  if (pose?.filter((landmark) => (landmark.visibility ?? 0) >= 0.45).length >= 8) {
    const visible = pose.filter((landmark) => (landmark.visibility ?? 0) >= 0.45)
    const span = Math.max(...visible.map((landmark) => landmark.y)) - Math.min(...visible.map((landmark) => landmark.y))
    if (span >= 0.42) return 'body'
  }
  return 'standby'
}

function RadialDial({ label, value }) {
  return <div className="scanner-radial" style={{ '--scanner-angle': `${value * 3.6}deg` }}><div><strong>{value}%</strong><span>{label}</span></div></div>
}

function BiomarkerCard({ metric }) {
  const Icon = metric.icon
  const state = triage(metric.value)
  return <article className={`scanner-biomarker-card is-${state.tone}`}><div className="scanner-card-heading"><Icon size={15} /><span>{metric.label}</span><b>{state.label}</b></div><div className="scanner-card-value"><strong>{metric.value}</strong><small>/ 100</small><i>{metric.detail}</i></div><div className="scanner-progress"><span style={{ width: `${metric.value}%` }} /></div><div className="scanner-card-foot"><span>LIVE PROXY SIGNAL</span><em>{metric.value >= 45 ? 'REVIEW LOAD' : 'WITHIN ENVELOPE'}</em></div></article>
}

function HeatmapCard({ zones }) {
  return <article className="scanner-heatmap-card"><div className="scanner-card-heading"><Activity size={15} /><span>MICROGRAVITY FATIGUE HEATMAP</span><b>LOCAL MODEL</b></div><div className="scanner-heatmap-body"><div className="scanner-body-map"><span className="body-head" /><span className="body-spine" /><span className="body-zone zone-shoulders" /><span className="body-zone zone-spine" /><span className="body-zone zone-knees" /><span className="body-zone zone-back" /></div><div className="scanner-zone-list">{zones.map((zone) => <div key={zone.label}><span>{zone.label}</span><i><b style={{ width: `${zone.value}%` }} /></i><strong>{zone.value}</strong></div>)}</div></div></article>
}

export default function StressInjuryScanner({ onClose }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const detectorsRef = useRef({ face: null, pose: null })
  const detectionFrameRef = useRef(null)
  const [metrics, setMetrics] = useState(INITIAL_METRICS)
  const [zones, setZones] = useState(HEAT_ZONES)
  const [cameraState, setCameraState] = useState('standby')
  const [scanMode, setScanMode] = useState('standby')
  const [modeOverride, setModeOverride] = useState('auto')
  const [modelState, setModelState] = useState('standby')
  const [scanPhase, setScanPhase] = useState(18)
  const [scanState, setScanState] = useState('ready')

  const activeMode = modeOverride === 'auto' ? scanMode : modeOverride

  useEffect(() => {
    if (activeMode === 'face') setMetrics(FACE_METRICS)
    if (activeMode === 'body') setMetrics(BODY_METRICS)
  }, [activeMode])

  useEffect(() => {
    const telemetryTimer = window.setInterval(() => {
      setMetrics((current) => current.map((metric, index) => ({ ...metric, value: Math.max(12, Math.min(88, Math.round(metric.value + (Math.random() - 0.52) * (index === 1 ? 5 : 3)))) })))
      setZones((current) => current.map((zone) => ({ ...zone, value: Math.max(8, Math.min(86, Math.round(zone.value + (Math.random() - 0.5) * 4))) })))
      setScanPhase((phase) => (phase + 7) % 100)
    }, 1400)
    return () => window.clearInterval(telemetryTimer)
  }, [])
  useEffect(() => () => {
    if (detectionFrameRef.current) cancelAnimationFrame(detectionFrameRef.current)
    detectorsRef.current.face?.close?.()
    detectorsRef.current.pose?.close?.()
    streamRef.current?.getTracks().forEach((track) => track.stop())
  }, [])

  const stopDetection = () => {
    if (detectionFrameRef.current) cancelAnimationFrame(detectionFrameRef.current)
    detectionFrameRef.current = null
    detectorsRef.current.face?.close?.()
    detectorsRef.current.pose?.close?.()
    detectorsRef.current = { face: null, pose: null }
    setModelState('standby')
  }

  const startAdaptiveDetection = async () => {
    try {
      setModelState('loading')
      const { FaceLandmarker, FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision')
      const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm')
      const [face, pose] = await Promise.all([
        FaceLandmarker.createFromOptions(vision, { baseOptions: { delegate: 'GPU', modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task' }, numFaces: 1, runningMode: 'VIDEO' }),
        PoseLandmarker.createFromOptions(vision, { baseOptions: { delegate: 'GPU', modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task' }, runningMode: 'VIDEO' }),
      ])
      detectorsRef.current = { face, pose }
      setModelState('active')
      const detectFrame = () => {
        const video = videoRef.current
        if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !detectorsRef.current.face || !detectorsRef.current.pose) return
        const timestamp = performance.now()
        const faceResult = detectorsRef.current.face.detectForVideo(video, timestamp)
        const poseResult = detectorsRef.current.pose.detectForVideo(video, timestamp)
        setScanMode(classifyPresentation(faceResult, poseResult))
        detectionFrameRef.current = requestAnimationFrame(detectFrame)
      }
      detectFrame()
    } catch {
      setModelState('fallback')
      setScanMode('standby')
    }
  }

  const initializeCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) return setCameraState('unavailable')
    setCameraState('requesting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
      streamRef.current = stream; videoRef.current.srcObject = stream; await videoRef.current.play(); setCameraState('active'); startAdaptiveDetection()
    } catch { setCameraState('denied') }
  }
  const runScan = () => { setScanState('scanning'); setScanPhase(0); window.setTimeout(() => setScanState('complete'), 1800) }
  const exportMissionLog = () => {
    const packet = { recordedAt: new Date().toISOString(), type: 'stress-injury-scan', compositeIndex: overall, triage: overallState.label, biomarkers: metrics, heatmap: zones, source: cameraState === 'active' ? 'local-camera-sensor-fusion' : 'simulated-local-sensor' }
    const download = document.createElement('a')
    download.href = URL.createObjectURL(new Blob([JSON.stringify(packet, null, 2)], { type: 'application/json' }))
    download.download = `mission-biometric-scan-${Date.now()}.json`
    download.click()
    URL.revokeObjectURL(download.href)
  }
  const overall = Math.round(metrics.reduce((sum, metric) => sum + metric.value, 0) / metrics.length)
  const overallState = triage(overall)
  const modePrompt = activeMode === 'face' ? 'Face detected: initializing cortisol & sleep scan' : activeMode === 'body' ? 'Full body detected: scanning musculoskeletal alignment' : 'Present face close-up or step back for full-body stance'
  const modeLabel = activeMode === 'face' ? 'FACE / MICRO-DIAGNOSTICS' : activeMode === 'body' ? 'BODY / MACRO-DIAGNOSTICS' : 'ADAPTIVE / SEARCHING'

  return <div className="stress-scanner-layer"><section className="stress-scanner-modal" role="dialog" aria-modal="true" aria-labelledby="stress-scanner-title">
    <header className="stress-scanner-header"><div><span className="stress-scanner-eyebrow">AURORA MEDICAL // BIOMETRIC TRIAGE</span><h2 id="stress-scanner-title">Stress & injury command station</h2></div><div className="stress-scanner-header-status"><span>{scanState === 'scanning' ? 'FULL SPECTRUM SWEEP' : 'LOCAL SENSOR LINK'}</span><button className="stress-scanner-close" onClick={() => { stopDetection(); streamRef.current?.getTracks().forEach((track) => track.stop()); onClose?.() }} aria-label="Close stress and injury scanner"><X size={18} /></button></div></header>
    <div className="stress-scanner-workspace"><div className={`stress-scan-portal is-${activeMode}`}><div className="stress-portal-guidance"><span>{modeLabel}</span><strong>{modePrompt}</strong><small>{modelState === 'active' ? 'FACE LANDMARK + POSE LANDMARK PIPELINE ACTIVE' : modelState === 'fallback' ? 'MODEL LINK UNAVAILABLE / SIMULATED TELEMETRY' : 'CAMERA LINK REQUIRED FOR ADAPTIVE DETECTION'}</small></div><video ref={videoRef} muted playsInline aria-label="Local astronaut biometric camera feed" /><div className="stress-scan-placeholder"><Camera size={25} /><strong>{cameraState === 'active' ? 'LIVE BIOMETRIC FEED' : 'SIMULATED SENSOR FEED'}</strong><small>{cameraState === 'denied' ? 'CAMERA DENIED / TELEMETRY SIMULATION CONTINUES' : 'LOCAL PROCESSING / NO VIDEO UPLINK'}</small></div><div className="stress-scan-grid-lines" /><div className={`stress-scan-wireframe ${activeMode}`} /><div className="stress-scan-sweep" style={{ top: `${scanPhase}%` }} /><span className="stress-scan-chip">{cameraState === 'active' ? 'CAMERA LINKED' : 'SENSOR MODEL ACTIVE'}</span><span className="stress-scan-corner">SWEEP // {String(Math.round(scanPhase)).padStart(3, '0')}%</span><div className="stress-scan-crosshair" /><div className="stress-heatmap heatmap-shoulder" /><div className="stress-heatmap heatmap-knee" /><span className="stress-zone-label zone-shoulder">R SHOULDER / LOAD</span><span className="stress-zone-label zone-knee">R KNEE / FATIGUE</span><div className="stress-portal-footer"><span><ScanLine size={13} /> {scanState === 'scanning' ? 'SCANNING ALL BIOMARKERS' : activeMode === 'face' ? 'FACIAL MICRO-TENSION GRID READY' : activeMode === 'body' ? 'SKELETAL HEATMAP READY' : 'ADAPTIVE SENSOR GRID READY'}</span><span>UNMIRRORED STATUS LAYER</span><button type="button" onClick={() => setModeOverride(modeOverride === 'auto' ? 'face' : modeOverride === 'face' ? 'body' : 'auto')}>MODE: {modeOverride.toUpperCase()}</button></div></div><aside className="stress-telemetry-panel"><div className="stress-triage-heading"><div><span className="stress-scanner-eyebrow">{modeLabel}</span><h3>{overallState.label}</h3></div><RadialDial label="LOAD" value={overall} /></div><div className="stress-biomarker-stack">{metrics.map((metric) => <BiomarkerCard key={metric.id} metric={metric} />)}{activeMode === 'body' ? <HeatmapCard zones={zones} /> : <article className="scanner-heatmap-card scanner-face-detail"><div className="scanner-card-heading"><Brain size={15} /><span>FACIAL MICRO-DIAGNOSTICS</span><b>LANDMARK MODEL</b></div><div className="scanner-face-readout"><span>BLINK FATIGUE</span><strong>26%</strong><i><b style={{ width: '26%' }} /></i><span>MICRO-TENSION</span><strong>31%</strong><i><b style={{ width: '31%' }} /></i><span>GAZE STABILITY</span><strong>82%</strong><i><b style={{ width: '82%' }} /></i></div></article>}</div><div className="stress-cognition-strip"><Brain size={14} /><span>{activeMode === 'face' ? 'EYE / BLINK FATIGUE' : 'COGNITIVE ALERTNESS'}</span><strong>{activeMode === 'face' ? '26%' : '78%'}</strong><i><b style={{ width: activeMode === 'face' ? '26%' : '78%' }} /></i></div></aside></div>
    <footer className="stress-control-dock"><div className="stress-dock-readout"><span>MISSION BIOMETRICS / HAB-01</span><strong>{scanState === 'complete' ? 'SWEEP COMPLETE · LOG READY' : scanState === 'scanning' ? 'COLLECTING SIGNALS...' : 'READY FOR FULL SPECTRUM SWEEP'}</strong></div><div className="stress-dock-actions"><button className="stress-dock-secondary" onClick={initializeCamera} disabled={cameraState === 'requesting'}><Camera size={14} />{cameraState === 'active' ? 'CAMERA LINKED' : 'CALIBRATE SENSORS'}</button><button className="stress-dock-primary" onClick={runScan} disabled={scanState === 'scanning'}><ScanLine size={14} /> RUN FULL SPECTRUM SCAN</button><button className="stress-dock-secondary" onClick={exportMissionLog}><Download size={14} /> EXPORT TO MISSION LOG</button><button className="stress-dock-icon" onClick={() => { setMetrics(INITIAL_METRICS); setZones(HEAT_ZONES); setScanState('ready') }} aria-label="Reset scanner telemetry" title="Reset scanner telemetry"><RotateCcw size={14} /></button></div></footer>
  </section></div>
}

export { INITIAL_METRICS, triage }
