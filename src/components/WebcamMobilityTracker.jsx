import { useCallback, useEffect, useRef, useState } from 'react'

const CAMERA_CONSTRAINTS = {
  video: {
    width: { ideal: 1280 },
    height: { ideal: 720 },
    facingMode: 'user',
  },
  audio: false,
}

function getCameraError(error) {
  switch (error?.name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return 'Camera access denied. Allow camera access in your browser settings and try again.'
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No camera found. Connect a camera and try again.'
    case 'NotReadableError':
    case 'TrackStartError':
      return 'The camera is already in use by another application.'
    case 'OverconstrainedError':
      return 'The camera could not meet the requested resolution.'
    case 'SecurityError':
      return 'Camera access was blocked by the browser security policy.'
    default:
      return 'Camera connection failed. Check the device and try again.'
  }
}

/**
 * Camera permission and local mobility-tracking surface.
 *
 * `onPoseFrame` is intentionally library-agnostic. Pass the video element to
 * MediaPipe PoseLandmarker, TensorFlow.js pose detection, or another local
 * inference pipeline from that callback. Video frames never leave the device.
 */
export default function WebcamMobilityTracker({ onPoseFrame, onSnapshotSaved }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const frameRequestRef = useRef(null)
  const [hasPermission, setHasPermission] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [status, setStatus] = useState('idle')
  const [isSecureContext, setIsSecureContext] = useState(true)

  const stopCamera = useCallback(() => {
    if (frameRequestRef.current !== null) {
      cancelAnimationFrame(frameRequestRef.current)
      frameRequestRef.current = null
    }

    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null

    if (videoRef.current) {
      videoRef.current.pause()
      videoRef.current.srcObject = null
    }

    setHasPermission(false)
    setStatus('idle')
  }, [])

  const processPoseFrames = useCallback(() => {
    const video = videoRef.current
    if (!video || video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA || !streamRef.current) {
      return
    }

    // Example integration point:
    // poseLandmarker.detectForVideo(video, performance.now(), onPoseResult)
    // or poseDetector.estimatePoses(video).then(onPoseResult)
    onPoseFrame?.(video, performance.now())
    frameRequestRef.current = requestAnimationFrame(processPoseFrames)
  }, [onPoseFrame])

  const initializeCamera = useCallback(async () => {
    setCameraError('')

    if (!window.isSecureContext) {
      setIsSecureContext(false)
      setStatus('error')
      setCameraError('Camera access requires HTTPS or localhost. Open this mission console in a secure context.')
      return
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('error')
      setCameraError('This browser does not support camera access.')
      return
    }

    stopCamera()
    setIsSecureContext(true)
    setStatus('requesting')

    try {
      // Keep getUserMedia behind this explicit user action so browsers can show
      // their permission prompt and mission crew can make an informed choice.
      const stream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS)
      streamRef.current = stream

      if (!videoRef.current) {
        throw new Error('Camera preview element is unavailable.')
      }

      videoRef.current.srcObject = stream
      await videoRef.current.play()
      setHasPermission(true)
      setStatus('connected')
      frameRequestRef.current = requestAnimationFrame(processPoseFrames)
    } catch (error) {
      stopCamera()
      setStatus('error')
      setCameraError(getCameraError(error))
    }
  }, [processPoseFrames, stopCamera])

  useEffect(() => {
    setIsSecureContext(window.isSecureContext)
    return stopCamera
  }, [stopCamera])

  const saveSnapshot = () => {
    if (!hasPermission) return
    onSnapshotSaved?.({
      recordedAt: new Date().toISOString(),
      source: 'local-webcam',
      status: 'ready-for-local-sync',
    })
    setStatus('snapshot-saved')
  }

  const statusText = {
    idle: 'Camera standby',
    requesting: 'Permission requested',
    connected: 'Camera connected · local tracking ready',
    'snapshot-saved': 'Mobility snapshot saved locally',
    error: cameraError || 'Camera unavailable',
  }[status]

  return (
    <section className="relative w-full max-w-3xl overflow-hidden rounded-xl border border-cyan-400/30 bg-slate-950/75 p-5 text-cyan-50 shadow-[0_0_45px_rgba(34,211,238,0.14)] backdrop-blur-xl" aria-labelledby="mobility-tracker-title">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.04)_1px,transparent_1px)] bg-[size:24px_24px]" />
      <div className="relative z-10 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-cyan-300/60">System calibration / mobility check</p>
          <h2 id="mobility-tracker-title" className="mt-2 text-xl font-medium tracking-wide text-cyan-50">Webcam posture station</h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-cyan-100/60">Camera frames are processed on this device for joint-angle and posture feedback.</p>
        </div>
        <span className={`rounded-full border px-3 py-1 font-mono text-[10px] uppercase tracking-widest ${hasPermission ? 'border-emerald-300/40 bg-emerald-300/10 text-emerald-200' : 'border-cyan-300/25 bg-cyan-300/5 text-cyan-200/70'}`}>
          {hasPermission ? 'Local feed active' : 'Offline ready'}
        </span>
      </div>

      <div className="relative z-10 mt-5 grid gap-4 md:grid-cols-[1.35fr_1fr]">
        <div className="relative aspect-video overflow-hidden rounded-lg border border-cyan-300/20 bg-black/40">
          <video ref={videoRef} className="h-full w-full object-cover [transform:scaleX(-1)]" muted playsInline aria-label="Local mobility camera preview" />
          {!hasPermission && <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-950/60 text-center text-cyan-100/50"><span className="text-2xl text-cyan-300/70">◉</span><span className="font-mono text-[10px] uppercase tracking-widest">Camera feed standby</span></div>}
          <span className="absolute bottom-3 left-3 rounded border border-cyan-300/20 bg-slate-950/70 px-2 py-1 font-mono text-[10px] uppercase tracking-widest text-cyan-200/80">{hasPermission ? 'Live / local landmarks' : 'Awaiting crew authorization'}</span>
        </div>

        <div className="flex flex-col justify-between gap-4 rounded-lg border border-cyan-300/15 bg-cyan-950/20 p-4">
          <div className={`font-mono text-xs leading-5 ${status === 'error' ? 'text-rose-200' : 'text-cyan-100/75'}`} role="status" aria-live="polite">{statusText}</div>
          {!isSecureContext && <p className="text-xs leading-5 text-amber-200/80">Secure context required before the browser can request camera permission.</p>}
          {cameraError && <p className="text-xs leading-5 text-rose-200/90" role="alert">{cameraError}</p>}
          <div className="mt-auto grid gap-2">
            {!hasPermission ? <button type="button" onClick={initializeCamera} className="rounded-md border border-cyan-300/50 bg-cyan-300/10 px-4 py-3 font-mono text-xs uppercase tracking-widest text-cyan-100 transition hover:bg-cyan-300/20 focus:outline-none focus:ring-2 focus:ring-cyan-300/70">Initialize System Camera</button> : <button type="button" onClick={stopCamera} className="rounded-md border border-rose-300/40 bg-rose-300/10 px-4 py-3 font-mono text-xs uppercase tracking-widest text-rose-100 transition hover:bg-rose-300/20 focus:outline-none focus:ring-2 focus:ring-rose-300/70">Stop Camera Feed</button>}
            <button type="button" onClick={saveSnapshot} disabled={!hasPermission} className="rounded-md border border-emerald-300/30 bg-emerald-300/5 px-4 py-3 font-mono text-xs uppercase tracking-widest text-emerald-100 transition hover:bg-emerald-300/15 disabled:cursor-not-allowed disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-emerald-300/70">Save Mobility Snapshot</button>
          </div>
        </div>
      </div>

      <div className="relative z-10 mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-cyan-300/15 pt-3 font-mono text-[10px] uppercase tracking-widest text-cyan-100/45">
        <span>1280 × 720 target</span><span>Audio disabled</span><span>Pose inference hook ready</span>
      </div>
    </section>
  )
}

export { CAMERA_CONSTRAINTS, getCameraError }
