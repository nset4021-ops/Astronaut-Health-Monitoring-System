import { createIndexedDbStore, type AppendOnlyStore } from "../lib/indexedDbStore";
import { normalizeMeasurement, IngestionValidationError } from "../domain/ingestion";
import { missionConfig } from "../lib/missionConfig";
import { createSyncEnvelope } from "../lib/syncOutbox";
import { createAuditEntry } from "../lib/auditLog";
import type {
  Assessment,
  BaselineProfile,
  Measurement,
  SyncEnvelope,
} from "../domain/types";

export type DomainStatus = "normal" | "watch" | "urgent" | "critical" | "insufficient";

export interface DomainSummary {
  title: string;
  status: DomainStatus;
  freshness: string;
  stale: boolean;
  metrics: Array<{ label: string; value: string; unit: string }>;
}

export interface ClinicalConflict {
  metric: string;
  left: { label: string; value: string; observedAt: string; source: string };
  right: { label: string; value: string; observedAt: string; source: string };
}

let storePromise: Promise<AppendOnlyStore> | null = null;
let initialized = false;

async function getStore() {
  if (!storePromise) storePromise = createIndexedDbStore();
  const store = await storePromise;
  if (!initialized) {
    initialized = true;
    await seedStore(store);
  }
  return store;
}

async function seedStore(store: AppendOnlyStore) {
  const existing = await store.listMeasurements("crew-1");
  if (existing.length) return;

  const now = Date.now();
  const seed: Array<{
    domain: Measurement["domain"];
    metricCode: string;
    value: number;
    unit: string;
    source: Measurement["source"];
    deviceId?: string;
  }> = [
    { domain: "cardiovascular", metricCode: "resting_heart_rate", value: 78, unit: "bpm", source: "sensor", deviceId: "wearable-04" },
    { domain: "cardiovascular", metricCode: "systolic_pressure", value: 132, unit: "mmHg", source: "manual" },
    { domain: "immune", metricCode: "immune", value: 92, unit: "index", source: "sensor", deviceId: "immune-lab-02" },
    { domain: "bone", metricCode: "bone", value: 3, unit: "sessions / 7d", source: "manual" },
    { domain: "behavioral_health", metricCode: "behavior", value: 6.4, unit: "wellbeing", source: "manual" },
  ];

  for (const item of seed) {
    const eventId = crypto.randomUUID();
    const record = normalizeMeasurement(
      {
        crewMemberId: "crew-1",
        domain: item.domain,
        metricCode: item.metricCode,
        value: item.value,
        unit: item.unit,
        observedAt: new Date(now - (item.domain === "immune" ? 38 : 12) * 60_000).toISOString(),
        missionElapsedSeconds: 128 * 86400 + 6 * 3600 + 42 * 60,
        source: item.source,
        deviceId: item.deviceId,
      },
      eventId,
    );
    await store.appendMeasurement(record);
    await store.enqueueEnvelope(await createSyncEnvelope({
      eventId,
      deviceId: "tablet-1",
      deviceSequence: await nextSequence(),
      aggregateType: "measurement",
      aggregateId: record.id,
      operation: "create",
      occurredAt: record.observedAt,
      missionElapsedSeconds: record.missionElapsedSeconds,
      payload: record,
      priority: item.domain === "bone" ? "high" : "routine",
      syncState: "pending",
    }));
  }
}

let sequence = 40;
async function nextSequence() {
  sequence += 1;
  return sequence;
}

export async function getDomainSummaries(): Promise<DomainSummary[]> {
  await getStore();
  return [
    { title: "Cardiovascular", status: "watch", freshness: "12m ago", stale: false, metrics: [{ label: "Resting heart rate", value: "78", unit: "bpm" }, { label: "Blood pressure", value: "132/84", unit: "mmHg" }] },
    { title: "Immune", status: "normal", freshness: "38m ago", stale: false, metrics: [{ label: "Readiness index", value: "92", unit: "score" }, { label: "Symptoms", value: "0", unit: "active" }] },
    { title: "Bone", status: "urgent", freshness: "1h ago", stale: false, metrics: [{ label: "Weekly loading", value: "3", unit: "sessions" }, { label: "Baseline deviation", value: "-18", unit: "%" }] },
    { title: "Behavioral Health", status: "watch", freshness: "24m ago", stale: false, metrics: [{ label: "Wellbeing", value: "6.4", unit: "score" }, { label: "Sleep", value: "5.8", unit: "hrs" }] },
  ];
}

export async function recordMeasurement(input: {
  domain: Measurement["domain"];
  metricCode: string;
  value: number;
  unit: string;
  source: Measurement["source"];
  deviceId?: string;
}) {
  const store = await getStore();
  const eventId = crypto.randomUUID();
  const record = normalizeMeasurement(
    {
      crewMemberId: "crew-1",
      domain: input.domain,
      metricCode: input.metricCode,
      value: input.value,
      unit: input.unit,
      observedAt: new Date().toISOString(),
      missionElapsedSeconds: 128 * 86400 + 6 * 3600 + 42 * 60,
      source: input.source,
      deviceId: input.deviceId,
    },
    eventId,
  );
  await store.appendMeasurement(record);
  const envelope = await createSyncEnvelope({
    eventId,
    deviceId: "tablet-1",
    deviceSequence: await nextSequence(),
    aggregateType: "measurement",
    aggregateId: record.id,
    operation: "create",
    occurredAt: record.observedAt,
    missionElapsedSeconds: record.missionElapsedSeconds,
    payload: record,
    priority: input.domain === "bone" ? "high" : "routine",
    syncState: "pending",
  });
  await store.enqueueEnvelope(envelope);
  await store.appendAudit(createAuditEntry({
    action: "create",
    actorId: "crew-1",
    role: "crew_medical_officer",
    aggregateType: "measurement",
    aggregateId: record.id,
    missionElapsedSeconds: record.missionElapsedSeconds,
    configSignature: missionConfig.signature,
    payload: record,
  }));
  return record;
}

export async function listMeasurements() {
  const store = await getStore();
  return store.listMeasurements("crew-1");
}

export async function getOutbox(): Promise<SyncEnvelope[]> {
  const store = await getStore();
  const pending = await store.listPendingSync(100);
  const now = new Date().toISOString();
  const conflict: SyncEnvelope = {
    eventId: "evt-conflict-001",
    idempotencyKey: "tablet-1:41:acknowledge:assessment-bone-01",
    deviceId: "tablet-1",
    deviceSequence: 41,
    aggregateType: "assessment",
    aggregateId: "assessment-bone-01",
    operation: "acknowledge",
    occurredAt: now,
    missionElapsedSeconds: 128 * 86400 + 6 * 3600 + 42 * 60,
    payload: { duplicateObservation: true },
    payloadHash: "conflict-demo-payload",
    priority: "high",
    syncState: "conflict",
  };
  const confirmed: SyncEnvelope = {
    eventId: "evt-confirmed-001",
    idempotencyKey: "tablet-1:39:acknowledge:countermeasure-bone-01",
    deviceId: "tablet-1",
    deviceSequence: 39,
    aggregateType: "countermeasure",
    aggregateId: "countermeasure-bone-01",
    operation: "acknowledge",
    occurredAt: now,
    missionElapsedSeconds: 128 * 86400,
    payload: { completed: true },
    payloadHash: "confirmed-demo-payload",
    priority: "high",
    syncState: "confirmed",
  };
  return [...pending, conflict, confirmed].slice(0, 100);
}

export function getAssessments(): Assessment[] {
  const now = new Date().toISOString();
  return [
    {
      id: "assessment-bone-01",
      eventId: "event-assessment-bone-01",
      crewMemberId: "crew-1",
      domain: "bone",
      status: "urgent",
      triggerMeasurementIds: ["measurement-bone-01"],
      missingMetricCodes: [],
      staleMetricCodes: [],
      ruleId: "crew-baseline-v1",
      ruleVersion: "1.0.0",
      thresholdSetId: "demo-bone-v1",
      configSignature: missionConfig.signature,
      rationale: "Three resistive sessions were recorded during the latest seven-day window, below this crew member's approved four-session target.",
      createdAt: now,
      missionElapsedSeconds: 128 * 86400 + 6 * 3600 + 42 * 60,
    },
  ];
}

export function getBaseline(metricCode: string): BaselineProfile {
  const profile = {
    resting_heart_rate: { center: 71, variability: 13, low: 58, high: 84, unit: "bpm" },
    systolic_pressure: { center: 123, variability: 5, low: 118, high: 128, unit: "mmHg" },
    behavior: { center: 8.2, variability: 1.25, low: 7, high: 9.5, unit: "score" },
  } as const;
  const selected = profile[metricCode as keyof typeof profile] ?? profile.resting_heart_rate;
  return {
    id: `baseline-${metricCode}`,
    eventId: `baseline-event-${metricCode}`,
    crewMemberId: "crew-1",
    metricCode,
    baselineWindow: { start: "2026-11-16T00:00:00.000Z", end: "2026-11-22T23:59:59.999Z" },
    center: selected.center,
    variability: selected.variability,
    unit: selected.unit,
    method: "mission_configured",
    thresholdSetId: "demo-baseline-v1",
    effectiveFrom: "2026-11-16T00:00:00.000Z",
    missionElapsedSeconds: 128 * 86400,
    version: 4,
  };
}

export function getConflict(): ClinicalConflict {
  return {
    metric: "Resting heart rate",
    left: { label: "Sensor observation", value: "78 bpm", observedAt: "06:34 UTC", source: "WEARABLE-04" },
    right: { label: "Manual observation", value: "82 bpm", observedAt: "06:36 UTC", source: "MANUAL" },
  };
}

export { IngestionValidationError };
