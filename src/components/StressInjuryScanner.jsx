import { useEffect, useRef, useState } from 'react'
import { Activity, Brain, Camera, Download, HeartPulse, Moon, RotateCcw, ScanLine, X } from 'lucide-react'
import { exportStressInjuryScan } from '../lib/pdfExport'
import './stress-injury-scanner.css'

const INITIAL_METRICS = [
  { id: 'stress', label: 'POSTURAL LOAD PROXY', value: 28, detail: 'Awaiting local landmark analysis', icon: HeartPulse },
  { id: 'strain', label: 'MUSCULOSKELETAL LOAD PROXY', value: 36, detail: 'Awaiting shoulder, trunk, and knee geometry', icon: Activity },
  { id: 'fatigue', label: 'MOVEMENT FATIGUE PROXY', value: 42, detail: 'Awaiting temporal posture analysis', icon: Moon },
]
const HEAT_ZONES = [{ label: 'SHOULDERS', value: 34 }, { label: 'SPINE', value: 22 }, { label: 'KNEES', value: 48 }, { label: 'LOWER BACK', value: 39 }]
const FACE_METRICS = [
  { id: 'facial-stress', label: 'FACIAL TENSION PROXY', value: 31, detail: 'Awaiting brow and eye geometry', icon: HeartPulse },
  { id: 'sleep-debt', label: 'EYE FATIGUE PROXY', value: 44, detail: 'Awaiting eyelid openness and blink cadence', icon: Moon },
  { id: 'blink-fatigue', label: 'BLINK FATIGUE PROXY', value: 26, detail: 'Awaiting temporal blink analysis', icon: Brain },
]
const BODY_METRICS = [
  { id: 'stress', label: 'POSTURAL LOAD PROXY', value: 28, detail: 'Awaiting shoulder and trunk geometry', icon: HeartPulse },
  { id: 'strain', label: 'MUSCULOSKELETAL LOAD PROXY', value: 36, detail: 'Awaiting shoulder, trunk, and knee geometry', icon: Activity },
  { id: 'fatigue', label: 'MOVEMENT FATIGUE PROXY', value: 42, detail: 'Awaiting temporal posture analysis', icon: Moon },
]
const LEFT_EYE = [33, 160, 158, 133, 153, 144]
const RIGHT_EYE = [362, 385, 387, 263, 373, 380]
const FACE_WIDTH_POINTS = [234, 454]
const METRIC_UPDATE_INTERVAL_MS = 180

function triage(value) {
  if (value >= 70) return { label: 'CRITICAL', tone: 'critical' }
  if (value >= 45) return { label: 'ELEVATED WARNING', tone: 'warning' }
  return { label: 'OPTIMAL', tone: 'optimal' }
}

function clamp(value, minimum = 0, maximum = 100) {
  return Math.round(Math.min(maximum, Math.max(minimum, value)))
}

function distance(first, second) {
  return Math.hypot(first.x - second.x, first.y - second.y, (first.z || 0) - (second.z || 0))
}

function eyeAspectRatio(landmarks, indexes) {
  const points = indexes.map((index) => landmarks[index])
  if (points.some((point) => !point)) return null
  const width = distance(points[0], points[3])
  return width ? (distance(points[1], points[5]) + distance(points[2], points[4])) / (2 * width) : null
}

function averagePoint(points) {
  if (!points.length) return null
  const sum = points.reduce((total, point) => ({ x: total.x + point.x, y: total.y + point.y, z: total.z + (point.z || 0) }), { x: 0, y: 0, z: 0 })
  return { x: sum.x / points.length, y: sum.y / points.length, z: sum.z / points.length }
}

function faceWidth(landmarks) {
  const [left, right] = FACE_WIDTH_POINTS.map((index) => landmarks[index])
  return left && right ? distance(left, right) : null
}

function analyzeFace(faceLandmarks, temporalState, timestamp) {
  const landmarks = faceLandmarks?.[0]
  if (!landmarks || landmarks.length < 455) return null
  const leftEar = eyeAspectRatio(landmarks, LEFT_EYE)
  const rightEar = eyeAspectRatio(landmarks, RIGHT_EYE)
  const eyeOpenness = leftEar !== null && rightEar !== null ? (leftEar + rightEar) / 2 : null
  const width = faceWidth(landmarks)
  if (eyeOpenness === null || !width) return null

  const closed = eyeOpenness < 0.19
  if (temporalState.previousEyeOpen && closed && timestamp - temporalState.lastBlinkAt > 250) {
    temporalState.blinkTimes.push(timestamp)
    temporalState.lastBlinkAt = timestamp
  }
  temporalState.previousEyeOpen = !closed
  temporalState.eyeSamples.push({ timestamp, eyeOpenness })
  while (temporalState.eyeSamples[0] && timestamp - temporalState.eyeSamples[0].timestamp > 30000) temporalState.eyeSamples.shift()
  while (temporalState.blinkTimes[0] && timestamp - temporalState.blinkTimes[0] > 30000) temporalState.blinkTimes.shift()

  const blinkRate = temporalState.blinkTimes.length * 2
  const eyeFatigue = clamp((0.27 - eyeOpenness) * 260 + Math.min(35, blinkRate * 1.5))
  const browLeft = landmarks[70]
  const browRight = landmarks[300]
  const eyeLeft = landmarks[159]
  const eyeRight = landmarks[386]
  const browCompression = browLeft && browRight && eyeLeft && eyeRight
    ? ((Math.abs(browLeft.y - eyeLeft.y) + Math.abs(browRight.y - eyeRight.y)) / 2) / width
    : 0.08
  const tension = clamp((0.085 - browCompression) * 900)

  return {
    metrics: [
      { id: 'facial-stress', value: tension, detail: `Brow compression proxy · eye openness ${eyeOpenness.toFixed(2)}` },
      { id: 'sleep-debt', value: eyeFatigue, detail: `Blink cadence ${blinkRate}/min · eye openness ${eyeOpenness.toFixed(2)}` },
      { id: 'blink-fatigue', value: clamp(eyeFatigue * 0.7 + tension * 0.3), detail: `Temporal blink and eyelid-closure proxy · ${temporalState.eyeSamples.length} samples` },
    ],
  }
}

function analyzePose(poseLandmarks) {
  const landmarks = poseLandmarks?.[0]
  if (!landmarks) return null
  const visible = landmarks.filter((landmark) => (landmark.visibility ?? 0) >= 0.45)
  const byIndex = (index) => landmarks[index] && (landmarks[index].visibility ?? 0) >= 0.45 ? landmarks[index] : null
  const leftShoulder = byIndex(11)
  const rightShoulder = byIndex(12)
  const leftHip = byIndex(23)
  const rightHip = byIndex(24)
  const leftKnee = byIndex(25)
  const rightKnee = byIndex(26)
  if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) return null

  const shoulderMidpoint = averagePoint([leftShoulder, rightShoulder])
  const hipMidpoint = averagePoint([leftHip, rightHip])
  const shoulderTilt = Math.abs(Math.atan2(leftShoulder.y - rightShoulder.y, leftShoulder.x - rightShoulder.x) * 180 / Math.PI)
  const trunkLean = Math.abs(Math.atan2(hipMidpoint.x - shoulderMidpoint.x, shoulderMidpoint.y - hipMidpoint.y) * 180 / Math.PI)
  const kneeAsymmetry = leftKnee && rightKnee ? Math.abs(leftKnee.y - rightKnee.y) * 220 : 0
  const confidence = clamp(visible.reduce((sum, landmark) => sum + (landmark.visibility ?? 0), 0) / Math.max(1, visible.length) * 100)
  const shoulderLoad = clamp(shoulderTilt * 4 + trunkLean * 1.4)
  const spineLoad = clamp(trunkLean * 4.2)
  const kneeLoad = clamp(kneeAsymmetry)
  const lowerBackLoad = clamp(trunkLean * 3.2 + shoulderTilt * 1.5)

  return {
    confidence,
    metrics: [
      { id: 'stress', value: clamp(shoulderLoad * 0.55 + spineLoad * 0.45), detail: `Postural asymmetry proxy · ${confidence}% landmark confidence` },
      { id: 'strain', value: clamp((shoulderLoad + kneeLoad + lowerBackLoad) / 3), detail: `Shoulder tilt ${Math.round(shoulderTilt)}° · trunk lean ${Math.round(trunkLean)}°` },
      { id: 'fatigue', value: clamp((spineLoad + kneeLoad) / 2), detail: `Knee asymmetry ${Math.round(kneeAsymmetry)} · trunk stability proxy` },
    ],
    zones: [
      { label: 'SHOULDERS', value: shoulderLoad },
      { label: 'SPINE', value: spineLoad },
      { label: 'KNEES', value: kneeLoad },
      { label: 'LOWER BACK', value: lowerBackLoad },
    ],
  }
}

function mergeMetrics(current, updates) {
  const updateMap = new Map(updates.map((metric) => [metric.id, metric]))
  return current.map((metric) => updateMap.get(metric.id) ? { ...metric, ...updateMap.get(metric.id) } : metric)
}

function averageSamples(samples, fallback) {
  if (!samples.length) return fallback
  const metricIds = samples[0].metrics.map((metric) => metric.id)
  const metrics = metricIds.map((id) => {
    const values = samples.map((sample) => sample.metrics.find((metric) => metric.id === id)?.value).filter(Number.isFinite)
    const template = samples[samples.length - 1].metrics.find((metric) => metric.id === id)
    return { ...template, value: clamp(values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length)) }
  })
  const zoneLabels = samples[0].zones.map((zone) => zone.label)
  const zones = zoneLabels.map((label) => {
    const values = samples.map((sample) => sample.zones.find((zone) => zone.label === label)?.value).filter(Number.isFinite)
    return { label, value: clamp(values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length)) }
  })
  return { metrics, zones }
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
  const temporalStateRef = useRef({ previousEyeOpen: true, blinkTimes: [], lastBlinkAt: 0, eyeSamples: [] })
  const lastMetricsUpdateRef = useRef(0)
  const scanActiveRef = useRef(false)
  const scanSamplesRef = useRef([])
  const scanTimerRef = useRef(null)
  const [metrics, setMetrics] = useState(INITIAL_METRICS)
  const [zones, setZones] = useState(HEAT_ZONES)
  const [cameraState, setCameraState] = useState('standby')
  const [scanMode, setScanMode] = useState('standby')
  const [modeOverride, setModeOverride] = useState('auto')
  const [modelState, setModelState] = useState('standby')
  const [scanPhase, setScanPhase] = useState(18)
  const [scanState, setScanState] = useState('ready')
  const [scanReport, setScanReport] = useState(null)
  const [exportError, setExportError] = useState('')

  const activeMode = modeOverride === 'auto' ? scanMode : modeOverride

  useEffect(() => {
    if (activeMode === 'face') setMetrics(FACE_METRICS)
    if (activeMode === 'body') setMetrics(BODY_METRICS)
  }, [activeMode])

  useEffect(() => {
    const sweepTimer = window.setInterval(() => {
      if (scanState === 'scanning') setScanPhase((phase) => (phase + 7) % 100)
    }, 140)
    return () => window.clearInterval(sweepTimer)
  }, [scanState])
  useEffect(() => () => {
    if (detectionFrameRef.current) cancelAnimationFrame(detectionFrameRef.current)
    if (scanTimerRef.current) window.clearTimeout(scanTimerRef.current)
    detectorsRef.current.face?.close?.()
    detectorsRef.current.pose?.close?.()
    streamRef.current?.getTracks().forEach((track) => track.stop())
  }, [])

  const stopDetection = () => {
    if (detectionFrameRef.current) cancelAnimationFrame(detectionFrameRef.current)
    if (scanTimerRef.current) window.clearTimeout(scanTimerRef.current)
    detectionFrameRef.current = null
    scanTimerRef.current = null
    scanActiveRef.current = false
    detectorsRef.current.face?.close?.()
    detectorsRef.current.pose?.close?.()
    detectorsRef.current = { face: null, pose: null }
    temporalStateRef.current = { previousEyeOpen: true, blinkTimes: [], lastBlinkAt: 0, eyeSamples: [] }
    lastMetricsUpdateRef.current = 0
    scanActiveRef.current = false
    scanSamplesRef.current = []
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
        const detectedMode = classifyPresentation(faceResult, poseResult)
        const selectedMode = modeOverride === 'auto' ? detectedMode : modeOverride
        setScanMode(detectedMode)
        if (timestamp - lastMetricsUpdateRef.current >= METRIC_UPDATE_INTERVAL_MS) {
          lastMetricsUpdateRef.current = timestamp
          const faceAnalysis = analyzeFace(faceResult.faceLandmarks, temporalStateRef.current, timestamp)
          const poseAnalysis = analyzePose(poseResult.landmarks)
          if (selectedMode === 'face' && faceAnalysis) setMetrics((current) => mergeMetrics(current, faceAnalysis.metrics))
          if (selectedMode === 'body' && poseAnalysis) {
            setMetrics((current) => mergeMetrics(current, poseAnalysis.metrics))
            setZones(poseAnalysis.zones)
          }
          const selectedAnalysis = selectedMode === 'face' ? faceAnalysis : selectedMode === 'body' ? poseAnalysis : null
          if (scanActiveRef.current && selectedAnalysis) scanSamplesRef.current.push({ mode: selectedMode, metrics: selectedAnalysis.metrics, zones: selectedAnalysis.zones || HEAT_ZONES })
        }
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
  const runScan = () => {
    const recordedAt = new Date().toISOString()
    scanActiveRef.current = true
    scanSamplesRef.current = []
    setScanState('scanning')
    setScanPhase(0)
    scanTimerRef.current = window.setTimeout(() => {
      scanTimerRef.current = null
      scanActiveRef.current = false
      const samples = scanSamplesRef.current.filter((sample) => sample.mode === activeMode)
      const averaged = averageSamples(samples, { metrics, zones })
      const compositeIndex = Math.round(averaged.metrics.reduce((sum, metric) => sum + metric.value, 0) / averaged.metrics.length)
      setScanReport({ ...averaged, overall: compositeIndex, triage: triage(compositeIndex).label, activeMode, cameraState, recordedAt })
      setScanState('complete')
    }, 1800)
  }
  const exportMissionLog = () => {
    const report = scanReport || { metrics, zones, overall, triage: overallState.label, activeMode, cameraState, recordedAt: new Date().toISOString() }
    const packet = { recordedAt: report.recordedAt, type: 'stress-injury-scan', compositeIndex: report.overall, triage: report.triage, biomarkers: report.metrics, heatmap: report.zones, mode: report.activeMode, source: report.cameraState === 'active' ? 'local-camera-sensor-fusion' : 'simulated-local-sensor' }
    const download = document.createElement('a')
    download.href = URL.createObjectURL(new Blob([JSON.stringify(packet, null, 2)], { type: 'application/json' }))
    download.download = `mission-biometric-scan-${Date.now()}.json`
    download.click()
    URL.revokeObjectURL(download.href)
  }
  const exportPdf = () => {
    if (scanState !== 'complete' || !scanReport) return
    try {
      exportStressInjuryScan(scanReport)
      setExportError('')
    } catch (caught) {
      setExportError(caught?.message || 'Unable to create the stress and injury PDF report.')
    }
  }
  const overall = Math.round(metrics.reduce((sum, metric) => sum + metric.value, 0) / metrics.length)
  const overallState = triage(overall)
  const modePrompt = activeMode === 'face' ? 'Face detected: initializing cortisol & sleep scan' : activeMode === 'body' ? 'Full body detected: scanning musculoskeletal alignment' : 'Present face close-up or step back for full-body stance'
  const modeLabel = activeMode === 'face' ? 'FACE / MICRO-DIAGNOSTICS' : activeMode === 'body' ? 'BODY / MACRO-DIAGNOSTICS' : 'ADAPTIVE / SEARCHING'

  return <div className="stress-scanner-layer"><section className="stress-scanner-modal" role="dialog" aria-modal="true" aria-labelledby="stress-scanner-title">
    <header className="stress-scanner-header"><div><span className="stress-scanner-eyebrow">AURORA MEDICAL // BIOMETRIC TRIAGE</span><h2 id="stress-scanner-title">Stress & injury command station</h2></div><div className="stress-scanner-header-status"><span>{scanState === 'scanning' ? 'FULL SPECTRUM SWEEP' : 'LOCAL SENSOR LINK'}</span><button className="stress-scanner-close" onClick={() => { stopDetection(); streamRef.current?.getTracks().forEach((track) => track.stop()); onClose?.() }} aria-label="Close stress and injury scanner"><X size={18} /></button></div></header>
    <div className="stress-scanner-workspace"><div className={`stress-scan-portal is-${activeMode}`}><div className="stress-portal-guidance"><span>{modeLabel}</span><strong>{modePrompt}</strong><small>{modelState === 'active' ? 'FACE LANDMARK + POSE LANDMARK PIPELINE ACTIVE' : modelState === 'fallback' ? 'MODEL LINK UNAVAILABLE / SIMULATED TELEMETRY' : 'CAMERA LINK REQUIRED FOR ADAPTIVE DETECTION'}</small></div><video ref={videoRef} muted playsInline aria-label="Local astronaut biometric camera feed" /><div className="stress-scan-placeholder"><Camera size={25} /><strong>{cameraState === 'active' ? 'LIVE BIOMETRIC FEED' : 'SIMULATED SENSOR FEED'}</strong><small>{cameraState === 'denied' ? 'CAMERA DENIED / TELEMETRY SIMULATION CONTINUES' : 'LOCAL PROCESSING / NO VIDEO UPLINK'}</small></div><div className="stress-scan-grid-lines" /><div className={`stress-scan-wireframe ${activeMode}`} /><div className="stress-scan-sweep" style={{ top: `${scanPhase}%` }} /><span className="stress-scan-chip">{cameraState === 'active' ? 'CAMERA LINKED' : 'SENSOR MODEL ACTIVE'}</span><span className="stress-scan-corner">SWEEP // {String(Math.round(scanPhase)).padStart(3, '0')}%</span><div className="stress-scan-crosshair" /><div className="stress-heatmap heatmap-shoulder" /><div className="stress-heatmap heatmap-knee" /><span className="stress-zone-label zone-shoulder">R SHOULDER / LOAD</span><span className="stress-zone-label zone-knee">R KNEE / FATIGUE</span><div className="stress-portal-footer"><span><ScanLine size={13} /> {scanState === 'scanning' ? 'SCANNING ALL BIOMARKERS' : activeMode === 'face' ? 'FACIAL MICRO-TENSION GRID READY' : activeMode === 'body' ? 'SKELETAL HEATMAP READY' : 'ADAPTIVE SENSOR GRID READY'}</span><span>UNMIRRORED STATUS LAYER</span><button type="button" onClick={() => setModeOverride(modeOverride === 'auto' ? 'face' : modeOverride === 'face' ? 'body' : 'auto')}>MODE: {modeOverride.toUpperCase()}</button></div></div><aside className="stress-telemetry-panel"><div className="stress-triage-heading"><div><span className="stress-scanner-eyebrow">{modeLabel}</span><h3>{overallState.label}</h3></div><RadialDial label="LOAD" value={overall} /></div><div className="stress-biomarker-stack">{metrics.map((metric) => <BiomarkerCard key={metric.id} metric={metric} />)}{activeMode === 'body' ? <HeatmapCard zones={zones} /> : <article className="scanner-heatmap-card scanner-face-detail"><div className="scanner-card-heading"><Brain size={15} /><span>FACIAL MICRO-DIAGNOSTICS</span><b>LANDMARK MODEL</b></div><div className="scanner-face-readout"><span>BLINK FATIGUE</span><strong>26%</strong><i><b style={{ width: '26%' }} /></i><span>MICRO-TENSION</span><strong>31%</strong><i><b style={{ width: '31%' }} /></i><span>GAZE STABILITY</span><strong>82%</strong><i><b style={{ width: '82%' }} /></i></div></article>}</div><div className="stress-cognition-strip"><Brain size={14} /><span>{activeMode === 'face' ? 'EYE / BLINK FATIGUE' : 'COGNITIVE ALERTNESS'}</span><strong>{activeMode === 'face' ? '26%' : '78%'}</strong><i><b style={{ width: activeMode === 'face' ? '26%' : '78%' }} /></i></div></aside></div>
    <footer className="stress-control-dock"><div className="stress-dock-readout"><span>MISSION BIOMETRICS / HAB-01</span><strong>{scanState === 'complete' ? 'SWEEP COMPLETE · LOG READY' : scanState === 'scanning' ? 'COLLECTING SIGNALS...' : 'READY FOR FULL SPECTRUM SWEEP'}</strong></div><div className="stress-dock-actions"><button className="stress-dock-secondary" onClick={initializeCamera} disabled={cameraState === 'requesting'}><Camera size={14} />{cameraState === 'active' ? 'CAMERA LINKED' : 'CALIBRATE SENSORS'}</button><button className="stress-dock-primary" onClick={runScan} disabled={scanState === 'scanning'}><ScanLine size={14} /> RUN FULL SPECTRUM SCAN</button><button className="stress-dock-secondary" onClick={exportMissionLog}><Download size={14} /> EXPORT JSON LOG</button><button className="stress-dock-secondary" onClick={exportPdf} disabled={scanState !== 'complete'}><Download size={14} /> EXPORT PDF</button><button className="stress-dock-icon" onClick={() => { setMetrics(INITIAL_METRICS); setZones(HEAT_ZONES); setScanReport(null); setScanState('ready') }} aria-label="Reset scanner telemetry" title="Reset scanner telemetry"><RotateCcw size={14} /></button></div>{exportError && <p className="stress-scanner-error" role="alert">{exportError}</p>}</footer>
  </section></div>
}

export { INITIAL_METRICS, triage }
