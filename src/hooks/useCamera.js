import { useCallback, useEffect, useRef, useState } from 'react'

const CAMERA_CONSTRAINTS = {
  video: {
    facingMode: { ideal: 'user' },
    width: { ideal: 1280, max: 1920 },
    height: { ideal: 720, max: 1080 },
    frameRate: { ideal: 30, max: 60 },
  },
  audio: false,
}

function messageForCameraError(error) {
  switch (error?.name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return 'Camera permission was denied.'
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No camera was found.'
    case 'NotReadableError':
    case 'TrackStartError':
      return 'The camera is already in use.'
    default:
      return error?.message || 'Camera initialization failed.'
  }
}

export function useCamera() {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    const video = videoRef.current
    if (video) {
      video.pause()
      video.srcObject = null
    }
    setDimensions({ width: 0, height: 0 })
    setStatus('idle')
  }, [])

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('This browser does not support camera access.')
      setStatus('error')
      return false
    }

    stop()
    setError('')
    setStatus('requesting')
    try {
      let stream
      try {
        stream = await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS)
      } catch (strictError) {
        if (['NotAllowedError', 'PermissionDeniedError'].includes(strictError?.name)) throw strictError
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      }
      streamRef.current = stream
      const video = videoRef.current
      if (!video) throw new Error('Camera preview is not mounted.')
      video.srcObject = stream
      await new Promise((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error('Camera video timed out.')), 8000)
        const onMetadata = async () => {
          try {
            await video.play()
            if (video.readyState !== 4 || video.videoWidth === 0) throw new Error('Camera video has no usable frame.')
            window.clearTimeout(timeout)
            video.removeEventListener('loadedmetadata', onMetadata)
            resolve()
          } catch (playError) {
            window.clearTimeout(timeout)
            video.removeEventListener('loadedmetadata', onMetadata)
            reject(playError)
          }
        }
        video.addEventListener('loadedmetadata', onMetadata)
        if (video.readyState >= 1) onMetadata()
      })
      setDimensions({ width: video.videoWidth, height: video.videoHeight })
      setStatus('active')
      return true
    } catch (caught) {
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
      setError(messageForCameraError(caught))
      setStatus('error')
      return false
    }
  }, [stop])

  useEffect(() => stop, [stop])

  return {
    videoRef,
    streamRef,
    status,
    error,
    dimensions,
    isActive: status === 'active',
    start,
    stop,
  }
}

export { CAMERA_CONSTRAINTS, messageForCameraError }
