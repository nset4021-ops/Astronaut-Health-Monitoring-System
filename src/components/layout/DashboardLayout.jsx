import { Component, useCallback, useState } from 'react'
import WebcamPortal from '../camera/WebcamPortal'
import StressInjuryScanner from '../scanner/StressInjuryScanner'
import MobilityTracker from '../tracker/MobilityTracker'
import { useCamera } from '../../hooks/useCamera'

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
  const camera = useCamera()
  const [telemetry, setTelemetry] = useState(null)
  const handleTelemetry = useCallback((nextTelemetry) => setTelemetry(nextTelemetry), [])
  return (
    <DashboardErrorBoundary>
      <main className="dashboard-shell h-screen w-screen overflow-hidden">
        <header className="dashboard-header">
          <div><span className="eyebrow">AURORA MEDICAL // HAB-01</span><h1>Orbital health command</h1></div>
          <div className="header-status"><span className="live-dot" /> LOCAL INFERENCE / OFFLINE READY</div>
        </header>
        <div className="dashboard-grid">
          <WebcamPortal camera={camera} />
          <MobilityTracker camera={camera} onTelemetry={handleTelemetry} />
          <StressInjuryScanner telemetry={telemetry} />
        </div>
        <footer className="dashboard-footer">CLINICAL DECISION SUPPORT · NOT A DIAGNOSIS · CAMERA AND TELEMETRY REMAIN LOCAL TO THIS CONSOLE</footer>
      </main>
    </DashboardErrorBoundary>
  )
}
