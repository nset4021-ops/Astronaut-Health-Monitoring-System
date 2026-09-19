import { Camera, Check, CircleStop, Crosshair, Database, Hand, Rotate3D, WifiOff, X } from 'lucide-react'
import { usePoseTracker } from '../hooks/usePoseTracker'

function Readout({ label, value, tone = 'cyan' }) {
  return <div className="readout"><span>{label}</span><strong className={`tone-${tone}`}>{value}</strong></div>
}

export function ImmersiveHud({ state, activeAlerts, onTrigger, onOpenMobility }) {
  return <>
    <header className="immersive-header">
      <div className="brand-lockup"><span className="brand-glyph">◈</span><div><span className="eyebrow">AURORA MEDICAL // MK-IV</span><strong>ORBITAL <i>HEALTH</i></strong></div></div>
      <div className="hud-status"><span className="live-dot" /> SYSTEM_ONLINE <span className="divider">//</span> SECURE_HOLO_FEED</div>
      <div className="hud-actions"><button onClick={onOpenMobility}><Camera size={15} /> MOBILITY</button><button onClick={onTrigger}><Rotate3D size={15} /> GLITCH</button></div>
    </header>
    <div className="mission-ribbon"><Readout label="MISSION DAY" value="184" /><Readout label="READINESS" value="88%" /><Readout label="OPEN ASSESSMENTS" value={activeAlerts.length} tone={activeAlerts.length ? 'amber' : 'green'} /><Readout label="LOCAL OUTBOX" value={`${state.syncQueue} EVENTS`} /><span className="ribbon-note"><WifiOff size={13} /> OFFLINE READY</span></div>
    <div className="interaction-hint"><Hand size={15} /> DRAG NODES <span>·</span> <Rotate3D size={15} /> ORBIT SCENE <span>·</span> CLICK CORE TO FOCUS</div>
    <div className="clinical-stamp"><Crosshair size={13} /> CLINICAL DECISION SUPPORT<br /><span>NOT A DIAGNOSIS</span></div>
  </>
}

export function CameraRig({ onClose, onSaved }) {
  const { videoRef, pose, status, error, start, stop } = usePoseTracker()
  const tracking = status === 'tracking'
  return <div className="camera-layer"><section className="camera-console" role="dialog" aria-label="Mobility and posture tracker"><div className="camera-title"><div><span className="eyebrow">MOBILITY TELEMETRY / LOCAL PROCESSING</span><h2>Pose station</h2></div><button className="close-button" onClick={() => { stop(); onClose() }} aria-label="Close pose station"><X /></button></div><div className="camera-grid"><div className="camera-feed"><video ref={videoRef} muted playsInline /><div className="pose-corners" /><span className="camera-feed-label">{tracking ? 'LIVE // BODY LANDMARKS' : 'CAMERA FEED STANDBY'}</span>{!tracking && <div className="camera-placeholder"><Camera size={30} /><span>Camera stays on this device.</span></div>}</div><div className="pose-readouts"><Readout label="TRACK STATE" value={status.toUpperCase()} tone={tracking ? 'green' : 'amber'} /><Readout label="CONFIDENCE" value={pose ? `${pose.confidence}%` : '--'} /><Readout label="POSTURE" value={pose?.posture || '--'} /><div className="angle-grid"><Readout label="L KNEE" value={pose?.leftKnee ? `${pose.leftKnee}°` : '--'} /><Readout label="R KNEE" value={pose?.rightKnee ? `${pose.rightKnee}°` : '--'} /><Readout label="L HIP" value={pose?.leftHip ? `${pose.leftHip}°` : '--'} /><Readout label="R HIP" value={pose?.rightHip ? `${pose.rightHip}°` : '--'} /></div><p>Joint angles are computed locally from shoulder, hip, knee, and ankle landmarks. Use this as rehabilitation feedback, not as an autonomous medical decision.</p>{error && <div className="camera-error">{error}</div>}{!tracking ? <button className="camera-button" onClick={start}><Camera size={15} /> ARM CAMERA TRACKING</button> : <button className="camera-button stop" onClick={stop}><CircleStop size={15} /> STOP TRACKING</button>}<button className="save-button" onClick={onSaved}><Database size={14} /> SAVE MOBILITY SNAPSHOT</button></div></div><div className="camera-footer"><span><WifiOff size={13} /> LANDMARKS PROCESSED OFFLINE</span><span>MEDIAPIPE POSE / LITE</span></div></section></div>
}

export function PoseDiagnostics({ activeAlerts }) {
  return <div className="pose-diagnostics"><span className="live-dot" /> {activeAlerts} OPEN SIGNALS <span className="diagnostic-divider">|</span> <Check size={13} /> LOCAL RULE ENGINE ACTIVE</div>
}
