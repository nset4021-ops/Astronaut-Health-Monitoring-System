import '@tensorflow/tfjs-backend-webgl'
import * as tf from '@tensorflow/tfjs'
import * as poseDetection from '@tensorflow-models/pose-detection'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import './full-body-diagnostic.css'

const VIDEO_CONSTRAINTS = {
  video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
  audio: false,
}

const BODY_PARTS = ['nose', 'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow', 'left_wrist', 'right_wrist', 'left_hip', 'right_hip', 'left_knee', 'right_knee', 'left_ankle', 'right_ankle']
const SKELETON = [
  ['nose', 'left_shoulder'], ['nose', 'right_shoulder'], ['left_shoulder', 'right_shoulder'],
  ['left_shoulder', 'left_elbow'], ['left_elbow', 'left_wrist'], ['right_shoulder', 'right_elbow'], ['right_elbow', 'right_wrist'],
  ['left_shoulder', 'left_hip'], ['right_shoulder', 'right_hip'], ['left_hip', 'right_hip'],
  ['left_hip', 'left_knee'], ['left_knee', 'left_ankle'], ['right_hip', 'right_knee'], ['right_knee', 'right_ankle'],
]
const CONFIDENCE_THRESHOLD = 0.42
const CALIBRATION_HOLD_MS = 1500
const STEP_DURATION_MS = 8000
const STORAGE_KEY = 'orbital-full-body-diagnostic-v1'
const AVATAR_BONES = SKELETON

const STEPS = [
  { id: 'neutral', number: '01', title: 'Neutral stance', instruction: 'Stand tall with feet shoulder-width apart.', cue: 'Relax shoulders and face the camera.' },
  { id: 'upper', number: '02', title: 'Upper body flex', instruction: 'Raise both arms and flex your biceps and deltoids.', cue: 'Hold the contraction. Keep both sides level.' },
  { id: 'lower', number: '03', title: 'Lower body squat / flex', instruction: 'Lower into a controlled squat, then hold.', cue: 'Keep knees tracking over toes.' },
  { id: 'balance', number: '04', title: 'Balance & stability hold', instruction: 'Lift one foot and hold a stable one-leg stance.', cue: 'Use a steady gaze. Switch legs if needed.' },
]

function pointFor(keypoints, name) {
  return keypoints.find((point) => (point.name || point.part) === name)
}

function usablePoint(point) {
  return point && (point.score ?? point.confidence ?? 0) >= CONFIDENCE_THRESHOLD
}

function angleAtJoint(first, vertex, last) {
  if (!first || !vertex || !last) return null
  const a = { x: first.x - vertex.x, y: first.y - vertex.y, z: (first.z || 0) - (vertex.z || 0) }
  const b = { x: last.x - vertex.x, y: last.y - vertex.y, z: (last.z || 0) - (vertex.z || 0) }
  const magnitude = Math.hypot(a.x, a.y, a.z) * Math.hypot(b.x, b.y, b.z)
  if (!magnitude) return null
  return Math.round((Math.acos(Math.min(1, Math.max(-1, (a.x * b.x + a.y * b.y + a.z * b.z) / magnitude))) * 180) / Math.PI)
}

function keypointVector(point, videoWidth, videoHeight, depthScale = 1) {
  return new THREE.Vector3(
    (point.x / videoWidth - 0.5) * 2.7,
    -(point.y / videoHeight - 0.5) * 4.4,
    -(point.z || 0) * depthScale,
  )
}

function vectorAngleDegrees(first, vertex, last) {
  if (!first || !vertex || !last) return null
  const firstVector = first.clone().sub(vertex)
  const lastVector = last.clone().sub(vertex)
  const denominator = firstVector.length() * lastVector.length()
  if (!denominator) return null
  return Math.round(THREE.MathUtils.radToDeg(Math.acos(THREE.MathUtils.clamp(firstVector.dot(lastVector) / denominator, -1, 1))))
}

function quaternionFromDirection(direction, up = new THREE.Vector3(0, 1, 0)) {
  const normalized = direction.clone().normalize()
  return new THREE.Quaternion().setFromUnitVectors(up, normalized)
}

function calculateJointTelemetry(keypoints, videoWidth, videoHeight) {
  const names = ['left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow', 'left_hip', 'right_hip', 'left_knee', 'right_knee', 'left_ankle', 'right_ankle', 'left_wrist', 'right_wrist']
  const points = Object.fromEntries(names.map((name) => {
    const point = pointFor(keypoints, name)
    return [name, usablePoint(point) && videoWidth && videoHeight ? keypointVector(point, videoWidth, videoHeight) : null]
  }))
  return {
    leftElbow: vectorAngleDegrees(points.left_shoulder, points.left_elbow, points.left_wrist),
    rightElbow: vectorAngleDegrees(points.right_shoulder, points.right_elbow, points.right_wrist),
    leftKnee: vectorAngleDegrees(points.left_hip, points.left_knee, points.left_ankle),
    rightKnee: vectorAngleDegrees(points.right_hip, points.right_knee, points.right_ankle),
    leftShoulder: vectorAngleDegrees(points.left_hip, points.left_shoulder, points.left_elbow),
    rightShoulder: vectorAngleDegrees(points.right_hip, points.right_shoulder, points.right_elbow),
    leftHip: vectorAngleDegrees(points.left_shoulder, points.left_hip, points.left_knee),
    rightHip: vectorAngleDegrees(points.right_shoulder, points.right_hip, points.right_knee),
  }
}

function verifyFullBody(keypoints, width, height) {
  const points = BODY_PARTS.map((name) => pointFor(keypoints, name))
  const visible = points.filter(usablePoint)
  if (visible.length < BODY_PARTS.length - 2 || !width || !height) return { ready: false, message: 'Step back - full body required', detail: 'Keep head, hands, knees, and feet visible.' }
  const bounds = visible.reduce((box, point) => ({
    minX: Math.min(box.minX, point.x / width), maxX: Math.max(box.maxX, point.x / width),
    minY: Math.min(box.minY, point.y / height), maxY: Math.max(box.maxY, point.y / height),
  }), { minX: 1, maxX: 0, minY: 1, maxY: 0 })
  const centered = Math.abs((bounds.minX + bounds.maxX) / 2 - 0.5) <= 0.14
  const insideFrame = bounds.minX >= 0.035 && bounds.maxX <= 0.965 && bounds.minY >= 0.035 && bounds.maxY <= 0.98
  const tallEnough = bounds.maxY - bounds.minY >= 0.58
  if (!insideFrame || !centered) return { ready: false, message: 'Move center - face the target', detail: 'Center your full body inside the frame.' }
  if (!tallEnough) return { ready: false, message: 'Step closer - fill the frame', detail: 'Your head-to-toe outline should fill the guide.' }
  return { ready: true, message: 'Full body detected', detail: 'Hold still to calibrate.' }
}

function analyzeStep(stepId, keypoints) {
  const leftShoulder = pointFor(keypoints, 'left_shoulder')
  const rightShoulder = pointFor(keypoints, 'right_shoulder')
  const leftHip = pointFor(keypoints, 'left_hip')
  const rightHip = pointFor(keypoints, 'right_hip')
  const leftElbow = pointFor(keypoints, 'left_elbow')
  const rightElbow = pointFor(keypoints, 'right_elbow')
  const leftWrist = pointFor(keypoints, 'left_wrist')
  const rightWrist = pointFor(keypoints, 'right_wrist')
  const leftKnee = pointFor(keypoints, 'left_knee')
  const rightKnee = pointFor(keypoints, 'right_knee')
  const leftAnkle = pointFor(keypoints, 'left_ankle')
  const rightAnkle = pointFor(keypoints, 'right_ankle')
  const shoulderTilt = leftShoulder && rightShoulder ? Math.abs(Math.atan2(leftShoulder.y - rightShoulder.y, leftShoulder.x - rightShoulder.x) * 180 / Math.PI) : 30
  const shoulderSymmetry = leftShoulder && rightShoulder ? Math.max(0, 100 - shoulderTilt * 5) : 0
  const elbowSymmetry = leftElbow && rightElbow ? Math.max(0, 100 - Math.abs(leftElbow.y - rightElbow.y) * 0.45) : 0
  const leftBicep = angleAtJoint(leftShoulder, leftElbow, leftWrist)
  const rightBicep = angleAtJoint(rightShoulder, rightElbow, rightWrist)
  const leftKneeAngle = angleAtJoint(leftHip, leftKnee, leftAnkle)
  const rightKneeAngle = angleAtJoint(rightHip, rightKnee, rightAnkle)
  const sideSymmetry = leftKneeAngle !== null && rightKneeAngle !== null ? Math.max(0, 100 - Math.abs(leftKneeAngle - rightKneeAngle) * 1.7) : 0
  const base = { score: 0, symmetry: Math.round(Math.min(100, (shoulderSymmetry + elbowSymmetry + sideSymmetry) / 3)), cue: 'Hold position' }

  if (stepId === 'neutral') return { ...base, score: Math.round((shoulderSymmetry + sideSymmetry) / 2), cue: shoulderTilt > 12 ? 'Slight shoulder imbalance detected' : 'Good alignment' }
  if (stepId === 'upper') {
    const contraction = leftBicep !== null && rightBicep !== null ? Math.max(0, 100 - Math.abs(leftBicep - rightBicep) * 1.5) : 0
    const flexed = leftBicep !== null && rightBicep !== null && leftBicep < 125 && rightBicep < 125
    return { ...base, score: flexed ? Math.round((contraction + elbowSymmetry) / 2) : Math.round(contraction * 0.55), symmetry: Math.round(contraction), cue: flexed ? (contraction > 82 ? 'Good symmetry - hold' : 'Slight arm imbalance detected') : 'Raise and flex both arms' }
  }
  if (stepId === 'lower') {
    const squat = leftKneeAngle !== null && rightKneeAngle !== null && leftKneeAngle < 145 && rightKneeAngle < 145
    return { ...base, score: squat ? Math.round((sideSymmetry + Math.max(0, 100 - Math.max(leftKneeAngle, rightKneeAngle) * 0.55)) / 2) : 45, cue: squat ? (sideSymmetry > 82 ? 'Good symmetry - hold squat' : 'Slight left/right imbalance detected') : 'Lower into the squat position' }
  }
  const ankleGap = leftAnkle && rightAnkle ? Math.abs(leftAnkle.y - rightAnkle.y) : 0
  const balance = ankleGap > 24 ? Math.min(100, 62 + ankleGap * 0.22) : 45
  return { ...base, score: Math.round(balance), symmetry: Math.round(balance), cue: balance > 78 ? 'Stable hold - excellent control' : 'Find your balance and hold' }
}

function drawSkeleton(canvas, video, keypoints, verification, activeStep) {
  const context = canvas.getContext('2d')
  if (!context || !video.videoWidth) return
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.save()
  context.translate(canvas.width, 0)
  context.scale(-1, 1)
  const color = verification.ready ? '#8dff9b' : '#ff665f'
  context.strokeStyle = color
  context.shadowColor = color
  context.shadowBlur = 12
  context.lineWidth = Math.max(2, canvas.width / 420)
  SKELETON.forEach(([from, to]) => {
    const first = pointFor(keypoints, from)
    const last = pointFor(keypoints, to)
    if (!usablePoint(first) || !usablePoint(last)) return
    context.beginPath(); context.moveTo(first.x, first.y); context.lineTo(last.x, last.y); context.stroke()
  })
  context.shadowBlur = 0
  context.fillStyle = '#effffd'
  keypoints.filter(usablePoint).forEach((point) => { context.beginPath(); context.arc(point.x, point.y, Math.max(4, canvas.width / 180), 0, Math.PI * 2); context.fill() })
  const target = { left: canvas.width * 0.28, top: canvas.height * 0.04, width: canvas.width * 0.44, height: canvas.height * 0.94 }
  context.strokeStyle = color; context.setLineDash([10, 10]); context.lineWidth = 2; context.strokeRect(target.left, target.top, target.width, target.height); context.setLineDash([])
  context.restore()
  context.fillStyle = color
  context.font = `600 ${Math.max(16, canvas.width * 0.021)}px 'DM Mono', monospace`
  context.textAlign = 'center'
  context.fillText(activeStep ? activeStep.title.toUpperCase() : verification.message.toUpperCase(), canvas.width / 2, canvas.height * 0.1)
}

function speakCue(text) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  window.speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.rate = 1.05
  utterance.volume = 0.55
  window.speechSynthesis.speak(utterance)
}

function AvatarRig({ keypointsRef, videoRef }) {
  const jointRefs = useRef({})
  const boneRefs = useRef([])
  const smoothed = useRef({})
  const jointNames = [...new Set(AVATAR_BONES.flat())]

  useFrame(() => {
    const video = videoRef.current
    const keypoints = keypointsRef.current
    if (!video?.videoWidth || !keypoints?.length) return
    const nextPoints = Object.fromEntries(jointNames.map((name) => {
      const point = pointFor(keypoints, name)
      const target = usablePoint(point) ? keypointVector(point, video.videoWidth, video.videoHeight) : smoothed.current[name] || new THREE.Vector3()
      smoothed.current[name] = smoothed.current[name] || target.clone()
      smoothed.current[name].lerp(target, 0.22)
      return [name, smoothed.current[name]]
    }))
    jointNames.forEach((name) => { if (jointRefs.current[name]) jointRefs.current[name].position.copy(nextPoints[name]) })
    AVATAR_BONES.forEach(([from, to], index) => {
      const bone = boneRefs.current[index]
      if (!bone) return
      const start = nextPoints[from]
      const end = nextPoints[to]
      const midpoint = start.clone().add(end).multiplyScalar(0.5)
      const direction = end.clone().sub(start)
      bone.position.copy(midpoint)
      bone.scale.set(1, Math.max(0.04, direction.length()), 1)
      const targetQuaternion = quaternionFromDirection(direction)
      bone.quaternion.slerp(targetQuaternion, 0.24)
    })
  })

  return <group position={[0, 0, 0]}>
    {AVATAR_BONES.map(([from, to], index) => <mesh key={`${from}-${to}`} ref={(node) => { boneRefs.current[index] = node }}><cylinderGeometry args={[0.045, 0.055, 1, 8]} /><meshStandardMaterial color="#67e8e0" emissive="#1c7f7a" emissiveIntensity={0.55} roughness={0.3} metalness={0.55} /></mesh>)}
    {jointNames.map((name) => <mesh key={name} ref={(node) => { jointRefs.current[name] = node }}><sphereGeometry args={[name === 'nose' ? 0.09 : 0.075, 12, 12]} /><meshStandardMaterial color="#d6fffb" emissive="#67e8e0" emissiveIntensity={0.7} roughness={0.25} metalness={0.45} /></mesh>)}
  </group>
}

function AvatarViewport({ keypointsRef, videoRef }) {
  return <div className="full-body-avatar"><div className="full-body-avatar-label">LIVE AVATAR / MIRRORED RIG</div><Canvas camera={{ position: [0, 0, 6.4], fov: 38 }} gl={{ alpha: true, antialias: true }}><ambientLight intensity={1.5} /><pointLight position={[2, 2, 3]} intensity={4} color="#67e8e0" /><pointLight position={[-2, -1, 2]} intensity={2} color="#ffbd5c" /><AvatarRig keypointsRef={keypointsRef} videoRef={videoRef} /><OrbitControls enablePan={false} enableZoom={false} rotateSpeed={0.35} /></Canvas><div className="full-body-avatar-meta"><span>SMOOTHING 0.22</span><span>13 JOINTS</span></div></div>
}

function saveDiagnostic(payload, onDiagnosticComplete) {
  const record = { id: crypto.randomUUID(), type: 'full-body-diagnostic', observedAt: new Date().toISOString(), source: 'tensorflow-movenet', diagnostic: payload.overallScore >= 80 ? 'MOBILITY OPTIMAL' : 'MUSCLE TONE REVIEW', metrics: payload, payload }
  try {
    const current = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '[]')
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([record, ...current].slice(0, 20)))
  } catch { /* Offline callback still receives the result if storage is unavailable. */ }
  onDiagnosticComplete?.(record)
  return record
}

export default function FullBodyDiagnostic({ onClose, onDiagnosticComplete, onSnapshotSaved }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const detectorRef = useRef(null)
  const streamRef = useRef(null)
  const frameRef = useRef(null)
  const calibrationStartRef = useRef(null)
  const stepStartedRef = useRef(null)
  const scoresRef = useRef([])
  const lastCueRef = useRef('')
  const statusRef = useRef('idle')
  const stepIndexRef = useRef(-1)
  const keypointsRef = useRef([])
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [verification, setVerification] = useState({ ready: false, message: 'Start camera to verify full body', detail: 'Head-to-toe visibility is required.' })
  const [stepIndex, setStepIndex] = useState(-1)
  const [stepAnalysis, setStepAnalysis] = useState(null)
  const [jointTelemetry, setJointTelemetry] = useState({})
  const [secondsLeft, setSecondsLeft] = useState(null)
  const [result, setResult] = useState(null)

  const stop = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current)
    streamRef.current?.getTracks().forEach((track) => track.stop())
    detectorRef.current?.dispose?.()
    frameRef.current = null; streamRef.current = null; detectorRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    calibrationStartRef.current = null; stepStartedRef.current = null
    statusRef.current = 'idle'; stepIndexRef.current = -1
    setStatus('idle'); setStepIndex(-1); setStepAnalysis(null); setSecondsLeft(null); setVerification({ ready: false, message: 'Start camera to verify full body', detail: 'Head-to-toe visibility is required.' })
  }, [])

  const finish = useCallback(() => {
    const stepScores = scoresRef.current
    const overallScore = Math.round(stepScores.reduce((sum, item) => sum + item.score, 0) / Math.max(1, stepScores.length))
    const payload = { overallScore, stepScores, protocol: STEPS.map(({ id, title }) => ({ id, title })), diagnostic: overallScore >= 80 ? 'MUSCLE TONE NOMINAL' : overallScore >= 60 ? 'ADAPTATION MONITOR' : 'REVIEW REQUIRED' }
    const record = saveDiagnostic(payload, onDiagnosticComplete)
    onSnapshotSaved?.(record)
    statusRef.current = 'complete'; setResult(payload); setStatus('complete'); setSecondsLeft(null); speakCue(`Diagnostic complete. Physical health and muscle tone score ${overallScore} out of 100.`)
  }, [onDiagnosticComplete, onSnapshotSaved])

  const trackFrame = useCallback(async (timestamp) => {
    const video = videoRef.current
    const detector = detectorRef.current
    if (!video || !detector || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return
    const poses = await detector.estimatePoses(video, { flipHorizontal: true })
    const keypoints = poses[0]?.keypoints || []
    keypointsRef.current = keypoints
    const nextVerification = verifyFullBody(keypoints, video.videoWidth, video.videoHeight)
    setJointTelemetry(calculateJointTelemetry(keypoints, video.videoWidth, video.videoHeight))
    setVerification(nextVerification)
    const currentStatus = statusRef.current
    const currentStepIndex = stepIndexRef.current
    const activeStep = STEPS[currentStepIndex]
    if (canvasRef.current) drawSkeleton(canvasRef.current, video, keypoints, nextVerification, activeStep)

    if (currentStatus === 'calibrating' && nextVerification.ready) {
      calibrationStartRef.current ||= timestamp
      if (timestamp - calibrationStartRef.current >= CALIBRATION_HOLD_MS) {
        statusRef.current = 'active'; stepIndexRef.current = 0; setStatus('active'); setStepIndex(0); stepStartedRef.current = timestamp; speakCue(STEPS[0].instruction)
      }
    } else if (currentStatus === 'calibrating') calibrationStartRef.current = null

    if (currentStatus === 'active' && activeStep && nextVerification.ready) {
      const nextAnalysis = analyzeStep(activeStep.id, keypoints)
      setStepAnalysis(nextAnalysis)
      setSecondsLeft(Math.max(0, Math.ceil((STEP_DURATION_MS - (timestamp - stepStartedRef.current)) / 1000)))
      if (nextAnalysis.cue !== lastCueRef.current && nextAnalysis.cue !== 'Hold position') { lastCueRef.current = nextAnalysis.cue; speakCue(nextAnalysis.cue) }
      if (timestamp - stepStartedRef.current >= STEP_DURATION_MS) {
        scoresRef.current = [...scoresRef.current, { id: activeStep.id, score: nextAnalysis.score, symmetry: nextAnalysis.symmetry }]
        if (currentStepIndex === STEPS.length - 1) finish()
        else { const nextIndex = currentStepIndex + 1; stepIndexRef.current = nextIndex; setStepIndex(nextIndex); stepStartedRef.current = timestamp; setStepAnalysis(null); speakCue(STEPS[nextIndex].instruction) }
      }
    }
    frameRef.current = requestAnimationFrame(trackFrame)
  }, [finish])

  const start = useCallback(async () => {
    setError('')
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) { setError('Camera requires HTTPS or localhost in a supported browser.'); statusRef.current = 'error'; setStatus('error'); return }
    try {
      statusRef.current = 'requesting'; setStatus('requesting')
      const stream = await navigator.mediaDevices.getUserMedia(VIDEO_CONSTRAINTS)
      streamRef.current = stream; videoRef.current.srcObject = stream; await videoRef.current.play()
      statusRef.current = 'loading'; setStatus('loading'); await tf.setBackend('webgl'); await tf.ready()
      detectorRef.current = await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING, enableSmoothing: true })
      scoresRef.current = []; statusRef.current = 'calibrating'; setStatus('calibrating'); speakCue('Step back until your full body is visible.')
      frameRef.current = requestAnimationFrame(trackFrame)
    } catch (caught) { stop(); setError(caught?.message || 'Camera or pose model unavailable.'); statusRef.current = 'error'; setStatus('error') }
  }, [stop, trackFrame])

  useEffect(() => () => stop(), [stop])
  const activeStep = STEPS[stepIndex]
  const progress = status === 'active' && activeStep ? ((STEP_DURATION_MS - (secondsLeft || 0) * 1000) / STEP_DURATION_MS) * 100 : status === 'complete' ? 100 : 0

  return <div className="full-body-layer"><section className="full-body-console" role="dialog" aria-modal="true" aria-label="Full body muscle tone diagnostic">
    <header className="full-body-header"><div><span className="full-body-eyebrow">AURORA MEDICAL // FLEX & HOLD PROTOCOL</span><h2>Full-body diagnostic</h2></div><button className="full-body-close" onClick={() => { stop(); onClose?.() }} aria-label="Close diagnostic">×</button></header>
    <div className="full-body-visual-grid"><div className={`full-body-feed ${verification.ready ? 'is-ready' : 'is-searching'}`}><video ref={videoRef} muted playsInline /><canvas ref={canvasRef} aria-label="Full body skeletal pose overlay" />{!['calibrating', 'active', 'complete'].includes(status) && <div className="full-body-placeholder"><span>◉</span><strong>{status === 'loading' ? 'LOADING POSE ENGINE' : 'CAMERA STANDBY'}</strong><small>LOCAL INFERENCE / MOVENET LIGHTNING</small></div>}<div className="full-body-feed-status"><span className="full-body-status-dot" />{verification.message}</div></div><AvatarViewport keypointsRef={keypointsRef} videoRef={videoRef} /></div>
    <div className="full-body-content"><div className="full-body-protocol"><div className="full-body-protocol-top"><span className="full-body-eyebrow">{status === 'complete' ? 'PROTOCOL COMPLETE' : activeStep ? `STEP ${activeStep.number} / 04` : 'CALIBRATION GATE'}</span><strong>{status === 'complete' ? `${result?.overallScore || 0} / 100` : activeStep ? activeStep.title : verification.message}</strong></div>{status === 'complete' ? <div className="full-body-result"><span>PHYSICAL HEALTH & MUSCLE TONE</span><strong>{result?.diagnostic}</strong><small>{result?.stepScores?.map((item) => `${item.id.toUpperCase()} ${item.score}`).join(' · ')}</small></div> : <><p className="full-body-instruction">{activeStep ? activeStep.instruction : verification.detail}</p><p className="full-body-cue">{activeStep ? activeStep.cue : 'Hold a neutral stance once your full body is framed.'}</p><div className="full-body-progress"><span style={{ width: `${progress}%` }} /></div></>}</div><div className="full-body-live-readout"><div><span>POSE CONFIDENCE</span><strong>{verification.ready ? 'LOCKED' : 'SEARCHING'}</strong></div><div><span>LIVE SCORE</span><strong>{stepAnalysis ? `${stepAnalysis.score}%` : '--'}</strong></div><div><span>SYMMETRY</span><strong>{stepAnalysis ? `${stepAnalysis.symmetry}%` : '--'}</strong></div><div><span>TIME REMAINING</span><strong>{secondsLeft !== null ? `${secondsLeft}s` : '--'}</strong></div><div><span>LEFT ELBOW</span><strong>{jointTelemetry.leftElbow ? `${jointTelemetry.leftElbow}°` : '--'}</strong></div><div><span>RIGHT ELBOW</span><strong>{jointTelemetry.rightElbow ? `${jointTelemetry.rightElbow}°` : '--'}</strong></div><div><span>LEFT KNEE</span><strong>{jointTelemetry.leftKnee ? `${jointTelemetry.leftKnee}°` : '--'}</strong></div><div><span>RIGHT KNEE</span><strong>{jointTelemetry.rightKnee ? `${jointTelemetry.rightKnee}°` : '--'}</strong></div></div></div>
    {error && <p className="full-body-error" role="alert">{error}</p>}
    <footer className="full-body-actions">{status === 'idle' || status === 'error' ? <button className="full-body-primary" onClick={start}>INITIALIZE FULL-BODY CHECK <span>↗</span></button> : status === 'complete' ? <button className="full-body-primary" onClick={() => { stop(); start() }}>RUN AGAIN <span>↻</span></button> : <span className="full-body-locked">{status === 'active' ? `HOLD POSITION · ${secondsLeft || 0}s` : status.toUpperCase()}</span>}<span className="full-body-disclaimer">LOCAL SCREENING ONLY · NOT A DIAGNOSIS</span></footer>
  </section></div>
}

export { STEPS, angleAtJoint, analyzeStep, calculateJointTelemetry, keypointVector, quaternionFromDirection, verifyFullBody }
