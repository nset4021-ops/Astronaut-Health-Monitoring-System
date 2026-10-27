import { Component, lazy, Suspense, useCallback, useState } from 'react'
import { motion } from 'framer-motion'
import DeepSpaceCanvas from '../background/DeepSpaceCanvas'
import WebcamPortal from '../camera/WebcamPortal'
import StressInjuryScanner from '../scanner/StressInjuryScanner'
import { useCameraStream } from '../../hooks/useCameraStream'

const MobilityTracker = lazy(() => import('../tracker/MobilityTracker'))

export class DashboardErrorBoundary extends Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, info) {
    console.error('Dashboard rendering failed', error, info)
  }

  render() {
    if (this.state.hasError) return <main className="app-error"><h1>Mission console unavailable</h1><p>Reload the local dashboard to restart the telemetry surfaces.</p><button type="button" onClick={() => window.location.reload()}>RELOAD CONSOLE</button></main>
    return this.props.children
  }
}

export default function DashboardLayout() {
  const camera = useCameraStream()
  const [telemetry, setTelemetry] = useState(null)
  const handleTelemetry = useCallback((nextTelemetry) => setTelemetry(nextTelemetry), [])
  return (
    <DashboardErrorBoundary>
      <main className="dashboard-shell h-screen w-screen overflow-hidden flex flex-col bg-slate-950 text-slate-100 p-4 gap-4">
        <DeepSpaceCanvas />
        <motion.header className="dashboard-header" initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
          <div><span className="eyebrow">AURORA MEDICAL // HAB-01</span><h1>Orbital health command</h1></div>
          <div className="header-status"><span className="live-dot" /> LOCAL INFERENCE / OFFLINE READY</div>
        </motion.header>
        <div className="dashboard-grid">
          <WebcamPortal camera={camera} />
          <Suspense fallback={<section className="glass-panel tracker-loading" role="status">LOADING FLIGHT VISION TELEMETRY...</section>}>
            <MobilityTracker camera={camera} onTelemetry={handleTelemetry} />
          </Suspense>
          <StressInjuryScanner telemetry={telemetry} />
        </div>
        <footer className="dashboard-footer">CLINICAL DECISION SUPPORT · NOT A DIAGNOSIS · CAMERA AND TELEMETRY REMAIN LOCAL TO THIS CONSOLE</footer>
      </main>
    </DashboardErrorBoundary>
  )
}
