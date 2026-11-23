import { describe, expect, it } from "vitest";
import {
  IngestionValidationError,
  normalizeMeasurement,
} from "./ingestion";

describe("measurement ingestion", () => {
  it("normalizes valid UTC timestamps and preserves raw provenance", () => {
    const measurement = normalizeMeasurement(
      {
        crewMemberId: "crew-1",
        domain: "cardiovascular",
        metricCode: "resting_heart_rate",
        value: 78,
        unit: "bpm",
        observedAt: "2026-11-22T20:00:00Z",
        missionElapsedSeconds: 12345,
        source: "sensor",
        deviceId: "wearable-1",
        rawPayloadRef: "payload://abc",
        rawPayloadChecksum: "sha256:abc",
      },
      "event-1",
      "measurement-1",
    );

    expect(measurement.observedAt).toBe("2026-11-22T20:00:00.000Z");
    expect(measurement.rawPayloadRef).toBe("payload://abc");
  });

  it("rejects malformed timestamps", () => {
    expect(() =>
      normalizeMeasurement(
        {
          crewMemberId: "crew-1",
          domain: "cardiovascular",
          metricCode: "resting_heart_rate",
          value: 78,
          unit: "bpm",
          observedAt: "not-a-timestamp",
          missionElapsedSeconds: 12345,
          source: "manual",
        },
        "event-2",
      ),
    ).toThrow(IngestionValidationError);
  });
});
