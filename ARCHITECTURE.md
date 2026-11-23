# Offline-first modular monolith layout

The browser prototype and the Python/Streamlit prototype are migration entry points. New domain code is being added under `src/domain`, `src/lib`, and `src/config`; the UI will consume these modules rather than defining clinical thresholds or countermeasures.

```text
src/
  domain/
    types.ts                 # TypeScript contracts
    ingestion.ts             # Unit, timestamp, and input validation
    ingestion.test.ts
  config/
    mission-rules.v1.json    # Signed mission config, rules, countermeasures
  lib/
    missionConfig.ts         # Versioned config loader
    indexedDbStore.ts        # Append-only IndexedDB foundations
    syncOutbox.ts            # UUID, idempotency, payload hash, priority
    auditLog.ts              # Immutable audit entry construction
  components/                # Accessible UI modules
  hooks/                     # React integration
  data/                      # Synthetic presentation telemetry
```

## Module boundaries

- **Ingestion and validation:** normalize UTC timestamps and units, preserve raw payload references, and reject malformed records.
- **Health record store:** IndexedDB object stores use immutable measurement and audit records. A correction is a new record linked by `correctionOfId`; the original record is not edited.
- **Rule and assessment engine:** evaluate versioned mission configuration for individual findings. Missing, stale, questionable, and insufficient-data states remain explicit.
- **Action guidance:** map a finding to versioned countermeasures. UI acknowledgement is explicit and produces an audit/outbox event.
- **Delay-tolerant sync:** envelopes contain event IDs, device sequences, idempotency keys, payload hashes, and priority. State transitions are append-only records rather than mutation of the original envelope.
- **Audit log:** append reads, overrides, rule loads, acknowledgements, supersessions, and sync events.

## Storage migration status

The current application still has localStorage/demo adapters. `indexedDbStore.ts` is the next operational-store foundation; production deployment requires a mission key-provider for Web Crypto AES-GCM encryption and a flight-surgery-reviewed configuration signature check.
