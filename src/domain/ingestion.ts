import type {
  HealthDomain,
  ISODateTime,
  Measurement,
  MeasurementSource,
  UUID,
} from "./types";
import { missionConfig } from "../lib/missionConfig";

export class IngestionValidationError extends Error {
  constructor(
    public readonly code:
      | "MISSING_CREW_MEMBER"
      | "INVALID_TIMESTAMP"
      | "INVALID_UNIT"
      | "INVALID_VALUE"
      | "MISSING_METRIC",
    message: string,
  ) {
    super(message);
    this.name = "IngestionValidationError";
  }
}

export interface RawMeasurementInput {
  crewMemberId: string;
  domain: HealthDomain;
  metricCode: string;
  value: number;
  unit: string;
  observedAt: ISODateTime;
  missionElapsedSeconds: number;
  source: MeasurementSource;
  deviceId?: string;
  rawPayloadRef?: string;
  rawPayloadChecksum?: string;
  correctionOfId?: UUID;
  correctionReason?: string;
}

export function normalizeMeasurement(
  input: RawMeasurementInput,
  eventId: UUID,
  id: UUID = crypto.randomUUID(),
): Measurement {
  if (!input.crewMemberId.trim()) {
    throw new IngestionValidationError(
      "MISSING_CREW_MEMBER",
      "Crew member ID is required.",
    );
  }
  if (!input.metricCode.trim()) {
    throw new IngestionValidationError(
      "MISSING_METRIC",
      "Metric code is required.",
    );
  }
  if (!Number.isFinite(input.value)) {
    throw new IngestionValidationError(
      "INVALID_VALUE",
      "Measurement value must be finite.",
    );
  }

  const timestamp = new Date(input.observedAt);
  if (
    !input.observedAt ||
    Number.isNaN(timestamp.getTime()) ||
    !input.observedAt.endsWith("Z")
  ) {
    throw new IngestionValidationError(
      "INVALID_TIMESTAMP",
      "Timestamp must be a valid UTC ISO 8601 string.",
    );
  }

  const rule = missionConfig.rules.find(
    (candidate) => candidate.metricCode === input.metricCode,
  );
  if (rule && rule.unit.toLowerCase() !== input.unit.toLowerCase()) {
    throw new IngestionValidationError(
      "INVALID_UNIT",
      `Expected unit ${rule.unit} for ${input.metricCode}.`,
    );
  }

  if (
    input.correctionOfId &&
    (!input.correctionReason || input.correctionReason.trim().length < 3)
  ) {
    throw new IngestionValidationError(
      "INVALID_VALUE",
      "A correction requires a reason.",
    );
  }

  const ingestedAt = new Date().toISOString();
  return {
    id,
    eventId,
    crewMemberId: input.crewMemberId,
    domain: input.domain,
    metricCode: input.metricCode,
    value: input.value,
    unit: input.unit.trim(),
    observedAt: timestamp.toISOString(),
    ingestedAt,
    missionElapsedSeconds: input.missionElapsedSeconds,
    source: input.source,
    deviceId: input.deviceId,
    quality: "valid",
    freshness: "current",
    rawPayloadRef: input.rawPayloadRef,
    rawPayloadChecksum: input.rawPayloadChecksum,
    schemaVersion: missionConfig.schemaVersion,
    correctionOfId: input.correctionOfId,
    correctionReason: input.correctionReason,
  };
}
