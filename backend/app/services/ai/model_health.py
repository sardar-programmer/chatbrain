"""Model health tracking and cooldown management (M1.3c)."""

from collections.abc import Callable
from dataclasses import asdict, dataclass
from datetime import datetime, timedelta, timezone
import sqlite3
import time
from typing import Any
from app.db.database import create_connection

EWMA_ALPHA = 0.3
BASE_COOLDOWNS: dict[str, float] = {
    "quota": 60.0,
    "unavailable": 20.0,
    "timeout": 30.0,
    "network": 15.0,
    "not_found": 600.0,
}
MAX_COOLDOWN_CAP = 300.0
THROTTLE_INTERVAL = 2.0


@dataclass
class ModelHealthRecord:
    """Health metrics and cooldown state for a single model."""

    model_id: str
    successes: int = 0
    failures: int = 0
    ttft_ms_ewma: float | None = None
    last_success_at: str | None = None
    last_failure_at: str | None = None
    last_error_code: str | None = None
    consecutive_failures: int = 0
    cooldown_until: str | None = None

    def is_in_cooldown(self, now: datetime | None = None) -> bool:
        """Check if model is currently in active cooldown."""
        if not self.cooldown_until:
            return False
        current = now or datetime.now(timezone.utc)
        try:
            expiry = datetime.fromisoformat(self.cooldown_until)
            if expiry.tzinfo is None:
                expiry = expiry.replace(tzinfo=timezone.utc)
            return expiry > current
        except (ValueError, TypeError):
            return False

    def to_dict(self) -> dict[str, Any]:
        """Convert record to dictionary."""
        return asdict(self)


class ModelHealthStore:
    """In-memory cache of model health with throttled SQLite persistence."""

    def __init__(
        self,
        time_func: Callable[[], datetime] | None = None,
        persist_interval: float = THROTTLE_INTERVAL,
    ) -> None:
        self._records: dict[str, ModelHealthRecord] = {}
        self._dirty_keys: set[str] = set()
        self._time_func: Callable[[], datetime] = time_func or (lambda: datetime.now(timezone.utc))
        self._persist_interval = persist_interval
        self._last_persist_mono: float = 0.0

    def _now(self) -> datetime:
        return self._time_func()

    def get(self, model_id: str) -> ModelHealthRecord:
        """Retrieve model health record or default empty record."""
        if model_id not in self._records:
            self._records[model_id] = ModelHealthRecord(model_id=model_id)
        return self._records[model_id]

    def all(self) -> dict[str, ModelHealthRecord]:
        """Retrieve all tracked model health records."""
        return dict(self._records)

    def record_success(
        self,
        model_id: str,
        ttft_ms: float,
        conn: sqlite3.Connection | None = None,
    ) -> None:
        """Record model success, update EWMA TTFT, reset consecutive failures and cooldown."""
        rec = self.get(model_id)
        rec.successes += 1
        rec.consecutive_failures = 0
        rec.cooldown_until = None
        now_dt = self._now()
        rec.last_success_at = now_dt.isoformat()

        if rec.ttft_ms_ewma is None:
            rec.ttft_ms_ewma = round(float(ttft_ms), 2)
        else:
            new_ewma = (1.0 - EWMA_ALPHA) * rec.ttft_ms_ewma + EWMA_ALPHA * float(ttft_ms)
            rec.ttft_ms_ewma = round(new_ewma, 2)

        self._dirty_keys.add(model_id)
        self._maybe_persist_throttled(conn)

    def record_failure(
        self,
        model_id: str,
        code: str,
        retry_after: float | None = None,
        conn: sqlite3.Connection | None = None,
    ) -> None:
        """Record failure, increment consecutive failures, and calculate cooldown."""
        rec = self.get(model_id)
        rec.failures += 1
        rec.consecutive_failures += 1
        rec.last_error_code = code
        now_dt = self._now()
        rec.last_failure_at = now_dt.isoformat()

        base_cooldown = BASE_COOLDOWNS.get(code, 15.0)
        if code == "quota" and retry_after is not None:
            base_cooldown = min(max(float(retry_after), 1.0), MAX_COOLDOWN_CAP)

        if base_cooldown >= MAX_COOLDOWN_CAP:
            cooldown_sec = base_cooldown
        elif rec.consecutive_failures >= 3:
            multiplier = 2 ** (rec.consecutive_failures - 2)
            cooldown_sec = min(base_cooldown * multiplier, MAX_COOLDOWN_CAP)
        else:
            cooldown_sec = base_cooldown

        cooldown_expiry = now_dt + timedelta(seconds=cooldown_sec)
        rec.cooldown_until = cooldown_expiry.isoformat()

        self._dirty_keys.add(model_id)
        self._maybe_persist_throttled(conn)

    def record_cancelled(self, model_id: str) -> None:
        """Record cancelled request (no penalty, no credit)."""
        self.get(model_id)

    def clear_not_found_cooldowns(self, conn: sqlite3.Connection | None = None) -> None:
        """Clear active cooldown for models with not_found code."""
        for rec in self._records.values():
            if rec.last_error_code == "not_found":
                rec.cooldown_until = None
                self._dirty_keys.add(rec.model_id)
        self.persist_all(conn)

    def load_from_db(self, conn: sqlite3.Connection) -> None:
        """Load health state from SQLite model_health table."""
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT model_id, successes, failures, ttft_ms_ewma, last_success_at,
                   last_failure_at, last_error_code, consecutive_failures, cooldown_until
            FROM model_health;
            """
        )
        for row in cursor.fetchall():
            self._records[row["model_id"]] = ModelHealthRecord(
                model_id=row["model_id"],
                successes=int(row["successes"]),
                failures=int(row["failures"]),
                ttft_ms_ewma=float(row["ttft_ms_ewma"]) if row["ttft_ms_ewma"] is not None else None,
                last_success_at=row["last_success_at"],
                last_failure_at=row["last_failure_at"],
                last_error_code=row["last_error_code"],
                consecutive_failures=int(row["consecutive_failures"]),
                cooldown_until=row["cooldown_until"],
            )

    def persist_all(self, conn: sqlite3.Connection | None = None) -> None:
        """Persist all dirty records to SQLite model_health table."""
        if not self._dirty_keys:
            return
        to_save = [self._records[k] for k in list(self._dirty_keys) if k in self._records]
        if not to_save:
            self._dirty_keys.clear()
            return

        should_close = False
        active_conn = conn
        if active_conn is None:
            active_conn = create_connection()
            should_close = True

        try:
            for rec in to_save:
                active_conn.execute(
                    """INSERT INTO model_health (
                        model_id, successes, failures, ttft_ms_ewma, last_success_at,
                        last_failure_at, last_error_code, consecutive_failures, cooldown_until
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(model_id) DO UPDATE SET
                        successes = excluded.successes, failures = excluded.failures,
                        ttft_ms_ewma = excluded.ttft_ms_ewma, last_success_at = excluded.last_success_at,
                        last_failure_at = excluded.last_failure_at, last_error_code = excluded.last_error_code,
                        consecutive_failures = excluded.consecutive_failures, cooldown_until = excluded.cooldown_until;""",
                    (
                        rec.model_id, rec.successes, rec.failures, rec.ttft_ms_ewma,
                        rec.last_success_at, rec.last_failure_at, rec.last_error_code,
                        rec.consecutive_failures, rec.cooldown_until,
                    ),
                )
            active_conn.commit()
            self._dirty_keys.clear()
            self._last_persist_mono = time.monotonic()
        finally:
            if should_close and active_conn:
                active_conn.close()

    def _maybe_persist_throttled(self, conn: sqlite3.Connection | None) -> None:
        now_mono = time.monotonic()
        if now_mono - self._last_persist_mono >= self._persist_interval:
            self.persist_all(conn)


_health_store_instance: ModelHealthStore | None = None


def get_health_store() -> ModelHealthStore:
    """Return singleton instance of ModelHealthStore."""
    global _health_store_instance
    if _health_store_instance is None:
        _health_store_instance = ModelHealthStore()
    return _health_store_instance


def set_health_store(store: ModelHealthStore | None) -> None:
    """Override singleton instance (for testing)."""
    global _health_store_instance
    _health_store_instance = store
