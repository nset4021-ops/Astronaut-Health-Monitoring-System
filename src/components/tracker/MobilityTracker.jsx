import '@tensorflow/tfjs-backend-webgl'
import * as tf from '@tensorflow/tfjs'
import * as poseDetection from '@tensorflow-models/pose-detection'
import { Canvas, useFrame } from '@react-three/fiber'
import { Activity, Gauge, Rotate3D } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

const MODEL_OPTIONS = {
  modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING,
  inputResolution: { width: 256, height: 256 },
  enableSmoothing: true,
}

const BONES = [
  ['left_shoulder', 'left_elbow'], ['left_elbow', 'left_wrist'],
  ['right_shoulder', 'right_elbow'], ['right_elbow', 'right_wrist'],
  ['left_shoulder', 'right_shoulder'], ['left_shoulder', 'left_hip'],
  ['right_shoulder', 'right_hip'], ['left_hip', 'right_hip'],
  ['left_hip', 'left_knee'], ['left_knee', 'left_ankle'],
  ['right_hip', 'right_knee'], ['right_knee', 'right_ankle'],
]

const TRACKED_JOINTS = ['left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow', 'left_hip', 'right_hip', 'left_knee', 'right_knee', 'left_ankle', 'right_ankle']

function pointFor(keypoints, name) {
  return keypoints.find((point) => (point.name || point.part) === name)
}

function usable(point) {
  return Boolean(point && (point.score || 0) >= 0.4)
}

function angleAtJoint(first, vertex, last) {
  if (!first || !vertex || !last) return null
  const a = { x: first.x - vertex.x, y: first.y - vertex.y }
  const b = { x: last.x - vertex.x, y: last.y - vertex.y }
  const denominator = Math.hypot(a.x, a.y) * Math.hypot(b.x, b.y)
  if (!denominator) return null
  return Math.round(Math.acos(Math.min(1, Math.max(-1, (a.x * b.x + a.y * b.y) / denominator))) * 180 / Math.PI)
}

function vectorFor(start, end) {
  if (!start || !end) return { yaw: null, pitch: null, roll: null }
  const dx = end.x - start.x
  const dy = end.y - start.y
  const dz = (end.z || 0) - (start.z || 0)
  return {
    yaw: Math.round(Math.atan2(dz, dx) * 180 / Math.PI),
    pitch: Math.round(Math.atan2(dy, Math.hypot(dx, dz)) * 180 / Math.PI),
    roll: 0,
  }
}

function vectorMagnitude(vector) {
  return vector ? Math.hypot(vector.x, vector.y, vector.z || 0) : 0
}

function calculateTelemetry(keypoints, previous, timestamp) {
  const shoulder = {
    left: pointFor(keypoints, 'left_shoulder'),
    right: pointFor(keypoints, 'right_shoulder'),
  }
  const elbow = {
    left: pointFor(keypoints, 'left_elbow'),
    right: pointFor(keypoints, 'right_elbow'),
  }
  const wrist = {
    left: pointFor(keypoints, 'left_wrist'),
    right: pointFor(keypoints, 'right_wrist'),
  }
  const hip = {
    left: pointFor(keypoints, 'left_hip'),
    right: pointFor(keypoints, 'right_hip'),
  }
  const knee = {
    left: pointFor(keypoints, 'left_knee'),
    right: pointFor(keypoints, 'right_knee'),
  }
  const ankle = {
    left: pointFor(keypoints, 'left_ankle'),
    right: pointFor(keypoints, 'right_ankle'),
  }
  const angles = {
    leftElbow: angleAtJoint(shoulder.left, elbow.left, wrist.left),
    rightElbow: angleAtJoint(shoulder.right, elbow.right, wrist.right),
    leftKnee: angleAtJoint(hip.left, knee.left, ankle.left),
    rightKnee: angleAtJoint(hip.right, knee.right, ankle.right),
    leftShoulder: angleAtJoint(hip.left, shoulder.left, elbow.left),
    rightShoulder: angleAtJoint(hip.right, shoulder.right, elbow.right),
  }
  const vectors = {
    shoulders: vectorFor(shoulder.left, shoulder.right),
    elbows: { left: vectorFor(shoulder.left, elbow.left), right: vectorFor(shoulder.right, elbow.right) },
    hips: { left: vectorFor(shoulder.left, hip.left), right: vectorFor(shoulder.right, hip.right) },
    knees: { left: vectorFor(hip.left, knee.left), right: vectorFor(hip.right, knee.right) },
    ankles: { left: vectorFor(knee.left, ankle.left), right: vectorFor(knee.right, ankle.right) },
  }
  const delta = previous ? Math.max(0.016, (timestamp - previous.timestamp) / 1000) : 0.016
  const movement = keypoints.reduce((sum, point) => {
    const prior = previous?.keypoints.find((item) => (item.name || item.part) === (point.name || point.part))
    return sum + (prior ? Math.hypot(point.x - prior.x, point.y - prior.y) : 0)
  }, 0) / Math.max(1, keypoints.length)
  const velocity = Math.min(100, Math.round((movement / delta) * 0.35))
  const elbowFlexion = [angles.leftElbow, angles.rightElbow].filter(Number.isFinite).reduce((sum, value) => sum + (180 - value), 0) / 2
  const kneeFlexion = [angles.leftKnee, angles.rightKnee].filter(Number.isFinite).reduce((sum, value) => sum + (180 - value), 0) / 2
  const shoulderRange = [angles.leftShoulder, angles.rightShoulder].filter(Number.isFinite).reduce((sum, value) => sum + value, 0) / 2
  const activation = {
    deltoids: Math.min(100, Math.round(shoulderRange * 0.35 + velocity * 0.3)),
    biceps: Math.min(100, Math.round(elbowFlexion * 0.45 + velocity * 0.25)),
    trapezius: Math.min(100, Math.round(Math.abs(vectors.shoulders.roll || 0) * 1.4 + velocity * 0.2)),
    quadriceps: Math.min(100, Math.round(kneeFlexion * 0.45 + velocity * 0.25)),
  }
  return { timestamp, keypoints, angles, vectors, velocity, activation }
}

function Avatar({ keypointsRef, telemetryRef, videoRef }) {
  const jointRefs = useRef({})
  const boneRefs = useRef([])
  useFrame(() => {
    const video = videoRef.current
    const keypoints = keypointsRef.current
    if (!video?.videoWidth || !keypoints?.length) return
    const points = Object.fromEntries(TRACKED_JOINTS.map((name) => {
      const point = pointFor(keypoints, name)
      return [name, usable(point) ? new THREE.Vector3((point.x / video.videoWidth - 0.5) * 3, -(point.y / video.videoHeight - 0.5) * 4, -(point.z || 0) * 2) : new THREE.Vector3()]
    }))
    Object.entries(jointRefs.current).forEach(([name, ref]) => ref?.position.lerp(points[name], 0.25))
    BONES.forEach(([from, to], index) => {
      const bone = boneRefs.current[index]
      if (!bone) return
      const direction = points[to].clone().sub(points[from])
      bone.position.copy(points[from]).add(points[to]).multiplyScalar(0.5)
      bone.scale.set(1, Math.max(0.05, direction.length()), 1)
      bone.quaternion.slerp(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()), 0.25)
      const load = telemetryRef.current?.activation?.[from.includes('shoulder') ? 'deltoids' : from.includes('elbow') ? 'biceps' : from.includes('hip') ? 'quadriceps' : 'trapezius'] || 0
      bone.material.color.setHSL(0.52 - load / 300, 0.8, 0.5)
    })
  })
  return <group>{BONES.map(([from, to], index) => <mesh key={`${from}-${to}`} ref={(node) => { boneRefs.current[index] = node }}><cylinderGeometry args={[0.045, 0.06, 1, 8]} /><meshStandardMaterial color="#22d3ee" emissive="#083344" /></mesh>)}{TRACKED_JOINTS.map((name) => <mesh key={name} ref={(node) => { jointRefs.current[name] = node }}><sphereGeometry args={[0.08, 12, 12]} /><meshStandardMaterial color="#e2e8f0" emissive="#67e8f9" emissiveIntensity={0.8} /></mesh>)}</group>
}

function MetricBar({ label, value }) {
  return <div className="metric-bar"><div><span>{label}</span><strong>{value ?? '--'}%</strong></div><i><b style={{ width: `${value || 0}%` }} /></i></div>
}

export default function MobilityTracker({ camera, onTelemetry }) {
  const { videoRef, isActive, status: cameraStatus } = camera
  const canvasRef = useRef(null)
  const detectorRef = useRef(null)
  const detectingRef = useRef(false)
  const frameRef = useRef(null)
  const keypointsRef = useRef([])
  const telemetryRef = useRef(null)
  const previousRef = useRef(null)
  const [detectorStatus, setDetectorStatus] = useState('loading')
  const [telemetry, setTelemetry] = useState(null)
  const [detectorError, setDetectorError] = useState('')
  const [webglSupported, setWebglSupported] = useState(false)
  const [webglReady, setWebglReady] = useState(false)

  useEffect(() => {
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('webgl2') || canvas.getContext('webgl')
    const supported = Boolean(context)
    setWebglSupported(supported)
    setWebglReady(supported)
  }, [])

  const handleWebglCreated = ({ gl }) => {
    const canvas = gl.domElement
    const onContextLost = (event) => {
      event.preventDefault()
      setWebglReady(false)
    }
    const onContextRestored = () => setWebglReady(true)
    canvas.addEventListener('webglcontextlost', onContextLost)
    canvas.addEventListener('webglcontextrestored', onContextRestored)
    setWebglReady(true)
  }

  useEffect(() => {
    let disposed = false
    async function initializeDetector() {
      try {
        await tf.setBackend('webgl')
        await tf.ready()
        const detector = await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet, MODEL_OPTIONS)
        const warmup = tf.zeros([256, 256, 3])
        try {
          await detector.estimatePoses(warmup, { flipHorizontal: true })
        } finally {
          warmup.dispose()
        }
        if (disposed) {
          detector.dispose()
          return
        }
        detectorRef.current = detector
        setDetectorStatus('ready')
      } catch (error) {
        console.error('Mobility detector initialization failed', error)
        setDetectorError(error?.message || 'Pose detector unavailable.')
        setDetectorStatus('error')
      }
    }
    initializeDetector()
    return () => {
      disposed = true
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
      detectorRef.current?.dispose()
      detectorRef.current = null
    }
  }, [])

  useEffect(() => {
    let active = true
    const draw = () => {
      if (!active) return
      const video = videoRef.current
      const canvas = canvasRef.current
      if (video && canvas && video.readyState === 4 && video.videoWidth > 0) {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const context = canvas.getContext('2d')
        context?.clearRect(0, 0, canvas.width, canvas.height)
        context?.strokeRect(canvas.width * 0.2, canvas.height * 0.04, canvas.width * 0.6, canvas.height * 0.92)
      }
      frameRef.current = requestAnimationFrame(draw)
    }
    draw()
    return () => { active = false; if (frameRef.current) cancelAnimationFrame(frameRef.current) }
  }, [videoRef])

  useEffect(() => {
    let active = true
    let frameId
    const loop = async () => {
      const video = videoRef.current
      const detector = detectorRef.current
      if (active && detector && video && video.readyState === 4 && video.videoWidth > 0 && !detectingRef.current) {
        detectingRef.current = true
        try {
          const poses = await detector.estimatePoses(video, { flipHorizontal: true })
          if (active) {
            const keypoints = poses[0]?.keypoints || []
            const nextTelemetry = calculateTelemetry(keypoints, previousRef.current, performance.now())
            keypointsRef.current = keypoints
            telemetryRef.current = nextTelemetry
            previousRef.current = nextTelemetry
            setTelemetry(nextTelemetry)
            onTelemetry?.(nextTelemetry)
          }
        } catch (error) {
          console.error('Mobility pose estimation failed', error)
        } finally {
          detectingRef.current = false
        }
      }
      if (active) frameId = requestAnimationFrame(loop)
    }
    frameId = requestAnimationFrame(loop)
    return () => { active = false; cancelAnimationFrame(frameId); detectingRef.current = false }
  }, [onTelemetry, videoRef])

  return (
    <section className="glass-panel tracker-panel" aria-label="Mobility tracker">
      <div className="panel-heading">
        <div><span className="eyebrow">02 / MOBILITY TRACKER</span><h2>Pose and load telemetry</h2></div>
        <span className={`status-pill status-${detectorStatus}`}><Activity size={13} /> {detectorStatus.toUpperCase()}</span>
      </div>
      <div className="tracker-stage">
        <canvas ref={canvasRef} aria-label="Pose tracking bounds" />
        <div className="stage-status"><span>Camera: {cameraStatus === 'active' ? 'Active' : 'Standby'}</span><span>Detector: {detectorStatus === 'ready' ? 'Ready' : detectorStatus}</span><span>Pose Locked: {telemetry?.keypoints?.length >= 8 ? 'Yes' : 'No'}</span></div>
        {!isActive && <div className="empty-state"><Gauge size={26} /><strong>WAITING FOR CAMERA</strong><small>Initialize the webcam portal to begin tracking.</small></div>}
        {detectorError && <div className="error-copy tracker-error" role="alert">{detectorError}</div>}
      </div>
      <div className="tracker-telemetry custom-scrollbar">
        <div className="telemetry-title"><span>JOINT VECTORS / ANGLES</span><Rotate3D size={14} /></div>
        <div className="angle-grid">{[['SHOULDER L', telemetry?.angles?.leftShoulder], ['SHOULDER R', telemetry?.angles?.rightShoulder], ['ELBOW L', telemetry?.angles?.leftElbow], ['ELBOW R', telemetry?.angles?.rightElbow], ['KNEE L', telemetry?.angles?.leftKnee], ['KNEE R', telemetry?.angles?.rightKnee]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{value ?? '--'}°</strong></div>)}</div>
        <div className="vector-summary">Y {telemetry?.vectors?.shoulders?.yaw ?? '--'}° / P {telemetry?.vectors?.shoulders?.pitch ?? '--'}° / R {telemetry?.vectors?.shoulders?.roll ?? '--'}° · VELOCITY {telemetry?.velocity || 0}%</div>
        <div className="muscle-grid">{[['DELTOIDS', telemetry?.activation?.deltoids], ['BICEPS', telemetry?.activation?.biceps], ['TRAPEZIUS', telemetry?.activation?.trapezius], ['QUADRICEPS', telemetry?.activation?.quadriceps]].map(([label, value]) => <MetricBar key={label} label={label} value={value} />)}</div>
      </div>
      <div className="avatar-stage">{webglSupported ? <><Canvas key="avatar-canvas" onCreated={handleWebglCreated} camera={{ position: [0, 0, 6], fov: 40 }}><ambientLight intensity={1.5} /><pointLight position={[2, 2, 4]} intensity={3} color="#67e8f9" /><Avatar keypointsRef={keypointsRef} telemetryRef={telemetryRef} videoRef={videoRef} /></Canvas>{!webglReady && <div className="empty-state"><strong>3D RIG RECOVERING</strong><small>WebGL context is recovering. Camera telemetry remains active.</small></div>}</> : <div className="empty-state"><strong>3D RIG UNAVAILABLE</strong><small>WebGL is not available. Camera telemetry remains active.</small></div>}<span className="avatar-label">3D RIG / LIVE KEYPOINT SYNC</span></div>
    </section>
  )
}

export { angleAtJoint, calculateTelemetry }
