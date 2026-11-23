import type { SyncEnvelope, UUID } from "../domain/types";

export type PayloadHash = (payload: unknown) => Promise<string>;

async function sha256(payload: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export interface OutboxEnvelopeInput
  extends Omit<
    SyncEnvelope,
    "payloadHash" | "syncState" | "idempotencyKey"
  > {
  idempotencyKey?: string;
  syncState?: SyncEnvelope["syncState"];
  payloadHash?: string;
  hashPayload?: PayloadHash;
}

export async function createSyncEnvelope(
  input: OutboxEnvelopeInput,
): Promise<SyncEnvelope> {
  const hashPayload = input.hashPayload ?? sha256;
  return {
    ...input,
    idempotencyKey:
      input.idempotencyKey ??
      makeIdempotencyKey(
        input.deviceId,
        input.deviceSequence,
        input.operation,
        input.aggregateId,
      ),
    payloadHash: input.payloadHash ?? (await hashPayload(input.payload)),
    syncState: input.syncState ?? "pending",
  };
}

export function makeIdempotencyKey(
  deviceId: string,
  deviceSequence: number,
  operation: string,
  aggregateId: UUID,
): string {
  return `${deviceId}:${deviceSequence}:${operation}:${aggregateId}`;
}
