import { Camera, CircleStop } from 'lucide-react'

export default function WebcamPortal({ camera }) {
  const { videoRef, status, error, dimensions, start, stop } = camera
  return (
    <section className="glass-panel webcam-portal" aria-label="Webcam portal">
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
        <button type="button" className="primary-button" onClick={status === 'active' ? stop : start}>
          {status === 'active' ? <CircleStop size={15} /> : <Camera size={15} />}
          {status === 'active' ? 'STOP CAMERA' : 'INITIALIZE CAMERA'}
        </button>
        {error && <span className="error-copy" role="alert">{error}</span>}
      </div>
    </section>
  )
}
