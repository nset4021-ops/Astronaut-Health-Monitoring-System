import { useEffect, useState } from 'react'

export default function CountermeasureProtocol({ alert, onClose, onComplete }) {
  const [seconds, setSeconds] = useState(30)
  const [phase, setPhase] = useState('INHALE')
  useEffect(() => {
    const timer = window.setInterval(() => {
      setSeconds((current) => {
        if (current <= 1) { window.clearInterval(timer); setPhase('COMPLETE'); onComplete?.(); return 0 }
        const elapsed = 30 - current
        setPhase(elapsed % 8 < 4 ? 'INHALE' : 'EXHALE')
        return current - 1
      })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [onComplete])

  return <div className="mission-modal-backdrop"><section className="countermeasure-modal" role="dialog" aria-modal="true" aria-labelledby="countermeasure-title"><div className="briefing-top"><span className="eyebrow">COUNTERMEASURE PROTOCOL // LOCAL</span><button className="briefing-close" onClick={onClose} aria-label="Close countermeasure">×</button></div><div className="protocol-orb"><div className="protocol-ring" /><strong>{seconds}</strong><span>SEC</span></div><span className="eyebrow">{alert?.domain || 'MISSION HEALTH'}</span><h2 id="countermeasure-title">{phase === 'COMPLETE' ? 'Protocol complete' : 'Stabilize and reset'}</h2><p>{phase === 'COMPLETE' ? 'Record the response and continue only when you feel ready.' : 'Follow the breathing pace. Keep shoulders relaxed and remain within your safe operating space.'}</p><div className="breath-label">{phase === 'COMPLETE' ? 'READY' : phase}</div><div className="protocol-action">{alert?.action || 'Take the next approved recovery action.'}</div><button className="briefing-next" onClick={onClose}>{phase === 'COMPLETE' ? 'RETURN TO MISSION' : 'END PROTOCOL'} <span>→</span></button></section></div>
}
