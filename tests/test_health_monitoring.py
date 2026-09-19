from datetime import datetime, timezone

from health_monitoring import (
    active_assessments,
    acknowledge_assessment,
    initialize_db,
    latest_measurements,
    pending_sync_count,
    record_measurement,
    seed_demo_data,
)


def test_demo_data_seeds_and_evaluates(tmp_path):
    db_path = tmp_path / "health.db"
    initialize_db(db_path)
    seed_demo_data(db_path)

    assert len(latest_measurements(db_path)) == 8
    assessments = active_assessments(db_path)
    assert assessments
    assert any(item["metric_code"] == "sleep_duration" for item in assessments)
    assert pending_sync_count(db_path) > 56


def test_acknowledgement_is_local_and_queued(tmp_path):
    db_path = tmp_path / "health.db"
    initialize_db(db_path)
    record_measurement(db_path, "mood_score", 2, observed_at=datetime.now(timezone.utc))

    assessment = active_assessments(db_path)[0]
    before = pending_sync_count(db_path)
    acknowledge_assessment(db_path, assessment["id"])

    assert active_assessments(db_path) == []
    assert pending_sync_count(db_path) == before + 1
