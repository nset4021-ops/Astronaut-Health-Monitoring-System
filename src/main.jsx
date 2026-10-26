import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import DashboardLayout from './components/layout/DashboardLayout'
import './styles.css'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <DashboardLayout />
  </StrictMode>,
)
