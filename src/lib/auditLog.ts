import type {
  AuditAction,
  AuditEntry,
  ISODateTime,
  UUID,
} from "../domain/types";

export interface AuditInput {
  action: AuditAction;
  actorId?: UUID;
  role?: string;
  aggregateType: string;
  aggregateId: UUID;
  missionElapsedSeconds: number;
  ruleVersion?: string;
  configSignature?: string;
  payload: unknown;
  occurredAt?: ISODateTime;
  payloadHash?: string;
}

export function createAuditEntry(input: AuditInput): AuditEntry {
  const payloadHash =
    input.payloadHash ??
    JSON.stringify(input.payload)
      .split("")
      .reduce((hash, character) => {
        return (hash * 31 + character.charCodeAt(0)) >>> 0;
      }, 0)
      .toString(16);

  return {
    id: crypto.randomUUID(),
    eventId: crypto.randomUUID(),
    action: input.action,
    actorId: input.actorId,
    role: input.role,
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    occurredAt: input.occurredAt ?? new Date().toISOString(),
    missionElapsedSeconds: input.missionElapsedSeconds,
    ruleVersion: input.ruleVersion,
    configSignature: input.configSignature,
    payloadHash,
    payload: input.payload,
  };
}
