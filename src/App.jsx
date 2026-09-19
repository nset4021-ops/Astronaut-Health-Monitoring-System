import { useCallback, useMemo, useState } from 'react'
import { HologramScene } from './components/HologramScene'
import { CameraRig, ImmersiveHud, PoseDiagnostics } from './components/ImmersiveHud'
import DailyBriefing from './components/DailyBriefing'
import CountermeasureProtocol from './components/CountermeasureProtocol'
import { acknowledgeAlert, getActiveAlerts, loadHealthState } from './lib/healthStore'
import { useOfflineHealthStorage } from './hooks/useOfflineHealthStorage'
import { useHologramGlitch } from './hooks/useHologramGlitch'
import { useVoiceCommands } from './hooks/useVoiceCommands'
import './styles.css'
import './immersive.css'
import './mission-ux.css'
import './cockpit.css'

function App() {
  const [state, setState] = useState(loadHealthState)
  const [mobilityOpen, setMobilityOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('biometrics')
  const [hudLocked, setHudLocked] = useState(true)
  const [briefingOpen, setBriefingOpen] = useState(false)
  const [countermeasureOpen, setCountermeasureOpen] = useState(false)
  const { isGlitching, triggerGlitch } = useHologramGlitch()
  const offlineHealth = useOfflineHealthStorage()
  const activeAlerts = useMemo(() => getActiveAlerts(state), [state])
  const handleVoiceCommand = useCallback((command) => {
    triggerGlitch()
    if (command === 'mobility') setMobilityOpen(true)
    if (command === 'briefing') setBriefingOpen(true)
    if (command === 'countermeasure' && activeAlerts[0]) setCountermeasureOpen(true)
    if (command === 'radiation') offlineHealth.addHealthLog({ domain: 'radiation', score: 90, status: 'normal', label: 'Radiation telemetry reviewed by voice command' })
  }, [activeAlerts, offlineHealth, triggerGlitch])
  const voice = useVoiceCommands({ onCommand: handleVoiceCommand })
  const acknowledge = (alertId) => {
    triggerGlitch()
    setState(acknowledgeAlert(state, alertId))
  }
  return <main className={`immersive-app ${isGlitching ? 'is-glitching' : ''}`}>
    <div className="scanlines" /><HologramScene selectedMetric={state.activeMetric} onSelectMetric={(activeMetric) => { triggerGlitch(); setState({ ...state, activeMetric }) }} onOpenMobility={() => { setActiveTab('mobility'); setMobilityOpen(true) }} onOpenBriefing={() => { setActiveTab('briefing'); setBriefingOpen(true) }} activeAlert={activeAlerts[0]} onAcknowledge={acknowledge} healthScore={offlineHealth.healthScore} queueLength={offlineHealth.queueLength} alertCount={offlineHealth.alertCount} activeTab={activeTab} onTabChange={setActiveTab} hudLocked={hudLocked} onToggleHud={() => setHudLocked((locked) => !locked)} />
    <ImmersiveHud state={state} activeAlerts={activeAlerts} onTrigger={triggerGlitch} onOpenMobility={() => { setActiveTab('mobility'); setMobilityOpen(true) }} onOpenBriefing={() => { setActiveTab('briefing'); setBriefingOpen(true) }} onApplyCountermeasure={() => setCountermeasureOpen(true)} voice={voice} hudLocked={hudLocked} onToggleHud={() => setHudLocked((locked) => !locked)} />
    {mobilityOpen && <CameraRig onClose={() => setMobilityOpen(false)} onSaved={(snapshot) => { offlineHealth.addMobilityResult({ domain: 'behavioral', score: snapshot?.diagnostic === 'MOBILITY OPTIMAL' ? 92 : 68, status: snapshot?.diagnostic === 'MOBILITY OPTIMAL' ? 'normal' : 'watch', ...snapshot }); triggerGlitch() }} />}
    {briefingOpen && <DailyBriefing onClose={() => setBriefingOpen(false)} onOpenMobility={() => { setBriefingOpen(false); setMobilityOpen(true) }} onComplete={(payload) => { offlineHealth.addHealthLog({ domain: 'behavioral', score: payload.mood >= 7 && payload.sleep >= 7 ? 90 : 72, status: payload.mood >= 7 && payload.sleep >= 7 ? 'normal' : 'watch', label: 'Daily mission briefing complete', ...payload }); setBriefingOpen(false); triggerGlitch() }} />}
    {countermeasureOpen && <CountermeasureProtocol alert={activeAlerts[0]} onClose={() => setCountermeasureOpen(false)} onComplete={() => offlineHealth.addHealthLog({ domain: 'behavioral', score: 84, status: 'normal', label: 'Countermeasure protocol completed' })} />}
    <PoseDiagnostics activeAlerts={activeAlerts.length} />
  </main>
}

export default App
