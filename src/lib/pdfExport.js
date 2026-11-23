import { jsPDF } from 'jspdf'

const PAGE_HEIGHT = 280
const LEFT_MARGIN = 18
const VALUE_X = 72

function safeFilename(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function addFooter(doc) {
  const pageCount = doc.getNumberOfPages()
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page)
    doc.setFontSize(8)
    doc.setTextColor(110, 140, 145)
    doc.text(`ORBITAL HEALTH // LOCAL REPORT // PAGE ${page} OF ${pageCount}`, LEFT_MARGIN, 290)
  }
}

function addSection(doc, title, rows, startY) {
  let y = startY
  if (y > PAGE_HEIGHT - 18) {
    doc.addPage()
    y = 22
  }

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(20, 72, 78)
  doc.text(title, LEFT_MARGIN, y)
  y += 8

  rows.forEach(([label, value]) => {
    const lines = doc.splitTextToSize(`${value ?? '--'}`, 118)
    if (y + Math.max(7, lines.length * 5) > PAGE_HEIGHT) {
      doc.addPage()
      y = 22
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(75, 105, 108)
    doc.text(`${label}:`, LEFT_MARGIN, y)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(25, 45, 48)
    doc.text(lines, VALUE_X, y)
    y += Math.max(7, lines.length * 5)
  })

  return y + 5
}

function createReport({ title, subtitle, observedAt, sections, filename }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  doc.setProperties({ title, subject: subtitle, creator: 'Orbital Health Monitoring System' })

  doc.setFillColor(7, 31, 40)
  doc.rect(0, 0, 210, 42, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(230, 255, 250)
  doc.text(title, LEFT_MARGIN, 19)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(160, 220, 218)
  doc.text(subtitle, LEFT_MARGIN, 28)
  doc.text(`Recorded: ${observedAt || new Date().toISOString()}`, LEFT_MARGIN, 35)

  let y = 55
  sections.forEach((section) => {
    y = addSection(doc, section.title, section.rows, y)
  })

  if (y > PAGE_HEIGHT - 24) {
    doc.addPage()
    y = 22
  }
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(8)
  doc.setTextColor(100, 120, 122)
  doc.text('Local screening report only. This output is not a medical diagnosis.', LEFT_MARGIN, y + 4)
  addFooter(doc)
  doc.save(`${safeFilename(filename)}.pdf`)
}

export function exportMobilityDiagnostic({ result, observedAt }) {
  const stepRows = result.stepScores?.map((step) => [
    step.id.toUpperCase(),
    `Score ${step.score}/100 · Symmetry ${step.symmetry}/100`,
  ]) || []

  createReport({
    title: 'Mobility Diagnostic Report',
    subtitle: 'Flex and hold protocol // local MoveNet screening',
    observedAt,
    filename: `mobility-diagnostic-${observedAt || Date.now()}`,
    sections: [
      {
        title: 'OVERALL RESULT',
        rows: [
          ['Diagnostic', result.diagnostic],
          ['Overall score', `${result.overallScore}/100`],
        ],
      },
      { title: 'PROTOCOL STEPS', rows: stepRows },
    ],
  })
}

export function exportStressInjuryScan({ metrics, zones, overall, triage, activeMode, cameraState, recordedAt }) {
  createReport({
    title: 'Stress and Injury Scan Report',
    subtitle: 'Biometric triage // local sensor fusion',
    observedAt: recordedAt,
    filename: `stress-injury-scan-${recordedAt || Date.now()}`,
    sections: [
      {
        title: 'SCAN SUMMARY',
        rows: [
          ['Triage', triage],
          ['Composite index', `${overall}/100`],
          ['Scan mode', activeMode],
          ['Camera source', cameraState === 'active' ? 'Local camera sensor fusion' : 'Simulated local sensor'],
        ],
      },
      {
        title: 'BIOMARKER PROXIES',
        rows: metrics.map((metric) => [metric.label, `${metric.value}/100 · ${metric.detail}`]),
      },
      {
        title: 'FATIGUE HEATMAP',
        rows: zones.map((zone) => [zone.label, `${zone.value}/100`]),
      },
    ],
  })
}

export function exportFlightSurgeonHandoff({ summary, observedAt }) {
  createReport({
    title: 'Flight Surgeon Handoff Summary',
    subtitle: 'Crew health status // delay-tolerant mission handoff',
    observedAt,
    filename: `flight-surgeon-handoff-${observedAt || Date.now()}`,
    sections: [
      {
        title: 'HANDOFF SUMMARY',
        rows: [['Clinical status', summary]],
      },
    ],
  })
}
