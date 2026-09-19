import { useEffect, useState } from 'react'

const STEPS = [
  { id: 'wellbeing', label: '01 / CHECK-IN', title: 'How did recovery feel?', copy: 'Log the signal that only you can provide. This stays private on the vehicle.', fields: ['Mood / coping', 'Sleep last opportunity'] },
  { id: 'mobility', label: '02 / MOBILITY', title: 'Run a movement check', copy: 'The camera checks posture and joint range locally. No video leaves this device.', fields: ['Camera posture scan', 'Joint-angle confidence'] },
  { id: 'sync', label: '03 / VEHICLE STATUS', title: 'Confirm the environment', copy: 'Review radiation and wearable freshness before the next work block.', fields: ['Dosimeter sync', 'Biometric freshness'] },
]

export default function DailyBriefing({ onClose, onOpenMobility, onComplete, radiationStatus = 'NOMINAL' }) {
  const [step, setStep] = useState(0)
  const [mood, setMood] = useState(7)
  const [sleep, setSleep] = useState(7)
  const current = STEPS[step]

  useEffect(() => {
    const listener = (event) => { if (event.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [onClose])

  const advance = () => {
    if (step < STEPS.length - 1) setStep(step + 1)
    else onComplete?.({ mood, sleep, radiationStatus })
  }

  return <div className="mission-modal-backdrop"><section className="daily-briefing" role="dialog" aria-modal="true" aria-labelledby="briefing-title"><div className="briefing-top"><span className="eyebrow">DAILY MISSION BRIEFING // 60 SEC</span><button className="briefing-close" onClick={onClose} aria-label="Close briefing">×</button></div><div className="briefing-progress"><div style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} /></div><div className="briefing-content"><div><span className="eyebrow">{current.label}</span><h2 id="briefing-title">{current.title}</h2><p>{current.copy}</p></div>{current.id === 'wellbeing' && <div className="briefing-fields"><label>MOOD / COPING <output>{mood} / 10</output><input type="range" min="1" max="10" value={mood} onChange={(event) => setMood(Number(event.target.value))} /></label><label>SLEEP LAST OPPORTUNITY <output>{sleep} HRS</output><input type="range" min="0" max="12" step="0.5" value={sleep} onChange={(event) => setSleep(Number(event.target.value))} /></label></div>}{current.id === 'mobility' && <button className="briefing-action" onClick={onOpenMobility}>OPEN CAMERA MOBILITY CHECK <span>→</span></button>}{current.id === 'sync' && <div className="sync-checks"><div><span className="check-orb" /> DOSIMETER <strong>{radiationStatus}</strong></div><div><span className="check-orb" /> WEARABLES <strong>FRESH · 08 SEC</strong></div><div><span className="check-orb" /> LOCAL STORE <strong>ENCRYPTED</strong></div></div>}</div><div className="briefing-footer"><span className="mono">STEP {step + 1} / {STEPS.length}</span><button className="briefing-next" onClick={advance}>{step === STEPS.length - 1 ? 'COMPLETE BRIEFING' : 'CONTINUE'} <span>→</span></button></div></section></div>
}
