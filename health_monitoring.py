"""Local-first health monitoring domain services and SQLite persistence."""

from __future__ import annotations

import json
import sqlite3
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class MetricDefinition:
    code: str
    label: str
    domain: str
    unit: str
    normal_low: float
    normal_high: float
    concern_low: float | None
    concern_high: float | None
    guidance: str
    source: str


METRICS: dict[str, MetricDefinition] = {
    "resting_heart_rate": MetricDefinition(
        "resting_heart_rate", "Resting heart rate", "Cardiovascular", "bpm", 50, 90, 45, 110,
        "Pause exertion, repeat after five minutes seated, and contact medical support if persistent.", "Wearable / manual",
    ),
    "systolic_pressure": MetricDefinition(
        "systolic_pressure", "Systolic pressure", "Cardiovascular", "mmHg", 90, 140, 85, 160,
        "Sit quietly and repeat with the cuff at heart level. Escalate persistent or symptomatic readings.", "Cuff",
    ),
    "oxygen_saturation": MetricDefinition(
        "oxygen_saturation", "Oxygen saturation", "Cardiovascular", "%", 94, 100, 90, None,
        "Check sensor contact and repeat. Follow the mission respiratory response procedure if low readings persist.", "Pulse oximeter",
    ),
    "bone_loading_sessions": MetricDefinition(
        "bone_loading_sessions", "Bone-loading sessions", "Bone", "sessions / 7d", 4, 7, 2, 10,
        "Complete the next approved resistive-exercise session when cleared and record any equipment issue.", "Exercise log",
    ),
    "immune_symptom_score": MetricDefinition(
        "immune_symptom_score", "Immune symptom score", "Immune", "0-10", 0, 2, None, 5,
        "Record temperature and symptoms, use the approved hygiene protocol, and contact medical support for worsening signs.", "Crew check-in",
    ),
    "sleep_duration": MetricDefinition(
        "sleep_duration", "Sleep duration", "Behavioral health", "hours", 7, 10, 5, 12,
        "Protect the next sleep opportunity, reduce nonessential workload, and flag repeated short sleep to the team.", "Sleep log",
    ),
    "mood_score": MetricDefinition(
        "mood_score", "Mood / coping", "Behavioral health", "1-10", 6, 10, 3, None,
        "Use a brief recovery activity and request a private check-in if the score remains low or safety concerns appear.", "Crew check-in",
    ),
    "perceived_stress": MetricDefinition(
        "perceived_stress", "Perceived stress", "Behavioral health", "1-10", 1, 6, None, 8,
        "Take the scheduled decompression break, use the mission coping protocol, and notify the support channel if persistent.", "Crew check-in",
    ),
}

STATUS_ORDER = {"normal": 0, "watch": 1, "urgent": 2, "critical": 3, "insufficient_data": 0}


def utc_now() -> datetime:
    return datetime.now(timezone.utc).replace(microsecond=0)


def _timestamp(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat()


def connect(db_path: str | Path) -> sqlite3.Connection:
    connection = sqlite3.connect(str(db_path), check_same_thread=False)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA journal_mode=WAL")
    connection.execute("PRAGMA foreign_keys=ON")
    return connection


def initialize_db(db_path: str | Path) -> None:
    Path(db_path).parent.mkdir(parents=True, exist_ok=True)
    with connect(db_path) as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS measurements (
                id TEXT PRIMARY KEY,
                crew_member_id TEXT NOT NULL,
                metric_code TEXT NOT NULL,
                value REAL NOT NULL,
                unit TEXT NOT NULL,
                observed_at TEXT NOT NULL,
                source TEXT NOT NULL,
                quality TEXT NOT NULL,
                notes TEXT,
                event_id TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS assessments (
                id TEXT PRIMARY KEY,
                crew_member_id TEXT NOT NULL,
                metric_code TEXT NOT NULL,
                status TEXT NOT NULL,
                value REAL NOT NULL,
                rationale TEXT NOT NULL,
                guidance TEXT NOT NULL,
                rule_version TEXT NOT NULL,
                created_at TEXT NOT NULL,
                acknowledged_at TEXT
            );
            CREATE TABLE IF NOT EXISTS sync_queue (
                event_id TEXT PRIMARY KEY,
                aggregate_type TEXT NOT NULL,
                aggregate_id TEXT NOT NULL,
                payload TEXT NOT NULL,
                state TEXT NOT NULL DEFAULT 'pending',
                created_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_measurements_metric_time
                ON measurements(metric_code, observed_at);
            CREATE INDEX IF NOT EXISTS idx_assessments_created
                ON assessments(created_at);
            """
        )


def _queue_event(connection: sqlite3.Connection, aggregate_type: str, aggregate_id: str, payload: dict[str, Any]) -> None:
    event_id = str(uuid.uuid4())
    connection.execute(
        "INSERT INTO sync_queue(event_id, aggregate_type, aggregate_id, payload, created_at) VALUES (?, ?, ?, ?, ?)",
        (event_id, aggregate_type, aggregate_id, json.dumps(payload), _timestamp(utc_now())),
    )


def record_measurement(
    db_path: str | Path,
    metric_code: str,
    value: float,
    source: str = "manual",
    notes: str = "",
    crew_member_id: str = "crew-01",
    observed_at: datetime | None = None,
) -> str:
    metric = METRICS[metric_code]
    measurement_id = str(uuid.uuid4())
    event_id = str(uuid.uuid4())
    observed_at = observed_at or utc_now()
    with connect(db_path) as connection:
        connection.execute(
            """INSERT INTO measurements
            (id, crew_member_id, metric_code, value, unit, observed_at, source, quality, notes, event_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (measurement_id, crew_member_id, metric_code, value, metric.unit, _timestamp(observed_at), source, "valid", notes, event_id, _timestamp(utc_now())),
        )
        _queue_event(connection, "measurement", measurement_id, {
            "id": measurement_id, "crew_member_id": crew_member_id, "metric_code": metric_code,
            "value": value, "unit": metric.unit, "observed_at": _timestamp(observed_at), "source": source,
        })
    return measurement_id


def seed_demo_data(db_path: str | Path) -> None:
    with connect(db_path) as connection:
        has_data = connection.execute("SELECT 1 FROM measurements LIMIT 1").fetchone()
    if has_data:
        return
    now = utc_now()
    demo_values = {
        "resting_heart_rate": [68, 71, 69, 72, 74, 76, 78],
        "systolic_pressure": [118, 121, 117, 123, 126, 129, 132],
        "oxygen_saturation": [98, 98, 97, 98, 97, 96, 96],
        "bone_loading_sessions": [5, 5, 4, 5, 4, 3, 3],
        "immune_symptom_score": [0, 0, 1, 1, 1, 2, 2],
        "sleep_duration": [7.8, 7.5, 7.2, 6.8, 6.5, 6.2, 5.8],
        "mood_score": [8, 8, 7, 7, 6, 5, 5],
        "perceived_stress": [3, 3, 4, 5, 5, 6, 7],
    }
    for metric_code, values in demo_values.items():
        for day_offset, value in enumerate(values):
            record_measurement(db_path, metric_code, value, source="demo", observed_at=now - timedelta(days=6 - day_offset))


def latest_measurements(db_path: str | Path, crew_member_id: str = "crew-01") -> dict[str, dict[str, Any]]:
    with connect(db_path) as connection:
        rows = connection.execute(
            """SELECT m.* FROM measurements m
            JOIN (SELECT metric_code, MAX(observed_at) AS latest FROM measurements WHERE crew_member_id = ? GROUP BY metric_code) latest
            ON m.metric_code = latest.metric_code AND m.observed_at = latest.latest
            WHERE m.crew_member_id = ?""", (crew_member_id, crew_member_id),
        ).fetchall()
    return {row["metric_code"]: dict(row) for row in rows}


def measurement_history(db_path: str | Path, metric_code: str, days: int = 30, crew_member_id: str = "crew-01") -> list[dict[str, Any]]:
    cutoff = _timestamp(utc_now() - timedelta(days=days))
    with connect(db_path) as connection:
        rows = connection.execute(
            "SELECT * FROM measurements WHERE metric_code = ? AND crew_member_id = ? AND observed_at >= ? ORDER BY observed_at",
            (metric_code, crew_member_id, cutoff),
        ).fetchall()
    return [dict(row) for row in rows]


def evaluate_assessments(db_path: str, crew_member_id: str = "crew-01") -> list[dict[str, Any]]:
    latest = latest_measurements(db_path, crew_member_id)
    generated: list[dict[str, Any]] = []
    with connect(db_path) as connection:
        for metric_code, metric in METRICS.items():
            measurement = latest.get(metric_code)
            if not measurement:
                continue
            value = float(measurement["value"])
            if metric.concern_low is not None and value < metric.concern_low or metric.concern_high is not None and value > metric.concern_high:
                status = "urgent"
            elif value < metric.normal_low or value > metric.normal_high:
                status = "watch"
            else:
                status = "normal"
            if status == "normal":
                continue
            if status == "urgent":
                rationale = f"{metric.label} is {value:g} {metric.unit}, outside the configured concern boundary."
            else:
                rationale = f"{metric.label} is {value:g} {metric.unit}, outside the configured baseline range."
            existing = connection.execute(
                "SELECT id, status, acknowledged_at FROM assessments WHERE metric_code = ? ORDER BY created_at DESC LIMIT 1", (metric_code,)
            ).fetchone()
            if existing and existing["status"] == status:
                if existing["acknowledged_at"] is None:
                    generated.append(dict(connection.execute("SELECT * FROM assessments WHERE id = ?", (existing["id"],)).fetchone()))
                continue
            assessment_id = str(uuid.uuid4())
            connection.execute(
                """INSERT INTO assessments
                (id, crew_member_id, metric_code, status, value, rationale, guidance, rule_version, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (assessment_id, crew_member_id, metric_code, status, value, rationale, metric.guidance, "baseline-v1", _timestamp(utc_now())),
            )
            _queue_event(connection, "assessment", assessment_id, {"id": assessment_id, "metric_code": metric_code, "status": status, "value": value})
            generated.append(dict(connection.execute("SELECT * FROM assessments WHERE id = ?", (assessment_id,)).fetchone()))
    return generated


def active_assessments(db_path: str | Path, crew_member_id: str = "crew-01") -> list[dict[str, Any]]:
    evaluate_assessments(db_path, crew_member_id)
    with connect(db_path) as connection:
        rows = connection.execute(
            "SELECT * FROM assessments WHERE crew_member_id = ? AND acknowledged_at IS NULL ORDER BY created_at DESC",
            (crew_member_id,),
        ).fetchall()
    return [dict(row) for row in rows]


def acknowledge_assessment(db_path: str | Path, assessment_id: str) -> None:
    acknowledged_at = _timestamp(utc_now())
    with connect(db_path) as connection:
        connection.execute("UPDATE assessments SET acknowledged_at = ? WHERE id = ?", (acknowledged_at, assessment_id))
        _queue_event(connection, "assessment", assessment_id, {"id": assessment_id, "acknowledged_at": acknowledged_at})


def pending_sync_count(db_path: str | Path) -> int:
    with connect(db_path) as connection:
        return int(connection.execute("SELECT COUNT(*) FROM sync_queue WHERE state = 'pending'").fetchone()[0])


def mark_sync_complete(db_path: str | Path) -> None:
    with connect(db_path) as connection:
        connection.execute("UPDATE sync_queue SET state = 'confirmed' WHERE state = 'pending'")


def domain_status(db_path: str, domain: str) -> str:
    statuses = [assessment["status"] for assessment in active_assessments(db_path) if METRICS[assessment["metric_code"]].domain == domain]
    return max(statuses, key=lambda status: STATUS_ORDER[status], default="normal")
