import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

type MissionTourProps = {
  open: boolean;
  onClose: () => void;
  navigate: (path: string) => void;
};

type TourStep = {
  route: string;
  target: string;
  tag: string;
  headline: string;
  explanation: string;
  notice: string;
  camera?: boolean;
};

const tourSteps: TourStep[] = [
  {
    route: "/",
    target: "crew-triage",
    tag: "EIMO DECISION SUPPORT",
    headline: "One live picture of crew health",
    explanation:
      "AURORA brings fragmented spacecraft sensor feeds into a zero-connectivity triage dashboard. It organizes risk so crews can act quickly without replacing flight surgeons.",
    notice: "Follow the urgent banner and the four domain status cards.",
  },
  {
    route: "/log",
    target: "immutable-ingestion",
    tag: "IMMUTABLE RECORD",
    headline: "Validated intake, privacy by design",
    explanation:
      "Measurements enter an append-only local health record with range validation and explicit source states. The PIN-gated check-in keeps behavioral health separate and controlled.",
    notice: "Notice sensor freshness, stepper validation, and the locked Behavioral Health card.",
  },
  {
    route: "/log",
    target: "edge-vision",
    tag: "EDGE COMPUTER VISION",
    headline: "Mobility intelligence stays onboard",
    explanation:
      "The Camera Mobility Scan performs on-device pose and range analysis for musculoskeletal readiness. It adds useful bone-health context without sending imagery to the cloud.",
    notice: "Watch the camera tab switch to edge pose tracking and on-device diagnostic status.",
    camera: true,
  },
  {
    route: "/trends",
    target: "baseline-trends",
    tag: "INDIVIDUALIZED BASELINES",
    headline: "Compare people, not just populations",
    explanation:
      "Crew trends are interpreted against personal BaselineProfile ranges rather than a single universal threshold. Freshness and quality states keep stale or uncertain readings visible.",
    notice: "Hover the measurement dots and inspect the units, day labels, normal range, and audit trail.",
  },
  {
    route: "/actions",
    target: "guided-actions",
    tag: "EXPLAINABLE CLINICAL RULES",
    headline: "Rules advise; crew and surgeon remain in control",
    explanation:
      "Versioned mission rules expose their rationale and trigger measurements before a recommendation. A mandatory two-step acknowledgement prevents silent or accidental acceptance.",
    notice: "Inspect Rule BON-LOAD-01, the evidence chips, and the acknowledgement sequence.",
  },
  {
    route: "/handoff",
    target: "handoff-sync",
    tag: "DELAY-TOLERANT SYNC",
    headline: "Safe handoff across a Mars-delay link",
    explanation:
      "Priority SyncEnvelope queues preserve clinical events until communication is available. Side-by-side conflict review is non-destructive, and the PDF handoff gives the Flight Surgeon a concise record.",
    notice: "Point to the outbox priorities, conflict comparison, and one-click PDF export.",
  },
];

export default function MissionTour({ open, onClose, navigate }: MissionTourProps) {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") setStepIndex((current) => Math.min(tourSteps.length - 1, current + 1));
      if (event.key === "ArrowLeft") setStepIndex((current) => Math.max(0, current - 1));
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const step = tourSteps[stepIndex];
    navigate(step.route);
    if (step.camera) window.setTimeout(() => window.dispatchEvent(new CustomEvent("aurora-tour-camera")), 80);

    let attempts = 0;
    const highlight = () => {
      document.querySelectorAll(".tour-spotlight").forEach((element) => element.classList.remove("tour-spotlight"));
      const target = document.querySelector(`[data-tour="${step.target}"]`);
      if (target) {
        target.classList.add("tour-spotlight");
        target.scrollIntoView({ behavior: "smooth", block: "center" });
      } else if (attempts++ < 12) {
        window.setTimeout(highlight, 100);
      }
    };
    window.setTimeout(highlight, 180);
    return () => {
      document.querySelectorAll(".tour-spotlight").forEach((element) => element.classList.remove("tour-spotlight"));
    };
  }, [open, stepIndex, navigate]);

  useEffect(() => {
    if (open) return;
    document.querySelectorAll(".tour-spotlight").forEach((element) => element.classList.remove("tour-spotlight"));
  }, [open]);

  if (!open) return null;
  const step = tourSteps[stepIndex];

  return (
    <aside
      role="dialog"
      aria-modal="false"
      aria-label="Guided Mission Tour"
      className="fixed bottom-5 right-5 z-[90] w-[min(390px,calc(100vw-24px))] rounded-xl border border-sky-500/40 bg-slate-900/95 p-4 shadow-2xl backdrop-blur-md max-[768px]:bottom-[88px]"
    >
      <header className="flex items-start justify-between gap-3 border-b border-slate-700 pb-3">
        <div>
          <p className="font-mono text-[10px] font-semibold tabular-nums text-sky-300">Step {stepIndex + 1} of {tourSteps.length}</p>
          <span className="mt-1 inline-flex rounded border border-sky-500/30 bg-sky-500/10 px-2 py-1 font-mono text-[9px] font-semibold tracking-wider text-sky-200">{step.tag}</span>
        </div>
        <button type="button" onClick={onClose} className="grid h-9 w-9 place-items-center rounded-md border border-slate-600 bg-slate-800 text-slate-200 hover:bg-slate-700" aria-label="Close guided tour"><X size={16} /></button>
      </header>

      <h2 className="mt-3 text-lg font-bold text-white">{step.headline}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-300">{step.explanation}</p>
      <div className="mt-3 rounded-lg border border-sky-500/20 bg-sky-500/5 p-3">
        <strong className="block text-xs text-sky-200">What to notice here</strong>
        <p className="mt-1 text-xs leading-5 text-slate-200">{step.notice}</p>
      </div>

      <footer className="mt-4 flex items-center justify-between gap-2">
        <button type="button" disabled={stepIndex === 0} onClick={() => setStepIndex((current) => Math.max(0, current - 1))} className="flex min-h-11 items-center gap-1 rounded-md border border-slate-600 bg-slate-800 px-3 text-xs font-semibold text-slate-300 disabled:cursor-not-allowed disabled:text-slate-400">
          <ChevronLeft size={15} />Previous
        </button>
        {stepIndex === tourSteps.length - 1 ? (
          <button type="button" onClick={onClose} className="min-h-11 rounded-md border border-sky-400 bg-sky-600 px-4 text-xs font-bold text-white shadow-[0_0_16px_rgba(56,189,248,.28)]">Exit Tour</button>
        ) : (
          <button type="button" onClick={() => setStepIndex((current) => Math.min(tourSteps.length - 1, current + 1))} className="flex min-h-11 items-center gap-1 rounded-md border border-sky-400 bg-sky-600 px-3 text-xs font-bold text-white shadow-[0_0_16px_rgba(56,189,248,.20)]">
            Next Step<ChevronRight size={15} />
          </button>
        )}
      </footer>
    </aside>
  );
}
