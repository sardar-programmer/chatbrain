"""Pure functions for model candidate ranking and filtering (M1.3c)."""

from datetime import datetime, timezone
import statistics
from typing import Any
from app.services.ai.model_health import ModelHealthRecord
from app.services.ai.provider import ModelInfo, derive_kind

DEFAULT_NEUTRAL_TTFT_MS = 2000.0


def rank_candidates(
    models: list[ModelInfo],
    health: dict[str, ModelHealthRecord],
    default_model_id: str | None = None,
    excluded: list[str] | None = None,
    now: datetime | None = None,
) -> list[ModelInfo]:
    """Rank eligible chat candidate models according to speed, health, and cooldown state."""
    current_time = now or datetime.now(timezone.utc)
    excluded_set = set(excluded or [])

    # 1. Filter chat models not excluded
    chat_models: list[ModelInfo] = []
    for m in models:
        if m.id in excluded_set:
            continue
        kind_info = derive_kind(m.id, m.supported_actions, m.capabilities)
        if kind_info.kind == "chat":
            chat_models.append(m)

    if not chat_models:
        return []

    # 2. Separate into cooling and available
    cooling: list[ModelInfo] = []
    available: list[ModelInfo] = []

    for m in chat_models:
        rec = health.get(m.id)
        if rec and rec.is_in_cooldown(current_time):
            cooling.append(m)
        else:
            available.append(m)

    # 3. If ALL models are in cooldown, order them by earliest expiry so caller can wait
    if len(cooling) == len(chat_models):
        def _expiry_key(m: ModelInfo) -> tuple[str, str]:
            rec = health.get(m.id)
            exp = rec.cooldown_until if rec and rec.cooldown_until else ""
            return (exp, m.id)

        return sorted(cooling, key=_expiry_key)

    # 4. Check if default model is available and not cooling
    default_model: ModelInfo | None = None
    remaining_available: list[ModelInfo] = []

    for m in available:
        if default_model_id and m.id == default_model_id:
            default_model = m
        else:
            remaining_available.append(m)

    # 5. Compute neutral TTFT (median of known candidate values, or 2000 ms if none known)
    known_ttfts: list[float] = []
    for m in available:
        rec = health.get(m.id)
        if rec and rec.ttft_ms_ewma is not None:
            known_ttfts.append(rec.ttft_ms_ewma)

    neutral_ttft = statistics.median(known_ttfts) if known_ttfts else DEFAULT_NEUTRAL_TTFT_MS

    # 6. Sort non-default candidates by (effective_ttft, consecutive_failures, id)
    def _rank_key(m: ModelInfo) -> tuple[float, int, str]:
        rec = health.get(m.id)
        effective_ttft = (
            rec.ttft_ms_ewma
            if (rec and rec.ttft_ms_ewma is not None)
            else neutral_ttft
        )
        failures = rec.consecutive_failures if rec else 0
        return (effective_ttft, failures, m.id)

    sorted_remaining = sorted(remaining_available, key=_rank_key)

    if default_model is not None:
        return [default_model] + sorted_remaining
    return sorted_remaining
