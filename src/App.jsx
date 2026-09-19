import { useMemo, useState } from 'react'
import { HologramScene } from './components/HologramScene'
import { CameraRig, ImmersiveHud, PoseDiagnostics } from './components/ImmersiveHud'
import { acknowledgeAlert, getActiveAlerts, loadHealthState } from './lib/healthStore'
import { useHologramGlitch } from './hooks/useHologramGlitch'
import './styles.css'
import './immersive.css'

function App() {
  const [state, setState] = useState(loadHealthState)
  const [mobilityOpen, setMobilityOpen] = useState(false)
  const { isGlitching, triggerGlitch } = useHologramGlitch()
  const activeAlerts = useMemo(() => getActiveAlerts(state), [state])
  const acknowledge = (alertId) => {
    triggerGlitch()
    setState(acknowledgeAlert(state, alertId))
  }
  return <main className={`immersive-app ${isGlitching ? 'is-glitching' : ''}`}>
    <div className="scanlines" /><HologramScene selectedMetric={state.activeMetric} onSelectMetric={(activeMetric) => { triggerGlitch(); setState({ ...state, activeMetric }) }} onOpenMobility={() => setMobilityOpen(true)} activeAlert={activeAlerts[0]} onAcknowledge={acknowledge} />
    <ImmersiveHud state={state} activeAlerts={activeAlerts} onTrigger={triggerGlitch} onOpenMobility={() => setMobilityOpen(true)} />
    {mobilityOpen && <CameraRig onClose={() => setMobilityOpen(false)} onSaved={() => triggerGlitch()} />}
    <PoseDiagnostics activeAlerts={activeAlerts.length} />
  </main>
}

export default App
