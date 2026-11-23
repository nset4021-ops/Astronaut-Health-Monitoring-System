export type UUID = string;
export type ISODateTime = string;

export type HealthDomain =
  | "immune"
  | "bone"
  | "cardiovascular"
  | "behavioral_health";

export type DataQuality = "valid" | "questionable" | "invalid";
export type AssessmentStatus =
  | "normal"
  | "watch"
  | "urgent"
  | "critical"
  | "insufficient_data";

export type DataFreshness =
  | "current"
  | "stale"
  | "missing"
  | "not_applicable";

export type MeasurementSource =
  | "sensor"
  | "manual"
  | "imported"
  | "derived";

export interface Measurement {
  id: UUID;
  eventId: UUID;
  crewMemberId: UUID;
  domain: HealthDomain;
  metricCode: string;
  value: number | null;
  unit: string;
  observedAt: ISODateTime;
  ingestedAt: ISODateTime;
  missionElapsedSeconds: number;
  source: MeasurementSource;
  deviceId?: string;
  quality: DataQuality;
  freshness: Exclude<DataFreshness, "not_applicable">;
  rawPayloadRef?: string;
  rawPayloadChecksum?: string;
  schemaVersion: number;
  correctionOfId?: UUID;
  correctionReason?: string;
  superseded?: boolean;
  supersededById?: UUID;
  supersededAt?: ISODateTime;
  supersededReason?: string;
}

export interface BaselineProfile {
  id: UUID;
  eventId: UUID;
  crewMemberId: UUID;
  metricCode: string;
  baselineWindow: { start: ISODateTime; end: ISODateTime };
  center: number;
  variability: number;
  unit: string;
  method: "mission_configured" | "crew_baseline" | "clinician_entered";
  thresholdSetId: UUID;
  approvedBy?: UUID;
  effectiveFrom: ISODateTime;
  effectiveUntil?: ISODateTime;
  missionElapsedSeconds: number;
  version: number;
}

export interface Assessment {
  id: UUID;
  eventId: UUID;
  crewMemberId: UUID;
  domain: HealthDomain;
  status: AssessmentStatus;
  triggerMeasurementIds: UUID[];
  missingMetricCodes: string[];
  staleMetricCodes: string[];
  ruleId: string;
  ruleVersion: string;
  thresholdSetId: string;
  configSignature: string;
  rationale: string;
  createdAt: ISODateTime;
  missionElapsedSeconds: number;
  expiresAt?: ISODateTime;
  clinicianNotes?: string;
  acknowledgedAt?: ISODateTime;
  acknowledgedBy?: UUID;
  overriddenAt?: ISODateTime;
  overriddenBy?: UUID;
  overrideReason?: string;
}

export interface Countermeasure {
  id: UUID;
  eventId: UUID;
  assessmentId: UUID;
  actionCode: string;
  title: string;
  instructions: string[];
  priority: "routine" | "soon" | "immediate";
  requiresConfirmation: boolean;
  escalationPath: string;
  configVersion: string;
  configSignature: string;
  status: "offered" | "accepted" | "declined" | "completed" | "escalated";
  createdAt: ISODateTime;
  missionElapsedSeconds: number;
  recordedAt?: ISODateTime;
  acknowledgedBy?: UUID;
  acknowledgementReason?: string;
}

export type SyncState =
  | "pending"
  | "sent"
  | "confirmed"
  | "conflict"
  | "dead_letter";

export interface SyncEnvelope {
  eventId: UUID;
  idempotencyKey: string;
  deviceId: string;
  deviceSequence: number;
  aggregateType:
    | "measurement"
    | "baseline"
    | "assessment"
    | "countermeasure"
    | "audit";
  aggregateId: UUID;
  operation: "create" | "acknowledge" | "override" | "supersede";
  occurredAt: ISODateTime;
  missionElapsedSeconds: number;
  payload: unknown;
  payloadHash: string;
  priority: "routine" | "high" | "critical";
  syncState: SyncState;
  conflictFlag?: {
    flaggedAt: ISODateTime;
    reason: string;
    competingEnvelopeIds: UUID[];
  };
}

export type AuditAction =
  | "read"
  | "create"
  | "override"
  | "supersede"
  | "acknowledge"
  | "rule_load"
  | "sync";

export interface AuditEntry {
  id: UUID;
  eventId: UUID;
  action: AuditAction;
  actorId?: UUID;
  role?: string;
  aggregateType: string;
  aggregateId: UUID;
  occurredAt: ISODateTime;
  missionElapsedSeconds: number;
  ruleVersion?: string;
  configSignature?: string;
  payloadHash: string;
  payload: unknown;
}
