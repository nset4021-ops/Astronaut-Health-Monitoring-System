import { describe, expect, it } from "vitest";
import { createSyncEnvelope, makeIdempotencyKey } from "./syncOutbox";

describe("sync outbox envelope", () => {
  it("creates stable idempotency and hashes the payload", async () => {
    const envelope = await createSyncEnvelope({
      eventId: "event-1",
      deviceId: "tablet-1",
      deviceSequence: 42,
      aggregateType: "measurement",
      aggregateId: "measurement-1",
      operation: "create",
      occurredAt: "2026-11-22T20:00:00.000Z",
      missionElapsedSeconds: 12345,
      payload: { metricCode: "resting_heart_rate", value: 78 },
      priority: "high",
    });

    expect(envelope.payloadHash).toMatch(/^[a-f0-9]{64}$/);
    expect(envelope.idempotencyKey).toBe(
      makeIdempotencyKey("tablet-1", 42, "create", "measurement-1"),
    );
    expect(envelope.syncState).toBe("pending");
  });
});
