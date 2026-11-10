"""Unit tests for ModelHealthStore and rank_candidates (M1.3c)."""

from datetime import datetime, timedelta, timezone
from pathlib import Path
import pytest
from app.db.database import create_connection
from app.services.ai.model_health import (
    BASE_COOLDOWNS,
    MAX_COOLDOWN_CAP,
    ModelHealthRecord,
    ModelHealthStore,
)
from app.services.ai.model_pool import DEFAULT_NEUTRAL_TTFT_MS, rank_candidates
from app.services.ai.provider import ModelInfo
from tests.conftest import FIXTURE_MODELS


class MockClock:
    def __init__(self, start_dt: datetime) -> None:
        self.current = start_dt

    def __call__(self) -> datetime:
        return self.current

    def advance(self, seconds: float) -> None:
        self.current += timedelta(seconds=seconds)


def test_health_store_success_ewma() -> None:
    clock = MockClock(datetime(2026, 11, 7, 10, 0, 0, tzinfo=timezone.utc))
    store = ModelHealthStore(time_func=clock)

    # First success establishes initial EWMA
    store.record_success("gemini-2.5-flash", 100.0)
    rec = store.get("gemini-2.5-flash")
    assert rec.successes == 1
    assert rec.consecutive_failures == 0
    assert rec.cooldown_until is None
    assert rec.ttft_ms_ewma == 100.0

    # Second success: (0.7 * 100) + (0.3 * 200) = 70 + 60 = 130.0
    store.record_success("gemini-2.5-flash", 200.0)
    rec = store.get("gemini-2.5-flash")
    assert rec.successes == 2
    assert rec.ttft_ms_ewma == 130.0


def test_health_store_cooldown_by_code_and_doubling() -> None:
    start_dt = datetime(2026, 11, 7, 10, 0, 0, tzinfo=timezone.utc)
    clock = MockClock(start_dt)
    store = ModelHealthStore(time_func=clock)

    # 1. Quota default 60s
    store.record_failure("m1", "quota")
    rec = store.get("m1")
    assert rec.failures == 1
    assert rec.consecutive_failures == 1
    assert rec.last_error_code == "quota"
    expected_exp = (start_dt + timedelta(seconds=60.0)).isoformat()
    assert rec.cooldown_until == expected_exp
    assert rec.is_in_cooldown(start_dt) is True
    assert rec.is_in_cooldown(start_dt + timedelta(seconds=61.0)) is False

    # 2. Quota with custom retry_after (capped at 300s)
    store.record_failure("m1", "quota", retry_after=45.0)
    rec = store.get("m1")
    assert rec.consecutive_failures == 2
    assert rec.cooldown_until == (start_dt + timedelta(seconds=45.0)).isoformat()

    # 3. Third failure triggers doubling: 60 * 2 = 120s
    store.record_failure("m1", "quota")
    rec = store.get("m1")
    assert rec.consecutive_failures == 3
    assert rec.cooldown_until == (start_dt + timedelta(seconds=120.0)).isoformat()

    # 4. Fourth failure: 60 * 4 = 240s
    store.record_failure("m1", "quota")
    assert store.get("m1").consecutive_failures == 4
    assert store.get("m1").cooldown_until == (start_dt + timedelta(seconds=240.0)).isoformat()

    # 5. Fifth failure: capped at 300s
    store.record_failure("m1", "quota")
    assert store.get("m1").consecutive_failures == 5
    assert store.get("m1").cooldown_until == (start_dt + timedelta(seconds=300.0)).isoformat()

    # Success resets consecutive failures and clears cooldown
    store.record_success("m1", 50.0)
    rec = store.get("m1")
    assert rec.consecutive_failures == 0
    assert rec.cooldown_until is None


def test_health_store_not_found_and_cleared_on_refresh() -> None:
    start_dt = datetime(2026, 11, 7, 10, 0, 0, tzinfo=timezone.utc)
    clock = MockClock(start_dt)
    store = ModelHealthStore(time_func=clock)

    store.record_failure("m-404", "not_found")
    rec = store.get("m-404")
    assert rec.cooldown_until == (start_dt + timedelta(seconds=600.0)).isoformat()
    assert rec.is_in_cooldown(start_dt) is True

    # clear_not_found_cooldowns clears it
    store.clear_not_found_cooldowns()
    assert store.get("m-404").cooldown_until is None
    assert store.get("m-404").is_in_cooldown(start_dt) is False


def test_health_store_persistence_roundtrip() -> None:
    conn = create_connection()
    clock = MockClock(datetime(2026, 11, 7, 12, 0, 0, tzinfo=timezone.utc))
    store1 = ModelHealthStore(time_func=clock)

    store1.record_success("model-persist", 150.0, conn=conn)
    store1.record_failure("model-persist", "unavailable", conn=conn)
    store1.persist_all(conn)

    # Load in new store instance
    store2 = ModelHealthStore(time_func=clock)
    store2.load_from_db(conn)
    rec2 = store2.get("model-persist")
    assert rec2.successes == 1
    assert rec2.failures == 1
    assert rec2.last_error_code == "unavailable"
    assert rec2.ttft_ms_ewma == 150.0


def test_rank_candidates_pure_function() -> None:
    now = datetime(2026, 11, 7, 14, 0, 0, tzinfo=timezone.utc)
    m_flash = next(m for m in FIXTURE_MODELS if m.id == "gemini-2.5-flash")
    m_pro = next(m for m in FIXTURE_MODELS if m.id == "gemini-2.5-pro")
    m_embed = next(m for m in FIXTURE_MODELS if m.id == "text-embedding-004")

    health: dict[str, ModelHealthRecord] = {
        "gemini-2.5-flash": ModelHealthRecord(model_id="gemini-2.5-flash", ttft_ms_ewma=300.0),
        "gemini-2.5-pro": ModelHealthRecord(model_id="gemini-2.5-pro", ttft_ms_ewma=150.0),
    }

    # 1. Non-chat kinds filtered out
    ranked = rank_candidates([m_embed, m_flash, m_pro], health, now)
    assert all(m.id != "text-embedding-004" for m in ranked)

    # 2. Lowest known TTFT comes first
    ranked_ttft = rank_candidates([m_flash, m_pro], health, now)
    assert ranked_ttft[0].id == "gemini-2.5-pro"
    assert ranked_ttft[1].id == "gemini-2.5-flash"

    # 3. Unknown model uses neutral TTFT (median or 2000ms)
    m_unknown = ModelInfo(
        id="gemini-unknown-chat",
        display_name="Unknown Chat",
        provider="gemini",
        capabilities=["text"],
        supported_actions=["generateContent"],
    )
    # Median of [300, 150] is 225.0 ms -> unknown comes after 150 but before 300
    ranked_unk = rank_candidates([m_flash, m_pro, m_unknown], health, now)
    ids = [m.id for m in ranked_unk]
    assert ids == ["gemini-2.5-pro", "gemini-unknown-chat", "gemini-2.5-flash"]

    # 4. Tie-breaking: same TTFT -> fewer consecutive failures -> ID ascending
    m_tie_b = ModelInfo(
        id="gemini-tie-b", display_name="Tie B",
        provider="gemini", capabilities=["text"], supported_actions=["generateContent"],
    )
    m_tie_a = ModelInfo(
        id="gemini-tie-a", display_name="Tie A",
        provider="gemini", capabilities=["text"], supported_actions=["generateContent"],
    )
    tie_health = {
        "gemini-tie-b": ModelHealthRecord(model_id="gemini-tie-b", ttft_ms_ewma=100.0, consecutive_failures=1),
        "gemini-tie-a": ModelHealthRecord(model_id="gemini-tie-a", ttft_ms_ewma=100.0, consecutive_failures=0),
    }
    ranked_failures = rank_candidates([m_tie_b, m_tie_a], tie_health, now)
    assert [m.id for m in ranked_failures] == ["gemini-tie-a", "gemini-tie-b"]

    # Equal failures: tie-break on ID ascending
    tie_health_equal = {
        "gemini-tie-b": ModelHealthRecord(model_id="gemini-tie-b", ttft_ms_ewma=100.0, consecutive_failures=0),
        "gemini-tie-a": ModelHealthRecord(model_id="gemini-tie-a", ttft_ms_ewma=100.0, consecutive_failures=0),
    }
    ranked_id = rank_candidates([m_tie_b, m_tie_a], tie_health_equal, now)
    assert [m.id for m in ranked_id] == ["gemini-tie-a", "gemini-tie-b"]

    # 5. Model in cooldown dropped unless all cooling
    cooling_health = dict(health)
    cooling_health["gemini-2.5-pro"] = ModelHealthRecord(
        model_id="gemini-2.5-pro",
        cooldown_until=(now + timedelta(seconds=60.0)).isoformat(),
    )
    ranked_cooldown = rank_candidates([m_flash, m_pro], cooling_health, now)
    assert [m.id for m in ranked_cooldown] == ["gemini-2.5-flash"]

    # 6. When ALL models are cooling, return ordered by earliest expiry
    cooling_health["gemini-2.5-flash"] = ModelHealthRecord(
        model_id="gemini-2.5-flash",
        cooldown_until=(now + timedelta(seconds=120.0)).isoformat(),
    )
    ranked_all_cooling = rank_candidates([m_flash, m_pro], cooling_health, now)
    assert [m.id for m in ranked_all_cooling] == ["gemini-2.5-pro", "gemini-2.5-flash"]
