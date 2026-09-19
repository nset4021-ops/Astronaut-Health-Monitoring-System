import { useCallback, useEffect, useRef, useState } from 'react'
import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision'

const WASM_PATH = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22/wasm'
const MODEL_PATH = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'

function angleAtJoint(a, b, c) {
  const ab = { x: a.x - b.x, y: a.y - b.y }
  const cb = { x: c.x - b.x, y: c.y - b.y }
  const dot = ab.x * cb.x + ab.y * cb.y
  const magnitude = Math.hypot(ab.x, ab.y) * Math.hypot(cb.x, cb.y)
  return magnitude ? Math.round((Math.acos(Math.min(1, Math.max(-1, dot / magnitude))) * 180) / Math.PI) : null
}

function readPose(landmarks) {
  if (!landmarks) return null
  const left = { shoulder: landmarks[11], hip: landmarks[23], knee: landmarks[25], ankle: landmarks[27] }
  const right = { shoulder: landmarks[12], hip: landmarks[24], knee: landmarks[26], ankle: landmarks[28] }
  return {
    leftKnee: angleAtJoint(left.hip, left.knee, left.ankle),
    rightKnee: angleAtJoint(right.hip, right.knee, right.ankle),
    leftHip: angleAtJoint(left.shoulder, left.hip, left.knee),
    rightHip: angleAtJoint(right.shoulder, right.hip, right.knee),
    confidence: Math.round((landmarks[11].visibility + landmarks[12].visibility + landmarks[23].visibility + landmarks[24].visibility) * 25),
    posture: Math.abs((left.hip.y + right.hip.y) / 2 - (left.shoulder.y + right.shoulder.y) / 2) > 0.22 ? 'EXTENDED' : 'NEUTRAL',
  }
}

export function usePoseTracker() {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const landmarkerRef = useRef(null)
  const frameRef = useRef(null)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [pose, setPose] = useState(null)

  const stop = useCallback(() => {
    if (frameRef.current) cancelAnimationFrame(frameRef.current)
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setStatus('idle')
    setPose(null)
  }, [])

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera API unavailable in this browser.')
      setStatus('error')
      return
    }
    try {
      setError('')
      setStatus('requesting')
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 }, audio: false })
      streamRef.current = stream
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      setStatus('loading-model')
      const vision = await FilesetResolver.forVisionTasks(WASM_PATH)
      landmarkerRef.current = await PoseLandmarker.createFromOptions(vision, { baseOptions: { modelAssetPath: MODEL_PATH, delegate: 'GPU' }, runningMode: 'VIDEO', numPoses: 1, minPoseDetectionConfidence: 0.55, minPosePresenceConfidence: 0.55 })
      setStatus('tracking')
      const detect = () => {
        if (!videoRef.current || !landmarkerRef.current) return
        const result = landmarkerRef.current.detectForVideo(videoRef.current, performance.now())
        setPose(readPose(result.landmarks?.[0]))
        frameRef.current = requestAnimationFrame(detect)
      }
      detect()
    } catch (caught) {
      stop()
      setError(caught?.message || 'Camera permission or pose model unavailable.')
      setStatus('error')
    }
  }, [stop])

  useEffect(() => stop, [stop])
  return { videoRef, pose, status, error, start, stop }
}

export { angleAtJoint, readPose }
