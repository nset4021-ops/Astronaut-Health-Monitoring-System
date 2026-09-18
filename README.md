# Astronaut-Health-Monitoring-System

## Step 1: Proposed Software Architecture

### 1) System Architecture (Offline-First)

#### Frontend (Crew UI)
- **Platform:** Cross-platform desktop/tablet app (Electron or Flutter) with a simplified, high-contrast interface.
- **Pattern:** Local-first state management with cached mission data and health timelines.
- **Functions:** Data entry, trend review, guided checklists, and alert acknowledgments.

#### Backend (Onboard Clinical Decision Service)
- **Runtime:** Containerized service (Python FastAPI or Node.js) running on the spacecraft local network.
- **Responsibilities:**
  - Validate incoming observations.
  - Evaluate rule-based thresholds and trend-based risk triggers.
  - Generate alert recommendations and countermeasure tasks.
  - Expose secure REST/GraphQL endpoints for the UI.

#### Data Storage
- **Primary onboard DB:** SQLite (or PostgreSQL if mission hardware permits) for durable local storage.
- **Time-series partitioning:** Observations stored with metric ID + timestamp for efficient trend analysis.
- **Audit/event log:** Immutable alert/action history for medical traceability.

#### Ground Sync and Delayed Connectivity
- **Sync model:** Store-and-forward replication queue.
- **Conflict strategy:** Last-writer-wins for non-clinical preferences, versioned merges for medical records.
- **Transmission profile:** Priority-based batching (critical alerts first, routine summaries later).
- **Resilience:** Full functionality preserved while disconnected; sync retries are exponential/backoff based.

### 2) Logical Component View

1. **UI Module** → captures self-checks and shows mission health state.  
2. **Observation API** → receives and validates measurements.  
3. **Risk Engine** → compares readings to personalized baselines + mission rules.  
4. **Alert Service** → issues severity-tagged alerts and suggested actions.  
5. **Countermeasure Planner** → tracks completion of exercise, nutrition, mental health, and med protocols.  
6. **Sync Service** → handles delayed downlink/uplink with mission control systems.

## Core Data Structures (Initial)

```json
{
  "astronaut_profile": {
    "astronaut_id": "ASTRO-001",
    "mission_id": "MISSION-MARS-01",
    "baseline_version": 3,
    "created_at": "2026-09-18T00:00:00Z"
  },
  "metric_definition": {
    "metric_id": "resting_heart_rate",
    "domain": "cardiovascular",
    "unit": "bpm",
    "collection_mode": "wearable|manual|lab",
    "sampling_frequency": "hourly"
  },
  "baseline_range": {
    "baseline_id": "BL-REST-HR-ASTRO-001",
    "astronaut_id": "ASTRO-001",
    "metric_id": "resting_heart_rate",
    "min_value": 50,
    "max_value": 90,
    "effective_from": "2026-09-18T00:00:00Z",
    "effective_to": null
  },
  "observation": {
    "observation_id": "OBS-123",
    "astronaut_id": "ASTRO-001",
    "metric_id": "resting_heart_rate",
    "value": 102,
    "recorded_at": "2026-09-18T10:04:00Z",
    "source_device_id": "WEARABLE-7",
    "quality_flag": "valid|suspect|missing"
  },
  "health_alert": {
    "alert_id": "ALT-991",
    "astronaut_id": "ASTRO-001",
    "metric_id": "resting_heart_rate",
    "severity": "info|watch|warning|critical",
    "trigger_type": "threshold|trend|composite",
    "trigger_value": 102,
    "baseline_snapshot": {
      "min": 50,
      "max": 90
    },
    "recommended_actions": [
      "Begin guided breathing protocol",
      "Recheck in 15 minutes",
      "Notify flight surgeon on next sync window"
    ],
    "status": "new|acknowledged|resolved",
    "created_at": "2026-09-18T10:05:00Z"
  },
  "sync_event": {
    "event_id": "SYNC-77",
    "entity_type": "observation|health_alert|countermeasure_task",
    "entity_id": "OBS-123",
    "operation": "create|update",
    "priority": "routine|high|critical",
    "sync_status": "queued|sent|acknowledged|failed",
    "retry_count": 1,
    "last_attempt_at": "2026-09-18T10:10:00Z"
  }
}
```

## Notes for Next Implementation Step
- Step 2 should define concrete baseline ranges per immune, bone, cardiovascular, and behavioral metrics.
- Step 3 should map these models to a stress-tolerant dashboard layout.
- Step 4 should implement the alert-evaluation engine using `baseline_range`, `observation`, and `health_alert`.
