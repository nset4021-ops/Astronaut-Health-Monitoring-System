import { AlertOctagon, AlertTriangle, CheckCircle2, Clock3, HelpCircle, ShieldAlert } from 'lucide-react'

const severityConfig = {
  normal: { label: 'Normal', icon: CheckCircle2, className: 'normal' },
  watch: { label: 'Watch', icon: AlertTriangle, className: 'watch' },
  urgent: { label: 'Urgent', icon: AlertOctagon, className: 'urgent' },
  critical: { label: 'Critical', icon: ShieldAlert, className: 'critical' },
  insufficient: { label: 'Insufficient / Stale', icon: HelpCircle, className: 'insufficient' },
}

export function SeverityBadge({ severity = 'normal', compact = false }) {
  const config = severityConfig[severity] || severityConfig.insufficient
  const Icon = config.icon
  return (
    <span className={`severity-badge severity-${config.className}${compact ? ' compact' : ''}`}>
      <Icon size={compact ? 14 : 16} aria-hidden="true" />
      <span>{config.label}</span>
    </span>
  )
}

export function FreshnessTag({ freshness, stale = false }) {
  return (
    <span className={`freshness-tag${stale ? ' stale' : ''}`}>
      <Clock3 size={14} aria-hidden="true" />
      <span>{stale ? 'STALE' : freshness}</span>
    </span>
  )
}

export function MetricCard({ title, status, metrics, freshness, onDetails }) {
  return (
    <article className="domain-card">
      <header className="domain-card-header">
        <h2>{title}</h2>
        <SeverityBadge severity={status} />
      </header>
      <div className="metric-list">
        {metrics.map((metric) => (
          <div className="metric-row" key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value} <small>{metric.unit}</small></strong>
          </div>
        ))}
      </div>
      <footer className="domain-card-footer">
        <FreshnessTag freshness={freshness} stale={freshness === 'STALE'} />
        <button className="text-button" type="button" onClick={onDetails}>
          View details
        </button>
      </footer>
    </article>
  )
}

export function ConfirmModal({ open, title, description, confirmLabel = 'Confirm', onConfirm, onClose }) {
  if (!open) return null
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title">
        <h2 id="confirm-title">{title}</h2>
        <p>{description}</p>
        <div className="modal-actions">
          <button className="secondary-button" type="button" onClick={onClose}>Cancel</button>
          <button className="primary-button" type="button" onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </section>
    </div>
  )
}
