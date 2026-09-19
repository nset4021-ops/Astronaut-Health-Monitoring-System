# Astronaut Health Monitoring System

An offline-first health monitoring application for crew members on long-duration missions. This document defines the first architectural and data-model baseline. It is a decision-support system, not a replacement for flight surgeon oversight or an autonomous diagnostic device.

## Architecture proposal

Use a local-first, modular architecture so the core workflow remains available during communication delays.

```text
Sensors / manual entry / crew devices
								|
				Ingestion and validation
								|
	Local mission app (UI + rules + encrypted store)
			 |                 |
	Crew feedback     Local audit/event log
			 |
	 Sync queue <----> Delay-tolerant mission gateway <----> Ground services
																			|
												 Flight surgeon / research APIs
```

### Frontend

- A tablet-compatible web UI or cross-platform app with a local service worker/cache.
- A small number of high-signal screens: current status, trends, measurements, actions, and handoff.
- Large touch targets, glanceable severity states, explicit confirmation for high-impact actions, and full keyboard/accessibility support.
- The UI reads from the local API and never depends on a live ground connection to show the last known state or record a measurement.

### Backend and domain services

Start with a modular monolith deployed on the vehicle or habitat. Keep these boundaries separate even if they initially run in one process:

1. **Ingestion**: normalizes sensor payloads and manual observations, validates units and timestamps, and rejects malformed data without losing the raw record.
2. **Health record**: stores observations, computed summaries, baseline versions, interventions, acknowledgements, and provenance.
3. **Assessment**: evaluates configurable rules and produces explainable findings. It should never silently overwrite a clinician-authored assessment.
4. **Action guidance**: maps a finding to approved, mission-configured countermeasures and escalation instructions. Guidance is versioned and requires acknowledgement.
5. **Sync**: maintains an append-only outbox, idempotency keys, retry state, conflict records, and a high-priority queue for safety events.
6. **Audit**: records access, rule versions, acknowledgements, overrides, synchronization, and configuration changes.

Keep clinical thresholds and countermeasures out of UI code. Load them as signed, versioned mission configuration so medical authorities can review and update them without changing the app binary.

### Storage

- **Local operational store**: encrypted SQLite (or an equivalent embedded relational database) for observations, assessments, actions, sync state, and audit events.
- **Raw payload store**: encrypted, content-addressed files for sensor payloads that are too large for the relational store; retain a checksum and schema version in the database.
- **Ground store**: relational storage for normalized records and immutable audit events, with object storage for raw payloads and exports.
- **Data minimization**: use crew and mission pseudonymous identifiers, encrypt at rest and in transit, enforce least-privilege roles, and define retention/export rules before collecting research data.
- **Time**: store UTC plus the vehicle mission elapsed time and source clock metadata. Never infer event order from a device clock alone.

### Offline and delayed-connectivity behavior

- All reads, manual entry, rule evaluation, alert display, and acknowledgement work offline.
- Every write receives a globally unique event ID, device ID, monotonic sequence, source timestamp, and ingest timestamp.
- Synchronization is an idempotent, resumable exchange of immutable events. A retry must not duplicate an observation or alert.
- Resolve ordinary metadata conflicts with deterministic last-writer rules only where safe. Never auto-resolve conflicting clinical observations; surface both records and create a review item.
- Prioritize emergency findings, acknowledgements, and configuration changes over bulk telemetry. Compress and batch lower-priority data.
- Show data freshness and sync state prominently. A stale value must not look like a current measurement.
- If a signed configuration expires, keep recording data but disable affected automated guidance and route the issue to the designated medical operator.

## Core data structures

The following TypeScript-like contracts are language-neutral and intentionally omit transport details. Use explicit units and controlled codes rather than free-form strings in production.

```ts
type UUID = string;
type ISODateTime = string;

type HealthDomain =
	| "immune"
	| "bone"
	| "cardiovascular"
	| "behavioral_health";

type Measurement = {
	id: UUID;
	crewMemberId: UUID;
	domain: HealthDomain;
	metricCode: string;             // e.g. heart_rate_resting
	value: number;
	unit: string;                   // e.g. bpm, mmHg, kg, score
	observedAt: ISODateTime;
	missionElapsedSeconds: number;
	source: "sensor" | "manual" | "imported" | "derived";
	deviceId?: string;
	quality: "valid" | "questionable" | "invalid";
	rawPayloadRef?: string;
	schemaVersion: number;
	eventId: UUID;
};

type BaselineProfile = {
	id: UUID;
	crewMemberId: UUID;
	metricCode: string;
	baselineWindow: { start: ISODateTime; end: ISODateTime };
	center: number;
	variability: number;
	unit: string;
	method: "mission_configured" | "crew_baseline" | "clinician_entered";
	thresholdSetId: UUID;
	approvedBy?: string;
	effectiveFrom: ISODateTime;
	version: number;
};

type Assessment = {
	id: UUID;
	crewMemberId: UUID;
	domain: HealthDomain;
	status: "normal" | "watch" | "urgent" | "critical" | "insufficient_data";
	triggerMeasurementIds: UUID[];
	ruleId: string;
	ruleVersion: string;
	rationale: string;
	createdAt: ISODateTime;
	expiresAt?: ISODateTime;
	acknowledgedAt?: ISODateTime;
	acknowledgedBy?: UUID;
};

type Countermeasure = {
	id: UUID;
	assessmentId: UUID;
	actionCode: string;
	title: string;
	instructions: string;
	priority: "routine" | "soon" | "immediate";
	requiresConfirmation: boolean;
	escalationPath: string;
	configVersion: string;
	status: "offered" | "accepted" | "declined" | "completed" | "escalated";
	recordedAt?: ISODateTime;
};

type SyncEnvelope = {
	eventId: UUID;
	aggregateType: "measurement" | "assessment" | "countermeasure" | "audit";
	aggregateId: UUID;
	operation: "create" | "acknowledge" | "update";
	occurredAt: ISODateTime;
	missionElapsedSeconds: number;
	deviceSequence: number;
	payload: unknown;
	payloadHash: string;
	syncState: "pending" | "sent" | "confirmed" | "conflict" | "dead_letter";
};
```

### Data-model rules

- Observations are immutable. Corrections append a new observation with a reason and link to the superseded record.
- Derived assessments always retain the exact input IDs, rule version, threshold-set version, and configuration signature used to produce them.
- A missing, stale, or low-quality value is a first-class state; it must not be converted to zero or silently omitted.
- Store psychological check-ins as sensitive health observations with the same provenance and access controls as physiological data.
- Thresholds must be represented as typed, unit-aware rules. Do not encode clinical ranges in variable names, UI labels, or ad hoc conditionals.

## Recommended implementation sequence

1. Define a reviewed metric catalog, units, source quality rules, and mission-specific configuration format.
2. Implement the local database, append-only event model, and offline sync queue.
3. Add ingestion validation and a read-only status/trend screen using synthetic data.
4. Add assessment and countermeasure workflows only after medical review of the rule and guidance contracts.
5. Add the ground synchronization service, audit review, and end-to-end delay/conflict tests.

Clinical limits should be supplied and approved by the responsible flight-surgery team. The application should display approved thresholds and trends, but should not invent universal "safe" ranges: acceptable values vary by crew member, mission phase, equipment, medication, and measurement protocol.