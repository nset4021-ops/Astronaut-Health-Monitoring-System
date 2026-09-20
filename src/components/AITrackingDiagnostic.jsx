import '@tensorflow/tfjs-backend-webgl'
import * as tf from '@tensorflow/tfjs'
import * as poseDetection from '@tensorflow-models/pose-detection'
import { useCallback, useEffect, useRef, useState } from 'react'
import './ai-diagnostic.css'

const VIDEO_CONSTRAINTS = {
  video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
  audio: false,
}

const KEYPOINTS = new Set([
  'left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow',
  'left_hip', 'right_hip', 'left_knee', 'right_knee',
])

const SKELETON = [
  ['left_shoulder', 'right_shoulder'],
  ['left_shoulder', 'left_elbow'], ['left_elbow', 'left_wrist'],
  ['right_shoulder', 'right_elbow'], ['right_elbow', 'right_wrist'],
  ['left_shoulder', 'left_hip'], ['right_shoulder', 'right_hip'],
  ['left_hip', 'right_hip'], ['left_hip', 'left_knee'], ['right_hip', 'right_knee'],
]

function angleAtJoint(a, b, c) {
  if (!a || !b || !c) return null
  const ab = { x: a.x - b.x, y: a.y - b.y }
  const cb = { x: c.x - b.x, y: c.y - b.y }
  const denominator = Math.hypot(ab.x, ab.y) * Math.hypot(cb.x, cb.y)
  if (!denominator) return null
  const cosine = Math.min(1, Math.max(-1, (ab.x * cb.x + ab.y * cb.y) / denominator))
  return Math.round((Math.acos(cosine) * 180) / Math.PI)
}

function findKeypoint(keypoints, name) {
  return keypoints.find((point) => point.name === name || point.part === name)
}

function analyzePose(keypoints) {
  const leftShoulder = findKeypoint(keypoints, 'left_shoulder')
  const rightShoulder = findKeypoint(keypoints, 'right_shoulder')
  const leftElbow = findKeypoint(keypoints, 'left_elbow')
  const rightElbow = findKeypoint(keypoints, 'right_elbow')
  const leftHip = findKeypoint(keypoints, 'left_hip')
  const rightHip = findKeypoint(keypoints, 'right_hip')
  const leftKnee = findKeypoint(keypoints, 'left_knee')
  const rightKnee = findKeypoint(keypoints, 'right_knee')
  const leftAnkle = findKeypoint(keypoints, 'left_ankle')
  const rightAnkle = findKeypoint(keypoints, 'right_ankle')
  const leftWrist = findKeypoint(keypoints, 'left_wrist')
  const rightWrist = findKeypoint(keypoints, 'right_wrist')

  const leftKneeFlexion = angleAtJoint(leftHip, leftKnee, leftAnkle)
  const rightKneeFlexion = angleAtJoint(rightHip, rightKnee, rightAnkle)
  const leftShoulderRange = angleAtJoint(leftHip, leftShoulder, leftElbow)
  const rightShoulderRange = angleAtJoint(rightHip, rightShoulder, rightElbow)
  const shoulderTilt = leftShoulder && rightShoulder ? Math.round(Math.abs(Math.atan2(leftShoulder.y - rightShoulder.y, leftShoulder.x - rightShoulder.x) * (180 / Math.PI))) : null
  const confidencePoints = [leftShoulder, rightShoulder, leftHip, rightHip, leftKnee, rightKnee, leftAnkle, rightAnkle].filter(Boolean)
  const confidence = confidencePoints.length ? Math.round(confidencePoints.reduce((sum, point) => sum + (point.score || 0), 0) / confidencePoints.length * 100) : 0
  const angles = [leftKneeFlexion, rightKneeFlexion, leftShoulderRange, rightShoulderRange].filter(Number.isFinite)
  const restricted = angles.some((angle) => angle < 45 || angle > 175)
  const postureWarning = shoulderTilt !== null && shoulderTilt > 12
  const status = confidence < 45 ? 'ALIGN WITH CAMERA' : postureWarning ? 'POSTURE WARNING' : restricted ? 'RESTRICTED RANGE DETECTED' : 'MOBILITY OPTIMAL'

  return {
    keypoints,
    confidence,
    leftKneeFlexion,
    rightKneeFlexion,
    leftShoulderRange,
    rightShoulderRange,
    shoulderTilt,
    status,
    landmarks: [leftShoulder, rightShoulder, leftElbow, rightElbow, leftHip, rightHip, leftKnee, rightKnee, leftWrist, rightWrist].filter(Boolean),
  }
}

const ALIGNMENT_POINTS = ['nose', 'left_shoulder', 'right_shoulder', 'left_hip', 'right_hip', 'left_ankle', 'right_ankle']

function analyzeAlignment(keypoints, videoWidth, videoHeight) {
  const points = ALIGNMENT_POINTS.map((name) => findKeypoint(keypoints, name)).filter((point) => point && (point.score || 0) >= 0.35)
  if (points.length < 5 || !videoWidth || !videoHeight) return { state: 'out-of-frame', label: 'Move Center', detail: 'Keep your full body visible' }

  const bounds = points.reduce((box, point) => ({
    minX: Math.min(box.minX, point.x / videoWidth),
    maxX: Math.max(box.maxX, point.x / videoWidth),
    minY: Math.min(box.minY, point.y / videoHeight),
    maxY: Math.max(box.maxY, point.y / videoHeight),
  }), { minX: 1, maxX: 0, minY: 1, maxY: 0 })
  const width = bounds.maxX - bounds.minX
  const height = bounds.maxY - bounds.minY
  const centerX = (bounds.minX + bounds.maxX) / 2

  if (bounds.minX < 0.05 || bounds.maxX > 0.95 || bounds.minY < 0.05 || bounds.maxY > 0.98 || Math.abs(centerX - 0.5) > 0.14) {
    return { state: 'out-of-frame', label: 'Move Center', detail: 'Center your body in the target' }
  }
  if (height < 0.62 || width < 0.24) return { state: 'too-far', label: 'Step Closer', detail: 'Move closer until you fill the target' }
  if (height > 0.9 || width > 0.72) return { state: 'too-close', label: 'Step Back', detail: 'Create space from the camera' }
  return { state: 'ready', label: 'Perfect - Stand Still', detail: 'Hold position to begin calibration' }
}

function drawOverlay(canvas, video, analysis, alignment, countdown) {
  const context = canvas.getContext('2d')
  const scaleX = canvas.width / video.videoWidth
  const scaleY = canvas.height / video.videoHeight
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.save()
  context.scale(scaleX, scaleY)
  context.translate(video.videoWidth, 0)
  context.scale(-1, 1)
  const target = { left: video.videoWidth * 0.28, right: video.videoWidth * 0.72, top: video.videoHeight * 0.07, bottom: video.videoHeight * 0.97 }
  const alignmentColor = alignment?.state === 'ready' ? '#8dff9b' : '#ff665f'
  context.strokeStyle = alignmentColor
  context.shadowColor = alignmentColor
  context.shadowBlur = 18
  context.lineWidth = 3 / scaleX
  context.strokeRect(target.left, target.top, target.right - target.left, target.bottom - target.top)
  context.shadowBlur = 0
  context.font = `600 ${Math.max(16, video.videoWidth * 0.022)}px 'DM Mono', monospace`
  context.textAlign = 'center'
  context.fillStyle = alignmentColor
  context.fillText(alignment?.label || 'Move Center', video.videoWidth / 2, video.videoHeight * 0.14)
  context.font = `400 ${Math.max(11, video.videoWidth * 0.012)}px 'DM Mono', monospace`
  context.fillText(alignment?.detail || 'Keep your full body visible', video.videoWidth / 2, video.videoHeight * 0.18)
  if (countdown) {
    context.fillStyle = '#e8fbf8'
    context.shadowColor = alignmentColor
    context.shadowBlur = 24
    context.font = `600 ${Math.max(48, video.videoWidth * 0.1)}px 'DM Mono', monospace`
    context.fillText(countdown, video.videoWidth / 2, video.videoHeight * 0.58)
    context.shadowBlur = 0
  }
  context.lineWidth = 4 / scaleX
  context.strokeStyle = analysis.status === 'MOBILITY OPTIMAL' ? '#6fffe9' : '#ffce6a'
  context.fillStyle = '#e8fbf8'

  const byName = Object.fromEntries(analysis.keypoints.map((point) => [point.name || point.part, point]))
  SKELETON.forEach(([from, to]) => {
    const a = byName[from]
    const b = byName[to]
    if (!a || !b || (a.score || 0) < 0.35 || (b.score || 0) < 0.35) return
    context.beginPath()
    context.moveTo(a.x, a.y)
    context.lineTo(b.x, b.y)
    context.stroke()
  })
  analysis.landmarks.forEach((point) => {
    if ((point.score || 0) < 0.35) return
    context.beginPath()
    context.arc(point.x, point.y, 7 / scaleX, 0, Math.PI * 2)
    context.fill()
  })
  context.restore()
}

function cameraMessage(error) {
  if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') return 'Camera access denied. Allow camera permission and retry.'
  if (error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError') return 'No camera found. Connect a camera and retry.'
  if (error?.name === 'NotReadableError') return 'Camera is busy in another application.'
  if (error?.name === 'SecurityError') return 'Camera requires HTTPS or localhost.'
  return error?.message || 'Camera connection failed.'
}

export default function AITrackingDiagnostic({ onClose, onSnapshotSaved }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const detectorRef = useRef(null)
  const animationRef = useRef(null)
  const lastInferenceRef = useRef(0)
  const alignmentStartRef = useRef(null)
  const countdownIntervalRef = useRef(null)
  const countdownStartedRef = useRef(false)
  const countdownValueRef = useRef(null)
  const [status, setStatus] = useState('idle')
  const [cameraError, setCameraError] = useState('')
  const [hasPermission, setHasPermission] = useState(false)
  const [analysis, setAnalysis] = useState(null)
  const [alignment, setAlignment] = useState({ state: 'out-of-frame', label: 'Move Center', detail: 'Keep your full body visible' })
  const [countdown, setCountdown] = useState(null)

  const stopTracking = useCallback(() => {
    if (animationRef.current) cancelAnimationFrame(animationRef.current)
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current)
    animationRef.current = null
    countdownIntervalRef.current = null
    alignmentStartRef.current = null
    countdownStartedRef.current = false
    countdownValueRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    detectorRef.current?.dispose?.()
    detectorRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setHasPermission(false)
    setAnalysis(null)
    setAlignment({ state: 'out-of-frame', label: 'Move Center', detail: 'Keep your full body visible' })
    setCountdown(null)
    setStatus('idle')
  }, [])

  const trackFrame = useCallback(async (timestamp) => {
    const video = videoRef.current
    const detector = detectorRef.current
    if (!video || !detector || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) return
    if (timestamp - lastInferenceRef.current >= 80) {
      lastInferenceRef.current = timestamp
      const poses = await detector.estimatePoses(video, { flipHorizontal: true })
      const nextAnalysis = poses[0]?.keypoints?.length ? analyzePose(poses[0].keypoints) : null
      if (nextAnalysis) {
        const nextAlignment = analyzeAlignment(nextAnalysis.keypoints, video.videoWidth, video.videoHeight)
        setAlignment(nextAlignment)
        video.parentElement?.style.setProperty('--alignment-color', nextAlignment.state === 'ready' ? '#8dff9b' : '#ff665f')
        if (nextAlignment.state === 'ready' && !countdownStartedRef.current) {
          alignmentStartRef.current ||= timestamp
          if (timestamp - alignmentStartRef.current >= 2000) {
            countdownStartedRef.current = true
            setStatus('countdown')
            setCountdown(3)
            countdownValueRef.current = 3
            countdownIntervalRef.current = setInterval(() => {
              setCountdown((current) => {
                if (current === 1) {
                  clearInterval(countdownIntervalRef.current)
                  countdownIntervalRef.current = null
                  countdownValueRef.current = null
                  setStatus('recording')
                  return null
                }
                countdownValueRef.current = current - 1
                return current - 1
              })
            }, 1000)
          }
        } else if (nextAlignment.state !== 'ready') {
          alignmentStartRef.current = null
        }
        setAnalysis(nextAnalysis)
        if (canvasRef.current) drawOverlay(canvasRef.current, video, nextAnalysis, nextAlignment, countdownValueRef.current)
      } else {
        alignmentStartRef.current = null
        setAlignment({ state: 'out-of-frame', label: 'Move Center', detail: 'Keep your full body visible' })
        video.parentElement?.style.setProperty('--alignment-color', '#ff665f')
      }
    }
    animationRef.current = requestAnimationFrame(trackFrame)
  }, [])

  const initializeTracking = useCallback(async () => {
    setCameraError('')
    if (!window.isSecureContext) {
      setStatus('error')
      setCameraError('Camera access requires HTTPS or localhost.')
      return
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('error')
      setCameraError('This browser does not support camera access.')
      return
    }
    try {
      setStatus('requesting')
      const stream = await navigator.mediaDevices.getUserMedia(VIDEO_CONSTRAINTS)
      streamRef.current = stream
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      setHasPermission(true)
      setAlignment({ state: 'out-of-frame', label: 'Move Center', detail: 'Keep your full body visible' })
      setStatus('loading-model')
      await tf.setBackend('webgl')
      await tf.ready()
      detectorRef.current = await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, { modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING, enableSmoothing: true })
      setStatus('tracking')
      animationRef.current = requestAnimationFrame(trackFrame)
    } catch (error) {
      stopTracking()
      setStatus('error')
      setCameraError(cameraMessage(error))
    }
  }, [stopTracking, trackFrame])

  useEffect(() => stopTracking, [stopTracking])

  const saveSnapshot = () => {
    if (!analysis) return
    onSnapshotSaved?.({ recordedAt: new Date().toISOString(), source: 'tensorflow-movenet', diagnostic: analysis.status, metrics: analysis })
    setStatus('snapshot-saved')
  }

  const resizeCanvas = (event) => {
    const video = event.currentTarget
    if (!canvasRef.current) return
    canvasRef.current.width = video.videoWidth
    canvasRef.current.height = video.videoHeight
  }

  const statusLabel = { idle: 'CAMERA STANDBY', requesting: 'PERMISSION REQUESTED', 'loading-model': 'LOADING MOVENET', tracking: analysis?.status || 'TRACKING', countdown: 'CALIBRATION COUNTDOWN', recording: 'DIAGNOSTIC RECORDING', 'snapshot-saved': 'SNAPSHOT SAVED LOCALLY', error: 'CAMERA ERROR' }[status]
  const statusColor = analysis?.status === 'MOBILITY OPTIMAL' ? '#6fffe9' : '#ffce6a'

  return <div className="camera-layer"><section className="camera-console ai-diagnostic" role="dialog" aria-label="AI mobility diagnostic"><div className="camera-title"><div><span className="eyebrow">SYSTEM CALIBRATION / AI MOBILITY CHECK</span><h2>MoveNet diagnostic feed</h2></div><button className="close-button" onClick={() => { stopTracking(); onClose?.() }} aria-label="Close AI mobility diagnostic">×</button></div><div className="ai-feed-wrap"><video ref={videoRef} muted playsInline onLoadedMetadata={resizeCanvas} /><canvas ref={canvasRef} aria-label="Pose skeleton overlay" />{!hasPermission && <div className="camera-placeholder"><span className="text-2xl">◉</span><span>Camera feed standby</span></div>}<span className="camera-feed-label">{statusLabel}</span></div><div className="ai-diagnostic-grid"><div className="ai-status-readout" style={{ '--diagnostic-color': statusColor }}><span className="eyebrow">DIAGNOSTIC STATUS</span><strong>{statusLabel}</strong><small>{analysis ? `${analysis.confidence}% landmark confidence` : 'No pose frame available'}</small></div><div className="angle-grid"><div className="readout"><span>L KNEE FLEXION</span><strong>{analysis?.leftKneeFlexion ? `${analysis.leftKneeFlexion}°` : '--'}</strong></div><div className="readout"><span>R KNEE FLEXION</span><strong>{analysis?.rightKneeFlexion ? `${analysis.rightKneeFlexion}°` : '--'}</strong></div><div className="readout"><span>L SHOULDER ROM</span><strong>{analysis?.leftShoulderRange ? `${analysis.leftShoulderRange}°` : '--'}</strong></div><div className="readout"><span>R SHOULDER ROM</span><strong>{analysis?.rightShoulderRange ? `${analysis.rightShoulderRange}°` : '--'}</strong></div></div>{cameraError && <p className="camera-error" role="alert">{cameraError}</p>}<p className="ai-disclaimer">AI feedback is a simulation for mobility screening, not a diagnosis. Frames and landmarks remain local to this device.</p><div className="ai-actions">{status === 'tracking' ? <button className="camera-button stop" onClick={stopTracking}>STOP ANALYSIS</button> : <button className="camera-button" onClick={initializeTracking}>INITIALIZE AI TRACKING</button>}<button className="save-button" disabled={!analysis} onClick={saveSnapshot}>SAVE DIAGNOSTIC SNAPSHOT</button></div></div><div className="camera-footer"><span>TENSORFLOW.JS // MOVENET LIGHTNING</span><span>WEBGL LOCAL INFERENCE</span></div></section></div>
}

export { angleAtJoint, analyzePose, cameraMessage, SKELETON }
