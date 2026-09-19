import { useMemo, useState } from 'react'
import { HologramScene } from './components/HologramScene'
import { CameraRig, ImmersiveHud, PoseDiagnostics } from './components/ImmersiveHud'
import { acknowledgeAlert, getActiveAlerts, loadHealthState } from './lib/healthStore'
import { useOfflineHealthStorage } from './hooks/useOfflineHealthStorage'
import { useHologramGlitch } from './hooks/useHologramGlitch'
import './styles.css'
import './immersive.css'

function App() {
  const [state, setState] = useState(loadHealthState)
  const [mobilityOpen, setMobilityOpen] = useState(false)
  const { isGlitching, triggerGlitch } = useHologramGlitch()
  const offlineHealth = useOfflineHealthStorage()
  const activeAlerts = useMemo(() => getActiveAlerts(state), [state])
  const acknowledge = (alertId) => {
    triggerGlitch()
    setState(acknowledgeAlert(state, alertId))
  }
  return <main className={`immersive-app ${isGlitching ? 'is-glitching' : ''}`}>
    <div className="scanlines" /><HologramScene selectedMetric={state.activeMetric} onSelectMetric={(activeMetric) => { triggerGlitch(); setState({ ...state, activeMetric }) }} onOpenMobility={() => setMobilityOpen(true)} activeAlert={activeAlerts[0]} onAcknowledge={acknowledge} healthScore={offlineHealth.healthScore} queueLength={offlineHealth.queueLength} alertCount={offlineHealth.alertCount} />
    <ImmersiveHud state={state} activeAlerts={activeAlerts} onTrigger={triggerGlitch} onOpenMobility={() => setMobilityOpen(true)} />
    {mobilityOpen && <CameraRig onClose={() => setMobilityOpen(false)} onSaved={(snapshot) => { offlineHealth.addMobilityResult({ domain: 'behavioral', score: snapshot?.diagnostic === 'MOBILITY OPTIMAL' ? 92 : 68, status: snapshot?.diagnostic === 'MOBILITY OPTIMAL' ? 'normal' : 'watch', ...snapshot }); triggerGlitch() }} />}
    <PoseDiagnostics activeAlerts={activeAlerts.length} />
  </main>
}

export default App
