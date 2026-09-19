import { useCallback, useEffect, useMemo, useState } from 'react'

const STORAGE_KEY = 'orbital-offline-health-v1'
const SYNC_INTERVAL_MS = 5000

const DEFAULT_STATE = {
  records: [],
  queue: [],
  connectionActive: false,
  lastSyncAt: null,
}

function readState() {
  if (typeof window === 'undefined') return DEFAULT_STATE
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    return saved ? { ...DEFAULT_STATE, ...JSON.parse(saved) } : DEFAULT_STATE
  } catch {
    return DEFAULT_STATE
  }
}

function persistState(state) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  return state
}

function makeRecord(type, payload) {
  return {
    id: crypto.randomUUID(),
    type,
    payload,
    observedAt: new Date().toISOString(),
    source: 'onboard-local',
    schemaVersion: 1,
  }
}

function scoreFromRecords(records) {
  const domainScores = { cardiovascular: 92, bone: 82, immune: 94, behavioral: 78, radiation: 90 }
  records.forEach((record) => {
    const { domain, score } = record.payload || {}
    if (domain && Number.isFinite(score) && domain in domainScores) domainScores[domain] = Math.max(0, Math.min(100, score))
  })
  const weights = { cardiovascular: 0.25, bone: 0.2, immune: 0.2, behavioral: 0.2, radiation: 0.15 }
  return Math.round(Object.entries(domainScores).reduce((total, [domain, score]) => total + score * weights[domain], 0))
}

export function useOfflineHealthStorage() {
  const [state, setState] = useState(readState)

  const commit = useCallback((updater) => {
    setState((current) => {
      const next = typeof updater === 'function' ? updater(current) : updater
      persistState(next)
      return next
    })
  }, [])

  const enqueue = useCallback((type, payload) => {
    const record = makeRecord(type, payload)
    commit((current) => ({ ...current, records: [record, ...current.records], queue: [...current.queue, record] }))
    return record
  }, [commit])

  const addHealthLog = useCallback((payload) => enqueue('health-log', payload), [enqueue])
  const addMobilityResult = useCallback((payload) => enqueue('mobility-check', payload), [enqueue])
  const addRadiationExposure = useCallback((payload) => enqueue('radiation-exposure', payload), [enqueue])

  const setConnectionActive = useCallback((active) => {
    commit((current) => ({ ...current, connectionActive: active }))
  }, [commit])

  const syncQueuedRecords = useCallback(() => {
    commit((current) => {
      if (!current.connectionActive || current.queue.length === 0) return current
      return { ...current, queue: [], lastSyncAt: new Date().toISOString() }
    })
  }, [commit])

  useEffect(() => {
    if (!state.connectionActive || state.queue.length === 0) return undefined
    const timer = window.setInterval(syncQueuedRecords, SYNC_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [state.connectionActive, state.queue.length, syncQueuedRecords])

  const healthScore = useMemo(() => scoreFromRecords(state.records), [state.records])
  const alertCount = useMemo(() => state.records.filter((record) => record.payload?.status === 'urgent' || record.payload?.status === 'watch').length, [state.records])

  return {
    records: state.records,
    queue: state.queue,
    queueLength: state.queue.length,
    connectionActive: state.connectionActive,
    lastSyncAt: state.lastSyncAt,
    healthScore,
    alertCount,
    addHealthLog,
    addMobilityResult,
    addRadiationExposure,
    setConnectionActive,
    syncQueuedRecords,
  }
}

export { DEFAULT_STATE, scoreFromRecords, STORAGE_KEY }
