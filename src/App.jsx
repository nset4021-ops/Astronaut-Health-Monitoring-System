import { useEffect, useMemo, useState } from 'react'
import {
  Activity, AlertTriangle, Check, ClipboardCheck, Copy, Download, HeartPulse,
  HelpCircle, LockKeyhole, Radio, RefreshCw, ShieldCheck, Smartphone,
  Stethoscope, Timer, TrendingUp, Unplug, Users,
} from 'lucide-react'
import { ConfirmModal, FreshnessTag, MetricCard, SeverityBadge } from './components/MissionPrimitives'
import './mission-control.css'

const navItems = [
  { path: '/', label: 'Crew Status', icon: Users },
  { path: '/log', label: 'Log Vitals', icon: HeartPulse },
  { path: '/trends', label: 'Trends & Baselines', icon: TrendingUp },
  { path: '/actions', label: 'Actions & Guidance', icon: ClipboardCheck },
  { path: '/handoff', label: 'Sync & Handoff', icon: RefreshCw },
]

const domains = [
  { title: 'Cardiovascular', status: 'watch', freshness: '12m ago', metrics: [{ label: 'Resting heart rate', value: '78', unit: 'bpm' }, { label: 'Blood pressure', value: '132/84', unit: 'mmHg' }] },
  { title: 'Immune', status: 'normal', freshness: '38m ago', metrics: [{ label: 'Readiness index', value: '92', unit: 'score' }, { label: 'Symptoms', value: '0', unit: 'active' }] },
  { title: 'Bone', status: 'urgent', freshness: '1h ago', metrics: [{ label: 'Weekly loading', value: '3', unit: 'sessions' }, { label: 'Baseline deviation', value: '-18', unit: '%' }] },
  { title: 'Behavioral Health', status: 'watch', freshness: '24m ago', metrics: [{ label: 'Wellbeing', value: '6.4', unit: 'score' }, { label: 'Sleep', value: '5.8', unit: 'hrs' }] },
]

const trendMetrics = {
  'Resting HR': { unit: 'bpm', low: 58, high: 84, center: 71, points: [68, 70, 69, 73, 72, 76, 78] },
  'Blood pressure': { unit: 'mmHg', low: 118, high: 128, center: 123, points: [120, 124, 122, 126, 125, 131, 132] },
  'Wellbeing': { unit: 'score', low: 7, high: 9.5, center: 8.2, points: [8.6, 8.2, 8.4, 7.9, 7.6, 7.1, 6.4] },
}

function useLiveClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])
  return now
}

function App() {
  const [route, setRoute] = useState(window.location.hash.slice(1) || '/')
  const now = useLiveClock()
  useEffect(() => {
    const handler = () => setRoute(window.location.hash.slice(1) || '/')
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])
  const navigate = (path) => { window.location.hash = path }
  const metSeconds = 128 * 86400 + 6 * 3600 + 42 * 60 + 17
  const met = `S${Math.floor(metSeconds / 86400)} : ${Math.floor(metSeconds % 86400 / 3600).toString().padStart(2, '0')}:${Math.floor(metSeconds % 3600 / 60).toString().padStart(2, '0')}:${(metSeconds % 60).toString().padStart(2, '0')}`

  return (
    <div className="mission-shell">
      <header className="telemetry-header" aria-label="Mission telemetry">
        <button className="crew-selector" type="button" aria-label="Selected crew member">
          <span className="crew-avatar">AK</span>
          <span><small>Crew member</small><strong>Dr. A. Kim</strong></span>
        </button>
        <span className="role-badge">CREW MEDICAL OFFICER</span>
        <div className="clock-block"><small>MISSION ELAPSED</small><strong>{met}</strong></div>
        <div className="clock-block"><small>UTC</small><strong>{now.toISOString().slice(11, 19)}Z</strong></div>
        <div className="sync-state"><span className="sync-dot" /><small>LOCAL</small><strong>OFFLINE · 3 PENDING</strong></div>
        <button className="alert-jump" type="button" onClick={() => navigate('/actions')}>
          <AlertTriangle size={18} aria-hidden="true" /><strong>2</strong><span>Active alerts</span>
        </button>
      </header>

      <aside className="navigation-rail" aria-label="Primary navigation">
        <div className="brand-mark"><Stethoscope size={20} aria-hidden="true" /><span>AURORA</span></div>
        <nav>
          {navItems.map(({ path, label, icon: Icon }) => (
            <button key={path} type="button" className={route === path ? 'nav-item active' : 'nav-item'} aria-current={route === path ? 'page' : undefined} onClick={() => navigate(path)}>
              <Icon size={20} aria-hidden="true" /><span>{label}</span>
            </button>
          ))}
        </nav>
      </aside>

      <main className="mission-main" tabIndex="-1">
        {route === '/' && <CrewStatus onNavigate={navigate} />}
        {route === '/log' && <LogVitals />}
        {route === '/trends' && <Trends />}
        {route === '/actions' && <Actions />}
        {route === '/handoff' && <Handoff />}
      </main>
    </div>
  )
}

function PageHeading({ eyebrow, title, subtitle, action }) {
  return (
    <header className="page-heading">
      <div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{subtitle && <p className="page-subtitle">{subtitle}</p>}</div>
      {action}
    </header>
  )
}

function CrewStatus({ onNavigate }) {
  return (
    <section>
      <PageHeading eyebrow="CREW STATUS / SOL 128" title="Health overview" subtitle="Dr. A. Kim · Local clinical record" />
      <div className="alert-banner" role="alert">
        <SeverityBadge severity="critical" />
        <div><strong>Unacknowledged urgent countermeasure</strong><span>Bone loading deficit · approved protocol awaiting crew review</span></div>
        <button className="primary-button" type="button" onClick={() => onNavigate('/actions')}>Open actions</button>
      </div>
      <div className="domain-grid">
        {domains.map((domain) => (
          <MetricCard key={domain.title} {...domain} onDetails={() => onNavigate(domain.title === 'Behavioral Health' ? '/trends' : '/trends')} />
        ))}
      </div>
    </section>
  )
}

function LogVitals() {
  const [heartRate, setHeartRate] = useState(78)
  const [systolic, setSystolic] = useState(132)
  const [diastolic, setDiastolic] = useState(84)
  const [weight, setWeight] = useState(78.4)
  const [behaviorUnlocked, setBehaviorUnlocked] = useState(false)
  const [pin, setPin] = useState('')
  const [mood, setMood] = useState(6)
  const [stress, setStress] = useState(5)
  const [modalOpen, setModalOpen] = useState(false)
  const [saved, setSaved] = useState(false)
  const outOfRange = heartRate > 110 || heartRate < 45 || systolic > 160 || diastolic > 100
  const submit = () => {
    if (outOfRange) setModalOpen(true)
    else { setSaved(true); window.setTimeout(() => setSaved(false), 3000) }
  }

  const Stepper = ({ label, value, unit, step, digits = 0, onChange }) => (
    <div className="entry-field">
      <label>{label}</label>
      <div className="stepper">
        <button type="button" aria-label={`Decrease ${label}`} onClick={() => onChange(Number((value - step).toFixed(digits)))}>−</button>
        <div><strong>{value.toFixed(digits)}</strong><span>{unit}</span></div>
        <button type="button" aria-label={`Increase ${label}`} onClick={() => onChange(Number((value + step).toFixed(digits)))}>+</button>
      </div>
    </div>
  )

  return (
    <section>
      <PageHeading eyebrow="DATA ENTRY / LOCAL" title="Log vitals" subtitle="Measurements are saved to the append-only local health record." />
      <div className="sensor-strip" aria-label="Connected sensor health">
        <div><Smartphone size={18} /><span>Wrist sensor</span><strong className="sensor-ok"><Check size={14} /> Connected</strong></div>
        <div><Activity size={18} /><span>BP cuff</span><strong className="sensor-watch"><AlertTriangle size={14} /> 2h ago</strong></div>
        <div><Radio size={18} /><span>Scale</span><strong className="sensor-ok"><Check size={14} /> Ready</strong></div>
        <FreshnessTag freshness="All systems checked 08:42 UTC" />
      </div>
      <div className="log-grid">
        <article className="panel entry-panel">
          <header className="panel-header"><div><p className="eyebrow">PHYSIOLOGICAL</p><h2>Vital measurements</h2></div><span className="source-tag">MANUAL ENTRY</span></header>
          <div className="stepper-grid">
            <Stepper label="Resting heart rate" value={heartRate} unit="bpm" step={1} onChange={setHeartRate} />
            <Stepper label="Systolic" value={systolic} unit="mmHg" step={1} onChange={setSystolic} />
            <Stepper label="Diastolic" value={diastolic} unit="mmHg" step={1} onChange={setDiastolic} />
            <Stepper label="Body mass" value={weight} unit="kg" step={0.1} digits={1} onChange={setWeight} />
          </div>
          {outOfRange && <div className="range-warning"><AlertTriangle size={18} /><span>One or more values are outside this crew member’s configured entry envelope. Confirmation is required.</span></div>}
          <div className="form-actions">
            {saved && <span className="save-confirmation"><Check size={16} /> Saved locally</span>}
            <button className="primary-button" type="button" onClick={submit}>Save measurement</button>
          </div>
        </article>

        <article className="panel confidential-panel">
          <header className="panel-header"><div><p className="eyebrow">CONFIDENTIAL</p><h2>Behavioral Health</h2></div><LockKeyhole size={20} /></header>
          {!behaviorUnlocked ? (
            <div className="pin-lock">
              <p>Private crew check-in. Enter the local role PIN to continue.</p>
              <label htmlFor="pin">Role PIN</label>
              <input id="pin" type="password" inputMode="numeric" value={pin} onChange={(event) => setPin(event.target.value)} />
              <button className="secondary-button" type="button" disabled={pin.length < 4} onClick={() => setBehaviorUnlocked(pin === '2468')}>Unlock check-in</button>
              {pin.length >= 4 && pin !== '2468' && <span className="pin-error">PIN not recognized.</span>}
            </div>
          ) : (
            <div className="slider-form">
              <label>Mood <strong>{mood} / 10</strong><input type="range" min="1" max="10" value={mood} onChange={(event) => setMood(Number(event.target.value))} /></label>
              <label>Stress <strong>{stress} / 10</strong><input type="range" min="1" max="10" value={stress} onChange={(event) => setStress(Number(event.target.value))} /></label>
              <button className="primary-button" type="button" onClick={() => setSaved(true)}>Save private check-in</button>
            </div>
          )}
        </article>
      </div>
      <ConfirmModal open={modalOpen} title="Confirm out-of-range values" description={`Heart rate ${heartRate} bpm and blood pressure ${systolic}/${diastolic} mmHg may require review. Confirm that the reading was measured correctly.`} confirmLabel="Confirm & save" onClose={() => setModalOpen(false)} onConfirm={() => { setModalOpen(false); setSaved(true) }} />
    </section>
  )
}

function TrendChart({ metricName }) {
  const metric = trendMetrics[metricName]
  const width = 720, height = 260, left = 48, right = 18, top = 24, bottom = 38
  const allValues = [...metric.points, metric.low, metric.high]
  const min = Math.min(...allValues) - 8
  const max = Math.max(...allValues) + 8
  const x = (i) => left + i * ((width - left - right) / (metric.points.length - 1))
  const y = (v) => top + (max - v) * ((height - top - bottom) / (max - min))
  const line = metric.points.map((value, i) => `${x(i)},${y(value)}`).join(' ')
  const bandY = y(metric.high)
  const bandH = y(metric.low) - bandY
  return (
    <svg className="trend-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${metricName} trend with individual baseline normal range`}>
      <rect x={left} y={bandY} width={width - left - right} height={bandH} rx="4" className="baseline-band" />
      <g className="chart-grid">{[0, 1, 2, 3, 4].map((i) => <line key={i} x1={left} x2={width - right} y1={top + i * ((height - top - bottom) / 4)} y2={top + i * ((height - top - bottom) / 4)} />)}</g>
      <polyline points={line} className="trend-line" />
      {metric.points.map((value, i) => (
        <g key={i}>
          <circle cx={x(i)} cy={y(value)} r={i === metric.points.length - 1 ? 7 : 5} className={i === 5 ? 'questionable-point' : i === 6 ? 'out-point' : 'trend-point'}><title>{`Measurement ${i + 1}: ${value} ${metric.unit}`}</title></circle>
        </g>
      ))}
      <text x={left} y={height - 10} className="axis-label">D-6</text><text x={x(3)} y={height - 10} className="axis-label">D-3</text><text x={x(6) - 8} y={height - 10} className="axis-label">TODAY</text>
    </svg>
  )
}

function Trends() {
  const [metric, setMetric] = useState('Resting HR')
  return (
    <section>
      <PageHeading eyebrow="ANALYSIS / BASELINE" title="Trends & baselines" subtitle="BaselineProfile v4 · Crew-specific normal range" />
      <div className="metric-tabs" role="tablist" aria-label="Trend metric">
        {Object.keys(trendMetrics).map((name) => <button key={name} type="button" role="tab" aria-selected={metric === name} className={metric === name ? 'active' : ''} onClick={() => setMetric(name)}>{name}</button>)}
      </div>
      <article className="panel chart-panel">
        <header className="panel-header"><div><p className="eyebrow">7-DAY VIEW</p><h2>{metric}</h2></div><FreshnessTag freshness="Updated 12m ago" /></header>
        <TrendChart metricName={metric} />
        <div className="chart-legend"><span><i className="legend-band" /> Individual normal range</span><span><i className="legend-line" /> Measurement</span><span><i className="legend-questionable" /> Questionable</span></div>
      </article>
      <article className="panel audit-panel">
        <h2>Audit trail</h2>
        <div className="audit-row"><SeverityBadge severity="watch" compact /><span>Reading D-1 marked questionable</span><code>QC-A17</code><button type="button" title="Source: cuff calibration check; retained because it may represent a valid reading.">View audit</button></div>
        <div className="audit-row"><SeverityBadge severity="insufficient" compact /><span>Today’s reading superseded by corrected record</span><code>EVT-8F21</code><button type="button" title="Correction reason: device sample repeated after fit check.">View audit</button></div>
      </article>
    </section>
  )
}

function Actions() {
  const [ackStep, setAckStep] = useState(0)
  const [ackOpen, setAckOpen] = useState(false)
  const [completed, setCompleted] = useState([])
  const steps = ['Prepare approved loading device', 'Complete 25-minute protocol', 'Record completion and symptoms']
  const toggleStep = (index) => setCompleted((current) => current.includes(index) ? current.filter((item) => item !== index) : [...current, index])
  return (
    <section>
      <PageHeading eyebrow="DECISION SUPPORT / HUMAN CONTROL" title="Actions & guidance" subtitle="Approved mission configuration · Signed & active" />
      <article className="assessment-card">
        <header><SeverityBadge severity="urgent" /><span className="rule-version">RV-URGENT-BONE-03</span></header>
        <h2>Bone loading cadence below crew target</h2>
        <p>Three resistive sessions were recorded during the latest seven-day window, below this crew member’s approved four-session target.</p>
        <div className="trigger-chips"><span>Trigger measurements</span><button type="button" title="Device: resistance platform · 1h ago">Loading sessions: 3 / 7d</button><button type="button" title="Baseline deviation: -18%">Deviation: -18%</button></div>
        <code>Rule ID: BON-LOAD-01 · Version: 4.2.1</code>
      </article>
      <article className="panel protocol-panel">
        <header className="panel-header"><div><p className="eyebrow">COUNTERMEASURE</p><h2>Recovery loading protocol</h2></div><span className="priority-chip">SOON</span></header>
        <div className="protocol-list">
          {steps.map((step, index) => (
            <label className={completed.includes(index) ? 'complete' : ''} key={step}>
              <input type="checkbox" checked={completed.includes(index)} onChange={() => toggleStep(index)} />
              <span className="step-number">{index + 1}</span><span>{step}</span>
            </label>
          ))}
        </div>
        <div className="protocol-actions">
          <button className="secondary-button" type="button" onClick={() => setAckOpen(true)} disabled={completed.length !== steps.length}>Confirm & acknowledge</button>
          <button className="escalation-button" type="button" onClick={() => setAckStep(2)}><ShieldCheck size={18} /> Flag for Flight Surgeon Escalation</button>
        </div>
      </article>
      {ackStep === 2 && <div className="escalation-status"><ShieldCheck size={18} /><strong>Escalation queued</strong><span>Flight surgeon review requested locally · high priority</span></div>}
      <ConfirmModal open={ackOpen} title="Acknowledge countermeasure" description="Step 1 of 2: confirm you reviewed the approved protocol and understand this is a crew-assisted guidance workflow." confirmLabel="Reviewed — continue" onClose={() => setAckOpen(false)} onConfirm={() => { setAckOpen(false); setAckStep(1) }} />
      <ConfirmModal open={ackStep === 1} title="Confirm completion" description="Step 2 of 2: confirm the protocol steps are complete and that the resulting health record is accurate." confirmLabel="Confirm & acknowledge" onClose={() => setAckStep(0)} onConfirm={() => setAckStep(2)} />
    </section>
  )
}

function Handoff() {
  const [noteA, setNoteA] = useState('')
  const [noteB, setNoteB] = useState('')
  const [copied, setCopied] = useState(false)
  const summary = useMemo(() => `FLIGHT SURGEON HANDOFF SUMMARY\nCrew: Dr. A. Kim (CMO)\nMission: S128 · 06:42 UTC\nOverall: 1 urgent, 1 watch finding\n— Bone loading below approved target: 3 of 4 weekly sessions\n— Behavioral wellbeing watch: 6.4 / 10; sleep 5.8 hours\nSynced: Offline · 3 observations pending\nConfig: MED-RULESET-2026.17 · expires 2027-01-14`, [])
  const copySummary = async () => { await navigator.clipboard?.writeText(summary); setCopied(true); window.setTimeout(() => setCopied(false), 2500) }
  const download = () => {
    const blob = new Blob([summary], { type: 'text/plain' })
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'flight-surgeon-handoff.txt'; link.click(); URL.revokeObjectURL(link.href)
  }
  const outbox = [
    ['EVT-8F21', 'Assessment', 'High', 'conflict'],
    ['EVT-1A90', 'Measurement', 'Normal', 'pending'],
    ['EVT-5C44', 'Countermeasure', 'High', 'confirmed'],
  ]
  return (
    <section>
      <PageHeading eyebrow="MISSION LINK / LOCAL RECORD" title="Sync & handoff" subtitle="Delay-tolerant queue and clinical conflict review" />
      <div className="handoff-grid">
        <article className="panel handoff-summary">
          <header className="panel-header"><div><p className="eyebrow">AUTO-FORMATTED</p><h2>Flight Surgeon Handoff Summary</h2></div><FreshnessTag freshness="Updated now" /></header>
          <pre>{summary}</pre>
          <div className="form-actions"><button className="secondary-button" type="button" onClick={copySummary}><Copy size={16} /> {copied ? 'Copied' : 'Copy'}</button><button className="primary-button" type="button" onClick={download}><Download size={16} /> Export summary</button></div>
        </article>
        <article className="panel conflict-panel">
          <header className="panel-header"><div><p className="eyebrow">CLINICAL CONFLICT</p><h2>Resting heart rate</h2></div><SeverityBadge severity="watch" compact /></header>
          <div className="conflict-columns">
            <div><small>Sensor observation</small><strong>78 bpm</strong><span>06:34 UTC · SENSOR-04</span><textarea value={noteA} onChange={(event) => setNoteA(event.target.value)} placeholder="Clinical note (optional)" /></div>
            <div><small>Manual observation</small><strong>82 bpm</strong><span>06:36 UTC · MANUAL</span><textarea value={noteB} onChange={(event) => setNoteB(event.target.value)} placeholder="Clinical note (optional)" /></div>
          </div>
          <p className="conflict-preserved"><HelpCircle size={16} /> Both observations remain in the append-only record.</p>
        </article>
      </div>
      <article className="panel outbox-panel">
        <header className="panel-header"><div><p className="eyebrow">OUTBOX</p><h2>Sync envelope queue</h2></div><div className="config-status"><span><ShieldCheck size={16} /> MED-RULESET-2026.17</span><small>Valid through 14 Jan 2027</small></div></header>
        <div className="table-wrap"><table><thead><tr><th>Event</th><th>Aggregate</th><th>Priority</th><th>State</th></tr></thead><tbody>{outbox.map((row) => <tr key={row[0]}><td><code>{row[0]}</code></td><td>{row[1]}</td><td>{row[2]}</td><td><span className={`queue-state ${row[3]}`}>{row[3] === 'confirmed' ? <Check size={14} /> : row[3] === 'conflict' ? <AlertTriangle size={14} /> : <Timer size={14} />}{row[3]}</span></td></tr>)}</tbody></table></div>
      </article>
    </section>
  )
}

export default App
