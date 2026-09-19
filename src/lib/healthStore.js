import { metricDefinitions, telemetryRows } from '../data/metrics'

const STORAGE_KEY = 'orbital-health-console-v1'

const defaultState = {
  activeView: 'overview',
  activeMetric: 'cardio',
  acknowledgedAlerts: [],
  localEvents: [],
  syncQueue: 56,
  lastSavedAt: null,
}

export function loadHealthState() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    return saved ? { ...defaultState, ...JSON.parse(saved) } : defaultState
  } catch {
    return defaultState
  }
}

export function saveHealthState(state) {
  const nextState = { ...state, lastSavedAt: new Date().toISOString() }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState))
  return nextState
}

export function getActiveAlerts(state) {
  return evaluateAlerts(state).filter((alert) => !state.acknowledgedAlerts.includes(`${alert.id}:${alert.status}`))
}

export function evaluateAlerts(state) {
  const alerts = []
  metricDefinitions.forEach((metric) => {
    const value = metric.numericValue
    const isNormal = value >= metric.normal[0] && value <= metric.normal[1]
    if (isNormal) return
    const urgent = value < metric.concern[0] || value > metric.concern[1]
    alerts.push({
      id: `metric-${metric.id}`,
      status: urgent ? 'urgent' : 'watch',
      severity: urgent ? 'URGENT' : 'WATCH',
      domain: metric.label.toUpperCase(),
      title: urgent ? `${metric.label} outside concern boundary` : `${metric.label} needs attention`,
      body: `${metric.detail} is ${value} ${metric.unit}, outside the configured ${isNormal ? 'baseline' : 'watch'} range.`,
      action: metric.countermeasure,
      color: metric.color,
      ruleVersion: 'baseline-v1',
    })
  })
  return alerts
}

export function acknowledgeAlert(state, alertId) {
  const current = evaluateAlerts(state).find((alert) => alert.id === alertId)
  if (!current) return state
  const next = {
    ...state,
    acknowledgedAlerts: [...new Set([...state.acknowledgedAlerts, `${alertId}:${current.status}`])],
    syncQueue: state.syncQueue + 1,
    localEvents: [
      { time: new Date().toISOString().slice(11, 16), label: 'Assessment acknowledged locally', tag: `${current.status.toUpperCase()} // ${alertId.toUpperCase()}` },
      ...state.localEvents,
    ],
  }
  return saveHealthState(next)
}

export function saveCheckIn(state, values) {
  const next = {
    ...state,
    syncQueue: state.syncQueue + 4,
    localEvents: [
      { time: new Date().toISOString().slice(11, 16), label: 'Crew check-in recorded locally', tag: 'PSYCH // PRIVATE' },
      ...state.localEvents,
    ],
  }
  return saveHealthState(next)
}

export function getMetricStatus(metric) {
  return metric.status === 'stable' ? 'STABLE' : 'WATCH'
}

export { defaultState, metricDefinitions, telemetryRows }
