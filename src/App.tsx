import { lazy, Suspense, useEffect, useState } from "react";
import { HashRouter, NavLink, Route, Routes, useNavigate } from "react-router-dom";
import {
  Activity,
  AlertOctagon,
  AlertTriangle,
  Camera,
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Copy,
  Download,
  HeartPulse,
  HelpCircle,
  LockKeyhole,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Stethoscope,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  getAssessments,
  getConflict,
  getDomainSummaries,
  getOutbox,
  recordMeasurement,
  type DomainStatus,
  type DomainSummary,
} from "./services/healthService";
import { exportFlightSurgeonHandoff } from "./lib/pdfExport";

const AITrackingDiagnostic = lazy(() => import("./components/AITrackingDiagnostic"));
const MissionTour = lazy(() => import("./components/MissionTour"));

const navItems = [
  { to: "/", label: "Crew Status", icon: Users },
  { to: "/log", label: "Log Vitals", icon: HeartPulse },
  { to: "/trends", label: "Trends & Baselines", icon: TrendingUp },
  { to: "/actions", label: "Actions & Guidance", icon: ClipboardCheck },
  { to: "/handoff", label: "Sync & Handoff", icon: RefreshCw },
];

function SeverityBadge({ status, compact = false }: { status: DomainStatus | "insufficient"; compact?: boolean }) {
  const config = {
    normal: { label: "Normal", icon: CheckCircle2, color: "text-severity-normal border-severity-normal" },
    watch: { label: "Watch", icon: AlertTriangle, color: "text-severity-watch border-severity-watch" },
    urgent: { label: "Urgent", icon: AlertOctagon, color: "text-severity-urgent border-severity-urgent" },
    critical: { label: "Critical", icon: ShieldAlert, color: "text-severity-critical border-severity-critical" },
    insufficient: { label: "Insufficient / Stale", icon: HelpCircle, color: "text-slate-400 border-slate-500 border-dashed" },
  }[status];
  const Icon = config.icon;
  return <span className={`inline-flex min-h-7 items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-1 font-mono ${compact ? "text-[9px]" : "text-[11px]"} font-bold uppercase ${config.color}`}><Icon size={compact ? 13 : 16} aria-hidden="true" />{config.label}</span>;
}

function Freshness({ text, stale = false }: { text: string; stale?: boolean }) {
  return <span className={`inline-flex min-h-7 items-center gap-1.5 rounded-full font-mono text-[10px] ${stale ? "border border-dashed border-severity-stale px-2 text-slate-400" : "text-slate-400"}`}><Clock3 size={14} aria-hidden="true" />{stale ? "STALE" : text}</span>;
}

function PageHeading({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle: string }) {
  return <header className="mb-5 flex min-h-[76px] items-start justify-between"><div><p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-300">{eyebrow}</p><h1 className="text-3xl font-bold tracking-tight text-mission-text">{title}</h1><p className="mt-2 text-sm text-mission-muted">{subtitle}</p></div></header>;
}

function useLiveClock() {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

function AppShell() {
  const now = useLiveClock();
  const navigate = useNavigate();
  const [tourOpen, setTourOpen] = useState(false);
  const metSeconds = 128 * 86400 + 6 * 3600 + 42 * 60 + 17;
  const met = `S${Math.floor(metSeconds / 86400)} · ${Math.floor(metSeconds % 86400 / 3600).toString().padStart(2, "0")}:${Math.floor(metSeconds % 3600 / 60).toString().padStart(2, "0")}:${(metSeconds % 60).toString().padStart(2, "0")}`;
  return (
    <div className="grid min-h-screen grid-cols-[196px_minmax(0,1fr)] grid-rows-[72px_minmax(0,1fr)] bg-mission-bg text-mission-text max-[1100px]:grid-cols-[84px_minmax(0,1fr)] max-[768px]:block max-[768px]:pb-[76px]">
      <header className="fixed left-0 right-0 top-0 z-40 grid h-[72px] grid-cols-[210px_170px_150px_112px_minmax(180px,1fr)_128px_112px] items-center gap-3 border-b border-mission-border bg-[#111827]/95 px-5 backdrop-blur-md max-[1100px]:grid-cols-[190px_138px_145px_105px_150px_118px_104px] max-[1100px]:px-2 max-[768px]:grid-cols-[1fr_118px_104px] max-[768px]:px-2" aria-label="Mission telemetry">
        <button type="button" className="flex h-11 items-center gap-2 rounded-md border border-mission-border bg-mission-surface px-2 text-left" aria-label="Selected crew member">
          <span className="grid h-10 w-10 place-items-center rounded-full border border-slate-600 bg-slate-700 font-mono text-sm font-bold text-sky-100">AK</span>
          <span><small className="block text-[10px] uppercase tracking-wider text-mission-muted">Crew member</small><strong className="font-mono text-[13px]">Dr. A. Kim</strong></span>
        </button>
        <span className="grid h-11 place-items-center rounded-md border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-center text-xs font-semibold tracking-wider text-sky-300 max-[768px]:hidden">CREW MEDICAL OFFICER</span>
        <div className="flex h-11 flex-col justify-center border-l border-mission-border pl-3 max-[768px]:hidden"><small className="block text-[10px] text-slate-400">MISSION ELAPSED</small><strong className="mono mt-1 block text-[13px]">{met}</strong></div>
        <div className="flex h-11 flex-col justify-center border-l border-mission-border pl-3 max-[768px]:hidden"><small className="block text-[10px] text-slate-400">UTC</small><strong className="mono mt-1 block text-[13px]">{now.toISOString().slice(11, 19)}Z</strong></div>
        <div className="grid h-11 grid-cols-[10px_1fr] content-center items-center gap-x-2 rounded-md border border-mission-border px-2 py-1 max-[768px]:hidden"><span className="row-span-2 self-center h-2 w-2 rounded-full bg-severity-watch" /><small className="text-[10px] text-slate-400">LOCAL</small><strong className="mono col-start-2 text-[11px]">OFFLINE · 3 PENDING</strong></div>
        <button type="button" className="flex h-11 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-red-500/60 bg-red-500/10 px-2 text-xs text-red-200" onClick={() => navigate("/actions")}><AlertTriangle size={18} /><strong className="mono">2</strong><span>Active Alerts</span></button>
        <button type="button" className="flex h-11 items-center justify-center whitespace-nowrap rounded-md border border-sky-500/40 bg-sky-500/10 px-3 text-xs font-semibold text-sky-200 transition-colors hover:bg-sky-500/20" onClick={() => setTourOpen(true)}>Guided Tour</button>
      </header>

      <aside className="fixed bottom-0 left-0 top-[72px] z-30 w-[196px] border-r border-mission-border bg-[#111827] px-3 py-4 max-[1100px]:w-[84px] max-[768px]:top-auto h-[76px] w-full border-r-0 border-t px-1.5" aria-label="Primary navigation">
        <div className="flex h-12 items-center gap-2 px-2 font-mono text-xs font-bold tracking-[0.12em] text-sky-100 max-[1100px]:justify-center max-[768px]:hidden"><Stethoscope size={20} /><span className="max-[1100px]:hidden">AURORA</span></div>
        <nav className="mt-3 flex flex-col gap-1.5 max-[768px]:mt-0 max-[768px]:grid max-[768px]:grid-cols-5">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === "/"} className={({ isActive }) => `flex min-h-16 items-center gap-2 rounded-md border px-3 py-2 text-left text-xs text-slate-400 transition-all duration-200 max-[1100px]:justify-center max-[768px]:min-h-[66px] max-[768px]:flex-col max-[768px]:justify-center max-[768px]:gap-1 max-[768px]:px-1 ${isActive ? "border-l-2 border-l-sky-400 bg-sky-500/10 text-white" : "border-transparent hover:border-slate-700 hover:bg-slate-800/80 hover:text-white"}`}>
              <Icon size={20} aria-hidden="true" /><span className="max-[1100px]:hidden max-[768px]:block max-[768px]:max-w-[72px] max-[768px]:text-center max-[768px]:text-[9px]">{label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <main className="col-start-2 row-start-2 mt-[72px] max-h-[calc(100vh-72px)] overflow-auto px-[clamp(18px,3vw,40px)] pb-12 pt-6 max-[768px]:mt-0 max-[768px]:max-h-none max-[768px]:min-h-[calc(100vh-64px)] max-[768px]:px-3 max-[768px]:pt-4" tabIndex={-1}>
        <Routes>
          <Route path="/" element={<CrewStatus />} />
          <Route path="/log" element={<LogVitals />} />
          <Route path="/trends" element={<Trends />} />
          <Route path="/actions" element={<Actions />} />
          <Route path="/handoff" element={<Handoff />} />
        </Routes>
      </main>
      <Suspense fallback={null}>
        {tourOpen && <MissionTour open={tourOpen} onClose={() => setTourOpen(false)} navigate={navigate} />}
      </Suspense>
    </div>
  );
}

function MetricCard({ domain }: { domain: DomainSummary }) {
  const navigate = useNavigate();
  const accent = domain.title === "Bone"
    ? "border-l-4 border-l-orange-500"
    : domain.title === "Cardiovascular" || domain.title === "Behavioral Health"
      ? "border-l-4 border-l-amber-500"
      : domain.title === "Immune"
        ? "border-l-4 border-l-emerald-500"
        : "";
  const context = (domain.title === "Bone" && domain.metrics[0]?.label === "Weekly loading")
    ? "3 / 4 target"
    : domain.title === "Cardiovascular" && domain.metrics[0]?.label === "Resting heart rate"
      ? "60–85 bpm"
      : null;
  return (
    <article className={`flex min-h-[238px] flex-col rounded-xl border border-slate-800 bg-slate-900/90 p-[18px] shadow-lg shadow-black/20 hover:border-slate-600 transition-all ${accent}`}>
      <header className="flex items-start justify-between gap-3"><h2 className="text-base font-bold">{domain.title}</h2><SeverityBadge status={domain.status} /></header>
      <div className="mt-[18px] flex-1 border-t border-mission-border">
        {domain.metrics.map((metric, index) => <div key={metric.label} className="flex min-h-[54px] items-center justify-between border-b border-mission-border text-xs text-slate-400"><span>{metric.label}</span><div className="text-right"><strong className="mono text-xl text-mission-text">{metric.value} <small className="text-[10px] text-slate-400">{metric.unit}</small></strong>{index === 0 && context && <small className="ml-2 block text-[9px] text-slate-400">Target {context}</small>}</div></div>)}
      </div>
      <footer className="mt-2 flex items-center justify-between"><Freshness text={domain.freshness} stale={domain.stale} /><button type="button" className="min-h-12 px-2 text-xs font-bold text-sky-300" onClick={() => navigate("/trends")}>View details</button></footer>
    </article>
  );
}

function CrewStatus() {
  const navigate = useNavigate();
  const [domains, setDomains] = useState<DomainSummary[]>([]);
  useEffect(() => { getDomainSummaries().then(setDomains); }, []);
  return <section data-tour="crew-triage"><PageHeading eyebrow="CREW STATUS / SOL 128" title="Health overview" subtitle="Dr. A. Kim · Local clinical record" /><div className="mb-4 grid min-h-[72px] grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl border border-orange-500/50 border-l-4 border-l-orange-500 bg-orange-500/10 p-3 shadow-lg shadow-black/20 max-[768px]:grid-cols-[1fr]"><SeverityBadge status="urgent" /><div><strong>Unacknowledged urgent countermeasure</strong><p className="mt-1 text-xs text-slate-300">Bone loading deficit · approved protocol awaiting crew review</p></div><button type="button" className="min-h-12 rounded-md border border-sky-400 bg-sky-700 px-4 text-xs font-bold" onClick={() => navigate("/actions")}>Open actions</button></div><div className="grid grid-cols-2 gap-4 max-[768px]:grid-cols-1">{domains.map((domain) => <MetricCard key={domain.title} domain={domain} />)}</div></section>;
}

function Stepper({ label, value, unit, step, digits = 0, onChange }: { label: string; value: number; unit: string; step: number; digits?: number; onChange: (value: number) => void }) {
  return <div><label className="mb-2 block text-xs text-slate-400">{label}</label><div className="grid h-[72px] grid-cols-[64px_minmax(90px,1fr)_64px] overflow-hidden rounded-lg border border-mission-border bg-[#111827]"><button type="button" aria-label={`Decrease ${label}`} className="border-0 border-r border-slate-700 bg-slate-800 text-2xl transition-all hover:bg-slate-700 active:scale-95" onClick={() => onChange(Number((value - step).toFixed(digits)))}>−</button><div className="grid place-items-center content-center"><strong className="mono text-[22px]">{value.toFixed(digits)}</strong><span className="text-[10px] text-slate-400">{unit}</span></div><button type="button" aria-label={`Increase ${label}`} className="border-0 border-l border-slate-700 bg-slate-800 text-2xl transition-all hover:bg-slate-700 active:scale-95" onClick={() => onChange(Number((value + step).toFixed(digits)))}>+</button></div></div>;
}

function ConfirmModal({ open, title, description, confirmLabel, onConfirm, onClose }: { open: boolean; title: string; description: string; confirmLabel: string; onConfirm: () => void; onClose: () => void }) {
  if (!open) return null;
  return <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/80 p-5" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section role="dialog" aria-modal="true" aria-labelledby="confirm-title" className="w-full max-w-lg rounded-lg border border-slate-500 bg-mission-surface p-5 shadow-2xl"><h2 id="confirm-title" className="mb-3 text-xl font-bold">{title}</h2><p className="text-sm leading-6 text-mission-muted">{description}</p><div className="mt-5 flex justify-end gap-2 max-[520px]:flex-col-reverse"><button type="button" className="min-h-12 rounded-md border border-slate-500 bg-slate-700 px-4 text-xs font-bold" onClick={onClose}>Cancel</button><button type="button" className="min-h-12 rounded-md border border-sky-400 bg-sky-700 px-4 text-xs font-bold" onClick={onConfirm}>{confirmLabel}</button></div></section></div>;
}

function LogVitals() {
  const [tab, setTab] = useState<"manual" | "camera">("manual");
  const [heartRate, setHeartRate] = useState(78);
  const [systolic, setSystolic] = useState(132);
  const [diastolic, setDiastolic] = useState(84);
  const [weight, setWeight] = useState(78.4);
  const [pin, setPin] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [mood, setMood] = useState(6);
  const [stress, setStress] = useState(5);
  const [confirm, setConfirm] = useState(false);
  const [saved, setSaved] = useState("");
  useEffect(() => {
    const openCameraTour = () => setTab("camera");
    window.addEventListener("aurora-tour-camera", openCameraTour);
    return () => window.removeEventListener("aurora-tour-camera", openCameraTour);
  }, []);
  const outOfRange = heartRate > 110 || heartRate < 45 || systolic > 160 || diastolic > 100;
  const saveVitals = () => {
    if (outOfRange) setConfirm(true);
    else void recordMeasurement({ domain: "cardiovascular", metricCode: "resting_heart_rate", value: heartRate, unit: "bpm", source: "manual" }).then(() => setSaved("Vitals saved locally"));
  };
  return <section data-tour="immutable-ingestion"><PageHeading eyebrow="DATA ENTRY / LOCAL" title="Log measurements" subtitle="Measurements are saved to the append-only local health record." /><div className="mb-4 grid w-full max-w-full grid-cols-2 gap-2 overflow-hidden" role="tablist" aria-label="Measurement type"><button type="button" role="tab" aria-selected={tab === "manual"} className={`flex min-h-12 min-w-0 w-full max-w-[240px] items-center justify-center rounded-md border px-4 text-xs ${tab === "manual" ? "border-sky-400 bg-slate-700" : "border-mission-border bg-mission-surface"}`} onClick={() => setTab("manual")}><span className="min-w-0 whitespace-nowrap overflow-hidden text-ellipsis">Manual vitals</span></button><button type="button" role="tab" aria-selected={tab === "camera"} className={`flex min-h-12 min-w-0 w-full max-w-[240px] items-center justify-center rounded-md border px-4 text-xs ${tab === "camera" ? "border-sky-400 bg-slate-700" : "border-mission-border bg-mission-surface"}`} onClick={() => setTab("camera")}><span className="min-w-0 whitespace-nowrap overflow-hidden text-ellipsis">Camera Mobility Scan</span></button></div>
    {tab === "camera" ? <div data-tour="edge-vision"><Suspense fallback={<div className="rounded-lg border border-mission-border bg-mission-surface p-6">Loading camera diagnostic...</div>}><AITrackingDiagnostic onClose={() => setTab("manual")} onSnapshotSaved={(snapshot: { recordedAt: string; diagnostic: string; metrics?: { confidence?: number } }) => { void recordMeasurement({ domain: "bone", metricCode: "bone", value: snapshot.metrics?.confidence ?? 85, unit: "score", source: "sensor", deviceId: "local-camera-movenet" }).then(() => setSaved(`Mobility diagnostic saved locally: ${snapshot.diagnostic}`)); }} /></Suspense></div> : <>
      <div className="mb-4 grid min-h-[64px] grid-cols-3 gap-2 rounded-xl border border-slate-800 bg-slate-900/90 px-3 py-2 shadow-lg shadow-black/20 max-[768px]:grid-cols-1" aria-label="Connected sensor health"><div className="flex min-h-12 items-center gap-2 rounded-full border border-slate-700 bg-slate-800/90 px-3"><Smartphone size={18} className="text-sky-300" /><span className="text-xs text-slate-300">Wrist sensor</span><strong className="ml-auto flex items-center gap-1.5 font-mono text-[10px] text-slate-200"><span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,.75)]" />Connected</strong></div><div className="flex min-h-12 items-center gap-2 rounded-full border border-slate-700 bg-slate-800/90 px-3"><ActivityIcon /><span className="text-xs text-slate-300">BP cuff</span><strong className="ml-auto flex items-center gap-1.5 font-mono text-[10px] text-slate-200"><span className="h-2 w-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,.65)]" />2h ago</strong></div><div className="flex min-h-12 items-center gap-2 rounded-full border border-slate-700 bg-slate-800/90 px-3"><HeartPulse size={18} className="text-sky-300" /><span className="text-xs text-slate-300">Scale</span><strong className="ml-auto flex items-center gap-1.5 font-mono text-[10px] text-slate-200"><span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,.75)]" />Ready</strong></div></div>
      <div className="grid grid-cols-[1.5fr_.8fr] gap-4 max-[768px]:grid-cols-1"><article className="rounded-lg border border-mission-border bg-mission-surface p-[18px]"><header className="flex items-start justify-between"><div><p className="mb-2 font-mono text-[10px] font-semibold text-sky-300">PHYSIOLOGICAL</p><h2 className="text-base font-bold">Vital measurements</h2></div><span className="rounded border border-slate-600 px-2 py-1 font-mono text-[9px]">MANUAL ENTRY</span></header><div className="mt-4 grid grid-cols-2 gap-3 max-[768px]:grid-cols-1"><Stepper label="Resting heart rate" value={heartRate} unit="bpm" step={1} onChange={setHeartRate} /><Stepper label="Systolic" value={systolic} unit="mmHg" step={1} onChange={setSystolic} /><Stepper label="Diastolic" value={diastolic} unit="mmHg" step={1} onChange={setDiastolic} /><Stepper label="Body mass" value={weight} unit="kg" step={0.1} digits={1} onChange={setWeight} /></div>{outOfRange && <div className="mt-3 flex min-h-12 items-center gap-2 rounded-md border border-severity-watch bg-severity-watch/10 p-2 text-xs text-amber-100"><AlertTriangle size={18} />One or more values require confirmation.</div>}<div className="mt-3 flex min-h-16 items-center justify-end gap-3">{saved && <span className="flex items-center gap-1 text-xs text-severity-normal"><Check size={16} />{saved}</span>}<button type="button" className="min-h-12 rounded-md border border-sky-400 bg-sky-700 px-4 text-xs font-bold" onClick={saveVitals}>Save measurement</button></div></article>
      <article data-tour="privacy-checkin" className="min-h-[400px] rounded-lg border border-mission-border bg-mission-surface p-[18px]"><header className="flex justify-between"><div><p className="mb-2 font-mono text-[10px] text-sky-300">CONFIDENTIAL</p><h2 className="text-base font-bold">Behavioral Health</h2></div><LockKeyhole size={20} /></header>{!unlocked ? <div className="mt-5 flex flex-col gap-3"><p className="text-xs leading-5 text-mission-muted">Private crew check-in. Enter the local role PIN.</p><label htmlFor="pin" className="text-xs">Role PIN</label><input id="pin" type="password" inputMode="numeric" value={pin} onChange={(event) => setPin(event.target.value)} className="h-12 rounded-md border border-slate-500 bg-[#111827] px-3 tracking-[0.3em]" /><button type="button" disabled={pin.length < 4} className="min-h-12 rounded-md border border-slate-600 bg-slate-800 px-4 text-xs text-slate-400 disabled:cursor-not-allowed disabled:text-slate-400" onClick={() => setUnlocked(pin === "2468")}>Unlock check-in</button>{pin.length >= 4 && pin !== "2468" && <span className="text-xs text-red-300">PIN not recognized.</span>}</div> : <div className="mt-5 space-y-5"><label className="grid grid-cols-[1fr_auto] text-xs text-mission-muted">Mood <strong className="text-mission-text">{mood} / 10</strong><input className="col-span-2 h-12 w-full accent-sky-400" type="range" min={1} max={10} value={mood} onChange={(event) => setMood(Number(event.target.value))} /></label><label className="grid grid-cols-[1fr_auto] text-xs text-mission-muted">Stress <strong className="text-mission-text">{stress} / 10</strong><input className="col-span-2 h-12 w-full accent-sky-400" type="range" min={1} max={10} value={stress} onChange={(event) => setStress(Number(event.target.value))} /></label><button type="button" className="min-h-12 rounded-md border border-sky-400 bg-sky-700 px-4 text-xs font-bold" onClick={() => void recordMeasurement({ domain: "behavioral_health", metricCode: "behavior", value: mood, unit: "score", source: "manual" }).then(() => setSaved("Private check-in saved locally"))}>Save private check-in</button></div>}</article></div>
    </>}
    <ConfirmModal open={confirm} title="Confirm out-of-range values" description={`Confirm that ${heartRate} bpm and ${systolic}/${diastolic} mmHg were measured correctly before saving.`} confirmLabel="Confirm & save" onClose={() => setConfirm(false)} onConfirm={() => { setConfirm(false); void recordMeasurement({ domain: "cardiovascular", metricCode: "resting_heart_rate", value: heartRate, unit: "bpm", source: "manual" }).then(() => setSaved("Vitals saved locally")); }} />
  </section>;
}

function ActivityIcon() { return <Activity size={18} aria-hidden="true" />; }

const trendData = {
  "Resting HR": { low: 58, high: 84, unit: "bpm", points: [68, 70, 69, 73, 72, 76, 78] },
  "Blood pressure": { low: 118, high: 128, unit: "mmHg", points: [120, 124, 122, 126, 125, 131, 132] },
  Wellbeing: { low: 7, high: 9.5, unit: "score", points: [8.6, 8.2, 8.4, 7.9, 7.6, 7.1, 6.4] },
};

function Trends() {
  const [metric, setMetric] = useState<keyof typeof trendData>("Resting HR");
  const [hovered, setHovered] = useState<number | null>(null);
  const data = trendData[metric];
  const width = 720, height = 260, left = 58, right = 18, top = 24, bottom = 38;
  const all = [...data.points, data.low, data.high];
  const min = Math.min(...all) - 8, max = Math.max(...all) + 8;
  const x = (i: number) => left + i * ((width - left - right) / (data.points.length - 1));
  const y = (v: number) => top + (max - v) * ((height - top - bottom) / (max - min));
  const line = data.points.map((value, i) => `${x(i)},${y(value)}`).join(" ");
  const area = `${left},${height - bottom} ${line} ${width - right},${height - bottom}`;
  const tickValues = [0, 1, 2, 3, 4].map((i) => max - i * ((max - min) / 4));
  const days = ["D-6", "D-5", "D-4", "D-3", "D-2", "D-1", "Today"];
  return <section><PageHeading eyebrow="ANALYSIS / BASELINE" title="Trends & baselines" subtitle="BaselineProfile v4 · Crew-specific normal range" /><div className="mb-3 grid w-full max-w-full grid-cols-3 gap-2 overflow-hidden max-[520px]:grid-cols-1" role="tablist">{Object.keys(trendData).map((name) => <button key={name} type="button" role="tab" aria-selected={metric === name} className={`flex min-h-12 min-w-0 w-full max-w-[220px] items-center justify-center rounded-md border px-4 text-xs ${metric === name ? "border-sky-400 bg-slate-700" : "border-slate-800 bg-slate-900/90 text-slate-400"}`} onClick={() => setMetric(name as keyof typeof trendData)}><span className="min-w-0 whitespace-nowrap overflow-hidden text-ellipsis" title={name}>{name}</span></button>)}</div><article data-tour="baseline-trends" className="rounded-xl border border-slate-800 bg-slate-900/90 p-[18px] shadow-lg shadow-black/20"><header className="flex justify-between"><div><p className="mb-2 font-mono text-[10px] text-sky-300">7-DAY VIEW</p><h2 className="text-base font-bold">{metric}</h2></div><Freshness text="Updated 12m ago" /></header><svg className="mt-3 min-h-[260px] w-full" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${metric} trend with baseline normal range`}><defs><linearGradient id="trend-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#38bdf8" stopOpacity="0.32" /><stop offset="100%" stopColor="#38bdf8" stopOpacity="0.02" /></linearGradient></defs><rect x={left} y={y(data.high)} width={width - left - right} height={y(data.low) - y(data.high)} rx={4} fill="rgba(16,185,129,.11)" stroke="rgba(16,185,129,.35)" /><g stroke="#334155" strokeDasharray="4 6">{tickValues.map((value, i) => <line key={i} x1={left} x2={width-right} y1={top+i*((height-top-bottom)/4)} y2={top+i*((height-top-bottom)/4)} />)}</g>{tickValues.map((value, i) => <text key={i} x={left-10} y={top+i*((height-top-bottom)/4)+4} fill="#94a3b8" fontSize="9" textAnchor="end" className="mono">{Math.round(value)} {data.unit}</text>)}{days.map((day, i) => <text key={day} x={x(i)} y={height-10} fill="#94a3b8" fontSize="9" textAnchor="middle" className="mono">{day}</text>)}<polygon points={area} fill="url(#trend-area)" /><polyline points={line} fill="none" stroke="#38bdf8" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />  {data.points.map((value, i) => <circle key={i} cx={x(i)} cy={y(value)} r={i === data.points.length - 1 ? 7 : 5} fill={i === 5 ? "#F59E0B" : i === 6 ? "#F97316" : "#38bdf8"} stroke="#e0f2fe" strokeWidth={2} className="cursor-crosshair" onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)} onFocus={() => setHovered(i)} onBlur={() => setHovered(null)} tabIndex={0}><title>{`${days[i]} · ${value} ${data.unit}`}</title></circle>)}
  {hovered !== null && (() => {
    const tooltipX = Math.min(width - 150, Math.max(left, x(hovered) - 58));
    const tooltipY = Math.max(top, y(data.points[hovered]) - 48);
    return <g className="pointer-events-none" aria-live="polite"><rect x={tooltipX} y={tooltipY} width={116} height={36} rx={6} fill="#020617" stroke="#38bdf8" strokeWidth={1} /><text x={tooltipX + 58} y={tooltipY + 14} fill="#e2e8f0" fontSize="9" textAnchor="middle" className="mono">{days[hovered]} · EXACT</text><text x={tooltipX + 58} y={tooltipY + 28} fill="#7dd3fc" fontSize="11" textAnchor="middle" className="mono">{data.points[hovered]} {data.unit}</text></g>;
  })()}</svg><div className="flex flex-wrap gap-4 text-[10px] text-slate-400"><span>■ Individual normal range</span><span>— Measurement</span><span>● Questionable or out-of-range</span></div></article><article className="mt-4 rounded-xl border border-slate-800 bg-slate-900/90 p-[18px] shadow-lg shadow-black/20"><h2 className="mb-3 text-base font-bold">Audit trail</h2><div className="grid min-h-[52px] grid-cols-[150px_1fr_auto_auto] items-center gap-2 border-t border-mission-border text-xs text-slate-400 max-[768px]:grid-cols-1"><SeverityBadge status="watch" compact /><span>Reading D-1 marked questionable</span><code>QC-A17</code><button type="button" className="min-h-12 text-sky-300" title="Source: cuff calibration check; retained for review">View audit</button></div><div className="grid min-h-[52px] grid-cols-[150px_1fr_auto_auto] items-center gap-2 border-t border-mission-border text-xs text-slate-400 max-[768px]:grid-cols-1"><SeverityBadge status="insufficient" compact /><span>Today’s reading superseded by corrected record</span><code>EVT-8F21</code><button type="button" className="min-h-12 text-sky-300" title="Correction reason: device sample repeated after fit check">View audit</button></div></article></section>;
}

function Actions() {
  const [completed, setCompleted] = useState<number[]>([]);
  const [modal, setModal] = useState<0 | 1 | 2>(0);
  const [escalated, setEscalated] = useState(false);
  const assessment = getAssessments()[0];
  const steps = ["Prepare approved loading device", "Complete 25-minute protocol", "Record completion and symptoms"];
  const toggle = (index: number) => setCompleted((current) => current.includes(index) ? current.filter((item) => item !== index) : [...current, index]);
  return <section data-tour="guided-actions"><PageHeading eyebrow="DECISION SUPPORT / HUMAN CONTROL" title="Actions & guidance" subtitle="Approved mission configuration · Signed & active" /><article className="mb-4 rounded-xl border border-slate-800 border-l-4 border-l-orange-500 bg-slate-900/90 p-[18px] shadow-lg shadow-black/20"><header className="flex justify-between"><SeverityBadge status="urgent" /><span className="mono text-[11px] text-slate-400">RV-URGENT-BONE-03</span></header><h2 className="mt-3 mb-2 text-xl font-bold">Bone loading cadence below crew target</h2><p className="max-w-3xl text-sm leading-6 text-slate-300">{assessment.rationale}</p><div className="my-3 flex flex-wrap items-center gap-2"><span className="text-[11px] text-slate-400">Trigger measurements</span><button type="button" className="min-h-12 rounded-full border border-slate-700 bg-slate-800/90 px-3 text-xs text-slate-300" title="Device: resistance platform · 1h ago">Loading sessions: 3 / 7d</button><button type="button" className="min-h-12 rounded-full border border-slate-700 bg-slate-800/90 px-3 text-xs text-slate-300" title="Baseline deviation: -18%">Deviation: -18%</button></div><code className="text-[10px] text-slate-300">Rule ID: BON-LOAD-01 · Version: {assessment.ruleVersion}</code></article><article className="rounded-xl border border-slate-800 bg-slate-900/90 p-[18px] shadow-lg shadow-black/20"><header className="flex justify-between"><div><p className="mb-2 font-mono text-[10px] text-sky-300">COUNTERMEASURE</p><h2 className="text-base font-bold">Recovery loading protocol</h2></div><span className="rounded border border-slate-600 px-2 py-1 text-[9px]">SOON</span></header><div className="my-4 grid gap-2">{steps.map((step, index) => <label key={step} className={`grid min-h-16 grid-cols-[26px_38px_1fr] items-center gap-2 rounded-md border px-3 py-2 transition-all ${completed.includes(index) ? "border-emerald-500/40 bg-emerald-500/10" : "border-mission-border bg-[#172033]"}`}><input type="checkbox" className="h-5 w-5 accent-emerald-500" checked={completed.includes(index)} onChange={() => toggle(index)} /><span className={`grid h-8 w-8 place-items-center rounded-full border mono text-[11px] ${completed.includes(index) ? "border-emerald-400 text-emerald-300" : "border-slate-500"}`}>{completed.includes(index) ? <Check size={15} /> : index + 1}</span><span className={completed.includes(index) ? "text-slate-200" : "text-slate-300"}>{step}</span></label>)}</div><div className="flex justify-between gap-2 max-[768px]:flex-col"><button type="button" disabled={completed.length !== steps.length} className={`min-h-12 rounded-md border px-4 text-xs font-bold transition-all disabled:cursor-not-allowed disabled:border-slate-700 disabled:bg-slate-800 disabled:text-slate-400 ${completed.length === steps.length ? "border-sky-300 bg-sky-600 text-white shadow-[0_0_18px_rgba(56,189,248,.38)] hover:bg-sky-500 active:scale-[.98]" : "border-slate-500 bg-slate-700"}`} onClick={() => setModal(1)}>Confirm & acknowledge</button><button type="button" className="flex min-h-12 items-center justify-center gap-2 rounded-md border border-orange-500/60 bg-orange-500/10 px-4 text-xs font-bold text-orange-200" onClick={() => setEscalated(true)}><ShieldCheck size={18} />Flag for Flight Surgeon Escalation</button></div></article>{escalated && <div className="mt-3 flex min-h-[52px] items-center gap-2 rounded-md border border-orange-500/70 bg-orange-500/10 px-3 text-xs text-orange-200"><ShieldCheck size={18} /><strong>Escalation queued</strong><span className="text-slate-400">Flight surgeon review requested locally</span></div>}<ConfirmModal open={modal === 1} title="Acknowledge countermeasure" description="Step 1 of 2: confirm you reviewed the approved protocol and understand this is crew-assisted guidance." confirmLabel="Reviewed — continue" onClose={() => setModal(0)} onConfirm={() => setModal(2)} /><ConfirmModal open={modal === 2} title="Confirm completion" description="Step 2 of 2: confirm the protocol steps are complete and the resulting health record is accurate." confirmLabel="Confirm & acknowledge" onClose={() => setModal(0)} onConfirm={() => setModal(0)} /></section>;
}

function Handoff() {
  const conflict = getConflict();
  const [noteA, setNoteA] = useState("");
  const [noteB, setNoteB] = useState("");
  const [copied, setCopied] = useState(false);
  const summary = `FLIGHT SURGEON HANDOFF SUMMARY\nCrew: Dr. A. Kim (CMO)\nMission: S128 · 06:42 UTC\nOverall: 1 urgent, 1 watch finding\n[URGENT] Bone loading below approved target: 3 of 4 weekly sessions\n[WATCH] Behavioral wellbeing: 6.4 / 10; sleep 5.8 hours\nSynced: Offline · 3 observations pending\nConfig: MED-RULESET-2026.17 · expires 2027-01-14`;
  const copy = async () => { await navigator.clipboard?.writeText(summary); setCopied(true); window.setTimeout(() => setCopied(false), 2500); };
  return <section data-tour="handoff-sync"><PageHeading eyebrow="MISSION LINK / LOCAL RECORD" title="Sync & handoff" subtitle="Delay-tolerant queue and clinical conflict review" /><div className="grid grid-cols-2 gap-4 max-[1100px]:grid-cols-1"><article className="rounded-xl border border-slate-800 bg-slate-900/90 p-[18px] shadow-lg shadow-black/20"><header className="flex justify-between"><div><p className="mb-2 font-mono text-[10px] text-sky-300">AUTO-FORMATTED</p><h2 className="text-base font-bold">Flight Surgeon Handoff Summary</h2></div><Freshness text="Updated now" /></header><pre className="mt-3 min-h-[210px] whitespace-pre-wrap rounded-md border border-mission-border bg-[#111827] p-[14px] font-mono text-[11px] leading-7 text-slate-200">{summary}</pre><div className="mt-3 flex justify-end gap-2"><button type="button" className="flex min-h-12 items-center gap-2 rounded-md border border-slate-500 bg-slate-700 px-4 text-xs font-bold" onClick={copy}><Copy size={16} />{copied ? "Copied" : "Copy"}</button><button type="button" className="flex min-h-12 items-center gap-2 rounded-md border border-sky-400 bg-sky-700 px-4 text-xs font-bold" onClick={() => exportFlightSurgeonHandoff({ summary, observedAt: new Date().toISOString() })}><Download size={16} />Export PDF</button></div></article><article className="rounded-xl border border-slate-800 bg-slate-900/90 p-[18px] shadow-lg shadow-black/20"><header className="flex justify-between"><div><p className="mb-2 font-mono text-[10px] text-sky-300">CLINICAL CONFLICT</p><h2 className="text-base font-bold">{conflict.metric}</h2></div><SeverityBadge status="watch" compact /></header><div className="mt-4 grid grid-cols-2 gap-2 max-[768px]:grid-cols-1"><div className="flex flex-col gap-2 rounded-md border border-mission-border bg-[#172033] p-3"><small className="text-[10px] text-slate-400">{conflict.left.label}</small><strong className="mono text-xl">{conflict.left.value}</strong><span className="text-[10px] text-slate-400">{conflict.left.observedAt} · {conflict.left.source}</span><textarea value={noteA} onChange={(event) => setNoteA(event.target.value)} placeholder="Clinical note (optional)" className="min-h-[72px] rounded-md border border-slate-600 bg-[#111827] p-2 text-xs" /></div><div className="flex flex-col gap-2 rounded-md border border-mission-border bg-[#172033] p-3"><small className="text-[10px] text-slate-400">{conflict.right.label}</small><strong className="mono text-xl">{conflict.right.value}</strong><span className="text-[10px] text-slate-400">{conflict.right.observedAt} · {conflict.right.source}</span><textarea value={noteB} onChange={(event) => setNoteB(event.target.value)} placeholder="Clinical note (optional)" className="min-h-[72px] rounded-md border border-slate-600 bg-[#111827] p-2 text-xs" /></div></div><p className="mt-3 flex items-center gap-2 text-[11px] text-slate-400"><HelpCircle size={16} />Both observations remain in the append-only record.</p></article></div><Outbox /></section>;
}

function Outbox() {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof getOutbox>>>([]);
  useEffect(() => { getOutbox().then(setRows); }, []);
  return <article className="mt-4 rounded-lg border border-mission-border bg-mission-surface p-[18px]"><header className="flex justify-between"><div><p className="mb-2 font-mono text-[10px] text-sky-300">OUTBOX</p><h2 className="text-base font-bold">Sync envelope queue</h2></div><div className="flex flex-col items-end"><span className="flex items-center gap-1 font-mono text-[10px] text-severity-normal"><ShieldCheck size={16} />MED-RULESET-2026.17</span><small className="text-mission-muted">Valid through 14 Jan 2027</small></div></header><div className="mt-3 overflow-x-auto"><table className="w-full border-collapse"><thead><tr className="text-left text-[10px] text-mission-muted"><th className="h-[52px] px-3">Event</th><th className="px-3">Aggregate</th><th className="px-3">Priority</th><th className="px-3">State</th></tr></thead><tbody>{rows.slice(0, 8).map((row) => <tr key={row.eventId} className="border-t border-mission-border text-xs"><td className="h-[52px] px-3"><code>{row.eventId.slice(0, 8)}</code></td><td className="px-3">{row.aggregateType}</td><td className="px-3">{row.priority}</td><td className="px-3"><span className={`inline-flex min-h-7 items-center gap-1 rounded-full border px-2 py-1 font-mono text-[9px] uppercase ${row.syncState === "confirmed" ? "border-severity-normal text-severity-normal" : row.syncState === "conflict" ? "border-severity-urgent text-severity-urgent" : "border-severity-watch text-severity-watch"}`}><Clock3 size={14} />{row.syncState}</span></td></tr>)}</tbody></table></div></article>;
}

export default function App() {
  return <HashRouter><AppShell /></HashRouter>;
}
