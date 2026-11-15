import { Canvas, useFrame } from '@react-three/fiber'
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { mapLandmarksToPose } from '../../utils/poseAngles'

const BONES = [
  [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
  [11, 23], [12, 24], [23, 24], [23, 25], [25, 27],
  [24, 26], [26, 28], [0, 11], [0, 12],
]

const TRACKED_LANDMARKS = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28]

function pointFor(landmarks, index) {
  const point = landmarks?.[index]
  return point && (point.visibility ?? 1) >= 0.35 ? point : null
}

function pointToScene(point) {
  return new THREE.Vector3(
    (0.5 - (point?.x ?? 0.5)) * 2,
    (0.5 - (point?.y ?? 0.5)) * 2,
    THREE.MathUtils.clamp(-(point?.z ?? 0) * 0.5, -0.5, 0.5),
  )
}

function AvatarSkeleton({ landmarksRef, mode }) {
  const jointRefs = useRef({})
  const boneRefs = useRef([])
  const targetPoints = useRef({})
  const unitUp = useRef(new THREE.Vector3(0, 1, 0))

  useFrame(() => {
    const landmarks = landmarksRef.current
    if (!landmarks?.length) return

    TRACKED_LANDMARKS.forEach((index) => {
      const point = pointFor(landmarks, index)
      if (point) targetPoints.current[index] = pointToScene(point)
    })

    Object.entries(jointRefs.current).forEach(([index, joint]) => {
      const target = targetPoints.current[index]
      if (target && joint) joint.position.lerp(target, 0.3)
    })

    BONES.forEach(([fromIndex, toIndex], boneIndex) => {
      const bone = boneRefs.current[boneIndex]
      const from = targetPoints.current[fromIndex]
      const to = targetPoints.current[toIndex]
      if (!bone || !from || !to) return

      const direction = to.clone().sub(from)
      const length = direction.length()
      if (length < 0.01) return

      bone.position.copy(from).add(to).multiplyScalar(0.5)
      bone.scale.set(1, length, 1)
      bone.quaternion.slerp(
        new THREE.Quaternion().setFromUnitVectors(unitUp.current, direction.normalize()),
        0.35,
      )
    })
  })

  return (
    <group>
      {BONES.map(([fromIndex, toIndex], index) => (
        <mesh key={`${fromIndex}-${toIndex}`} ref={(node) => { boneRefs.current[index] = node }}>
          <cylinderGeometry args={[0.012, 0.018, 1, 8]} />
          <meshStandardMaterial
            color={mode === 'avatar' ? '#fbbf24' : '#22d3ee'}
            emissive={mode === 'avatar' ? '#78350f' : '#083344'}
            emissiveIntensity={1.4}
            transparent
            opacity={0.92}
          />
        </mesh>
      ))}
      {TRACKED_LANDMARKS.map((index) => (
        <mesh key={index} ref={(node) => { jointRefs.current[index] = node }}>
          <sphereGeometry args={[0.035, 10, 10]} />
          <meshStandardMaterial
            color={mode === 'avatar' ? '#f8fafc' : '#67e8f9'}
            emissive="#22d3ee"
            emissiveIntensity={1.8}
          />
        </mesh>
      ))}
    </group>
  )
}

function drawSkeleton2d(canvas, landmarks, width, height) {
  const context = canvas?.getContext('2d')
  if (!context) return
  canvas.width = width
  canvas.height = height
  context.clearRect(0, 0, width, height)
  context.save()
  context.translate(width, 0)
  context.scale(-1, 1)
  context.strokeStyle = 'rgba(103, 232, 249, 0.9)'
  context.fillStyle = '#67e8f9'
  context.lineWidth = 2

  BONES.forEach(([fromIndex, toIndex]) => {
    const from = pointFor(landmarks, fromIndex)
    const to = pointFor(landmarks, toIndex)
    if (!from || !to) return
    context.beginPath()
    context.moveTo(from.x * width, from.y * height)
    context.lineTo(to.x * width, to.y * height)
    context.stroke()
  })

  TRACKED_LANDMARKS.forEach((index) => {
    const point = pointFor(landmarks, index)
    if (!point) return
    context.beginPath()
    context.arc(point.x * width, point.y * height, 3, 0, Math.PI * 2)
    context.fill()
  })
  context.restore()
}

function telemetryFromLandmarks(landmarks, angles) {
  const visibility = landmarks.reduce((sum, point) => sum + (point.visibility ?? 1), 0) / Math.max(1, landmarks.length)
  const shoulderRoll = Math.abs(angles.leftShoulder?.roll || 0) + Math.abs(angles.rightShoulder?.roll || 0)
  return {
    poseLocked: landmarks.length >= 12 && visibility >= 0.35,
    keypoints: landmarks,
    angles,
    velocity: 0,
    activation: {
      deltoids: Math.min(100, Math.round(Math.abs(angles.leftShoulder?.pitch || 0) * 0.7)),
      biceps: Math.min(100, Math.round((Math.abs(angles.leftElbow?.pitch || 0) + Math.abs(angles.rightElbow?.pitch || 0)) * 0.35)),
      quadriceps: Math.min(100, Math.round((Math.abs(angles.leftHip?.pitch || 0) + Math.abs(angles.rightHip?.pitch || 0)) * 0.25)),
      trapezius: Math.min(100, Math.round(shoulderRoll * 0.45)),
    },
  }
}

function usePoseLandmarker(videoRef, onTelemetry) {
  const [landmarks, setLandmarks] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const detectorRef = useRef(null)
  const landmarksRef = useRef([])
  const previousAnglesRef = useRef({})
  const frameRef = useRef(0)

  useEffect(() => {
    let cancelled = false

    async function initialize() {
      try {
        const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision')
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
        )
        const detector = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: 0.45,
          minTrackingConfidence: 0.45,
          minPosePresenceConfidence: 0.45,
        })

        if (cancelled) {
          detector.close?.()
          return
        }

        detectorRef.current = detector
        setStatus('ready')

        const tick = () => {
          const video = videoRef.current
          if (!cancelled && video && video.readyState >= 2 && video.videoWidth > 0) {
            const result = detector.detectForVideo(video, performance.now())
            const nextLandmarks = result?.landmarks?.[0] || []
            if (nextLandmarks.length) {
              const nextAngles = mapLandmarksToPose(nextLandmarks, previousAnglesRef.current, 0.2)
              previousAnglesRef.current = nextAngles
              landmarksRef.current = nextLandmarks
              setLandmarks(nextLandmarks)
              onTelemetry?.(telemetryFromLandmarks(nextLandmarks, nextAngles))
            }
          }
          if (!cancelled) frameRef.current = requestAnimationFrame(tick)
        }
        tick()
      } catch (caught) {
        console.error('Pose landmarker initialization failed', caught)
        setStatus('error')
        setError(caught?.message || 'Pose tracking is unavailable in this browser.')
      }
    }

    void initialize()
    return () => {
      cancelled = true
      cancelAnimationFrame(frameRef.current)
      detectorRef.current?.close?.()
      detectorRef.current = null
    }
  }, [onTelemetry, videoRef])

  return { landmarks, landmarksRef, status, error }
}

export default function SyncedAvatarDiagnostic({ camera, onTelemetry }) {
  const { videoRef, isActive, status: cameraStatus } = camera
  const [mode, setMode] = useState('avatar')
  const [dimensions, setDimensions] = useState({ width: 1280, height: 720 })
  const overlayRef = useRef(null)
  const { landmarks, landmarksRef, status, error } = usePoseLandmarker(videoRef, onTelemetry)

  useEffect(() => {
    const video = videoRef.current
    if (!video) return undefined
    const updateDimensions = () => {
      if (video.videoWidth && video.videoHeight) {
        setDimensions({ width: video.videoWidth, height: video.videoHeight })
      }
    }
    updateDimensions()
    video.addEventListener('loadedmetadata', updateDimensions)
    return () => video.removeEventListener('loadedmetadata', updateDimensions)
  }, [videoRef])

  useEffect(() => {
    drawSkeleton2d(overlayRef.current, landmarks, dimensions.width, dimensions.height)
  }, [dimensions, landmarks])

  return (
    <section className="command-panel center-viewport" aria-label="Live synchronized astronaut viewport">
      <div className="command-panel-heading">
        <div>
          <span className="telemetry-kicker">03 / FLIGHT VISION</span>
          <h2>Live crew digital twin</h2>
        </div>
        <div className="mode-toggle" role="group" aria-label="Viewport mode">
          <button type="button" aria-label="Show live camera skeleton overlay" className={mode === 'skeleton' ? 'is-selected' : ''} onClick={() => setMode('skeleton')}>SKELETON</button>
          <button type="button" aria-label="Show synchronized 3D avatar" className={mode === 'avatar' ? 'is-selected' : ''} onClick={() => setMode('avatar')}>AVATAR</button>
        </div>
      </div>

      <div className="viewport-stage relative w-full h-full overflow-hidden">
        <video ref={videoRef} autoPlay muted playsInline className="absolute inset-0 h-full w-full object-cover -scale-x-100" />
        <canvas ref={overlayRef} className={`pose-overlay ${mode === 'skeleton' ? 'pose-overlay-visible' : ''}`} aria-hidden="true" />
        <Canvas
          className="avatar-canvas"
          orthographic
          camera={{ position: [0, 0, 5], zoom: 1 }}
          dpr={[1, 1.5]}
          gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
          onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
        >
          <ambientLight intensity={0.9} />
          <directionalLight position={[0, 2, 4]} intensity={1.4} color="#f8fafc" />
          <AvatarSkeleton landmarksRef={landmarksRef} mode={mode} />
        </Canvas>

        <div className="hud-reticle" aria-hidden="true">
          <span className="reticle-corner corner-top-left" />
          <span className="reticle-corner corner-top-right" />
          <span className="reticle-corner corner-bottom-left" />
          <span className="reticle-corner corner-bottom-right" />
          <span className="reticle-crosshair" />
          <span className="radar-sweep" />
        </div>
        <div className="hud-dial dial-left" aria-hidden="true"><span>HRV</span><strong>72</strong><small>BPM</small></div>
        <div className="hud-dial dial-right" aria-hidden="true"><span>O2</span><strong>98</strong><small>% SAT</small></div>
        <div className="frequency-wave" aria-hidden="true">
          {Array.from({ length: 18 }, (_, index) => <i key={index} style={{ '--wave-height': `${12 + ((index * 17) % 28)}px` }} />)}
        </div>
        {!isActive && (
          <div className="viewport-empty">
            <strong>CAMERA STANDBY</strong>
            <span>Initialize the local camera to begin pose synchronization.</span>
          </div>
        )}
        <div className="viewport-readout">
          <span>CAM {cameraStatus.toUpperCase()}</span>
          <span>VISION {status.toUpperCase()}</span>
          <span>POSE {landmarks.length >= 12 ? 'LOCKED' : 'SEARCHING'}</span>
        </div>
        <p className="sr-only" aria-live="polite">
          Camera {cameraStatus}. Vision system {status}. Pose {landmarks.length >= 12 ? 'locked' : 'searching'}.
        </p>
      </div>
      {error && <div className="diagnostic-error" role="alert">{error}</div>}
    </section>
  )
}
