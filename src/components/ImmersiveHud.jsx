import { Camera, Check, Crosshair, Hand, Rotate3D, WifiOff, X } from 'lucide-react'
import AITrackingDiagnostic from './AITrackingDiagnostic'

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
  return <AITrackingDiagnostic onClose={onClose} onSnapshotSaved={onSaved} />
}

export function PoseDiagnostics({ activeAlerts }) {
  return <div className="pose-diagnostics"><span className="live-dot" /> {activeAlerts} OPEN SIGNALS <span className="diagnostic-divider">|</span> <Check size={13} /> LOCAL RULE ENGINE ACTIVE</div>
}
