import { useCallback, useEffect, useRef, useState, type MutableRefObject, type RefObject } from 'react'

export type CameraStatus = 'idle' | 'enumerating' | 'requesting' | 'active' | 'error'

export interface CameraDevice {
  deviceId: string
  label: string
  groupId: string
}

export interface VideoDimensions {
  width: number
  height: number
}

export interface CameraStreamState {
  videoRef: RefObject<HTMLVideoElement | null>
  streamRef: MutableRefObject<MediaStream | null>
  devices: CameraDevice[]
  dimensions: VideoDimensions
  status: CameraStatus
  error: string | null
  isActive: boolean
  start: (deviceId?: string) => Promise<boolean>
  stop: () => void
  refreshDevices: () => Promise<CameraDevice[]>
}

const PREFERRED_CONSTRAINTS: MediaStreamConstraints = {
  video: {
    facingMode: { ideal: 'user' },
    width: { ideal: 1280, max: 1920 },
    height: { ideal: 720, max: 1080 },
    frameRate: { ideal: 30, max: 60 },
  },
  audio: false,
}

const FALLBACK_CONSTRAINTS: MediaStreamConstraints = {
  video: true,
  audio: false,
}

function cameraErrorMessage(error: unknown): string {
  const name = error instanceof DOMException ? error.name : ''
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return 'Camera permission was denied. Allow access and try again.'
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No camera was found. Connect a camera and try again.'
    case 'NotReadableError':
    case 'TrackStartError':
      return 'The camera is already in use by another application.'
    case 'OverconstrainedError':
      return 'The camera could not satisfy the requested constraints.'
    default:
      return error instanceof Error ? error.message : 'Camera initialization failed.'
  }
}

function stopTracks(stream: MediaStream | null): void {
  stream?.getTracks().forEach((track) => track.stop())
}

export function useCameraStream(): CameraStreamState {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [devices, setDevices] = useState<CameraDevice[]>([])
  const [dimensions, setDimensions] = useState<VideoDimensions>({ width: 0, height: 0 })
  const [status, setStatus] = useState<CameraStatus>('idle')
  const [error, setError] = useState<string | null>(null)

  const stop = useCallback((): void => {
    stopTracks(streamRef.current)
    streamRef.current = null
    const video = videoRef.current
    if (video) {
      video.pause()
      video.srcObject = null
    }
    setDimensions({ width: 0, height: 0 })
    setStatus('idle')
  }, [])

  const refreshDevices = useCallback(async (): Promise<CameraDevice[]> => {
    if (!navigator.mediaDevices?.enumerateDevices) {
      setDevices([])
      return []
    }
    setStatus((current) => current === 'active' ? current : 'enumerating')
    try {
      const inputs = await navigator.mediaDevices.enumerateDevices()
      const cameras = inputs
        .filter((device) => device.kind === 'videoinput')
        .map((device) => ({ deviceId: device.deviceId, label: device.label || 'Camera', groupId: device.groupId }))
      setDevices(cameras)
      setStatus((current) => current === 'enumerating' ? 'idle' : current)
      return cameras
    } catch (caught) {
      setError(cameraErrorMessage(caught))
      setStatus('error')
      return []
    }
  }, [])

  const start = useCallback(async (deviceId?: string): Promise<boolean> => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('This browser does not support camera access.')
      setStatus('error')
      return false
    }

    stop()
    setError(null)
    setStatus('requesting')
    const constraints: MediaStreamConstraints = deviceId
      ? { ...PREFERRED_CONSTRAINTS, video: { ...(PREFERRED_CONSTRAINTS.video as MediaTrackConstraints), deviceId: { exact: deviceId } } }
      : PREFERRED_CONSTRAINTS

    try {
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia(constraints)
      } catch (strictError) {
        const strictName = strictError instanceof DOMException ? strictError.name : ''
        if (strictName === 'NotAllowedError' || strictName === 'PermissionDeniedError') throw strictError
        stream = await navigator.mediaDevices.getUserMedia(FALLBACK_CONSTRAINTS)
      }

      const video = videoRef.current
      if (!video) {
        stopTracks(stream)
        throw new Error('Camera preview is not mounted.')
      }
      streamRef.current = stream
      video.srcObject = stream
      await new Promise<void>((resolve, reject) => {
        let settled = false
        const timeout = window.setTimeout(() => {
          if (!settled) reject(new Error('Camera video timed out while loading.'))
        }, 8000)
        const cleanup = (): void => {
          window.clearTimeout(timeout)
          video.removeEventListener('loadedmetadata', onMetadata)
        }
        const onMetadata = async (): Promise<void> => {
          try {
            await video.play()
            if (video.readyState !== 4 || video.videoWidth <= 0 || video.videoHeight <= 0) {
              throw new Error('Camera video has no usable frame.')
            }
            settled = true
            cleanup()
            resolve()
          } catch (playError) {
            settled = true
            cleanup()
            reject(playError)
          }
        }
        video.addEventListener('loadedmetadata', onMetadata)
        if (video.readyState >= HTMLMediaElement.HAVE_METADATA) void onMetadata()
      })
      setDimensions({ width: video.videoWidth, height: video.videoHeight })
      setStatus('active')
      await refreshDevices()
      return true
    } catch (caught) {
      stopTracks(streamRef.current)
      streamRef.current = null
      setError(cameraErrorMessage(caught))
      setStatus('error')
      return false
    }
  }, [refreshDevices, stop])

  useEffect(() => {
    void refreshDevices()
    const onDeviceChange = (): void => { void refreshDevices() }
    navigator.mediaDevices?.addEventListener('devicechange', onDeviceChange)
    return () => {
      navigator.mediaDevices?.removeEventListener('devicechange', onDeviceChange)
      stop()
    }
  }, [refreshDevices, stop])

  return {
    videoRef,
    streamRef,
    devices,
    dimensions,
    status,
    error,
    isActive: status === 'active',
    start,
    stop,
    refreshDevices,
  }
}

export { cameraErrorMessage, FALLBACK_CONSTRAINTS, PREFERRED_CONSTRAINTS }
