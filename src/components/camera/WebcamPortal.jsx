import { Camera, CircleStop } from 'lucide-react'
import { motion } from 'framer-motion'

export default function WebcamPortal({ camera }) {
  const { videoRef, status, error, dimensions, start, stop } = camera
  return (
    <motion.section className="glass-panel webcam-portal" aria-label="Webcam portal" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} whileHover={{ y: -2 }} transition={{ duration: 0.35 }}>
      <div className="panel-heading">
        <div>
          <span className="eyebrow">01 / CAMERA PORTAL</span>
          <h2>Live crew feed</h2>
        </div>
        <span className={`status-pill status-${status}`}>{status.toUpperCase()}</span>
      </div>
      <div className="webcam-frame">
        <video ref={videoRef} autoPlay muted playsInline aria-label="Live mobility camera" />
        {status !== 'active' && (
          <div className="empty-state">
            <Camera size={28} />
            <strong>{status === 'error' ? 'CAMERA OFFLINE' : 'CAMERA STANDBY'}</strong>
            <small>{error || 'Initialize the local camera to begin pose tracking.'}</small>
          </div>
        )}
        <div className="feed-overlay">
          <span>STREAM {status === 'active' ? 'LINKED' : 'WAITING'}</span>
          <span>{dimensions.width ? `${dimensions.width} × ${dimensions.height}` : 'NO SIGNAL'}</span>
        </div>
      </div>
      <div className="portal-actions">
        <motion.button type="button" className="primary-button" onClick={status === 'active' ? stop : start} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          {status === 'active' ? <CircleStop size={15} /> : <Camera size={15} />}
          {status === 'active' ? 'STOP CAMERA' : 'INITIALIZE CAMERA'}
        </motion.button>
        {error && <span className="error-copy" role="alert">{error}</span>}
      </div>
    </motion.section>
  )
}
