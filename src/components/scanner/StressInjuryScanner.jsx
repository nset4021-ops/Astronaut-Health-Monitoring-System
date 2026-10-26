import { HeartPulse, ShieldCheck } from 'lucide-react'

const CARE_CARDS = [
  { title: 'Shoulder load', value: 0, action: 'Maintain neutral scapular alignment', detail: 'Live pose signal required' },
  { title: 'Knee load', value: 0, action: 'Keep knees tracking over ankles', detail: 'Live pose signal required' },
  { title: 'Recovery readiness', value: 0, action: 'Complete a guided mobility hold', detail: 'Derived from current movement' },
]

export default function StressInjuryScanner({ telemetry }) {
  const cards = CARE_CARDS.map((card) => ({
    ...card,
    value: card.title === 'Shoulder load' ? telemetry?.activation?.deltoids || 0 : card.title === 'Knee load' ? telemetry?.activation?.quadriceps || 0 : telemetry?.poseLocked ? 100 - (telemetry?.velocity || 0) : 0,
  }))
  return (
    <section className="glass-panel scanner-panel" aria-label="Bio-care scanner">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">03 / BIO-CARE SCANNER</span>
          <h2>Action cards</h2>
        </div>
        <HeartPulse size={18} />
      </div>
      <div className="care-card-list">
        {cards.map((card) => (
          <article className="care-card" key={card.title}>
            <div className="care-card-title"><span>{card.title}</span><strong>{card.value}%</strong></div>
            <div className="progress-track"><span style={{ width: `${card.value}%` }} /></div>
            <p>{card.action}</p>
            <small><ShieldCheck size={12} /> {card.detail}</small>
          </article>
        ))}
      </div>
    </section>
  )
}
