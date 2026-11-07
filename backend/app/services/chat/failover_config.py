"""Configuration constants for model failover and hedging (M1.3c)."""

from dataclasses import dataclass, field
import os


@dataclass
class FailoverConfig:
    """Tunable timing and retry parameters for failover execution."""

    hedge_delay: float = 3.0
    first_token_timeout: float = 12.0
    idle_chunk_timeout: float = 60.0
    total_budget: float = 90.0
    backoff_steps: list[float] = field(default_factory=lambda: [3.0, 6.0, 10.0])
    max_parallel: int = 2
    persistence_interval: float = 0.300
    ping_interval: float = 15.0

    def __post_init__(self) -> None:
        if os.environ.get("CHATBRAIN_ENV") == "dev":
            override = os.environ.get("CHATBRAIN_TOTAL_BUDGET_SECONDS")
            if override:
                try:
                    self.total_budget = float(override)
                except ValueError:
                    pass


_default_config = FailoverConfig()


def get_failover_config() -> FailoverConfig:
    """Return current failover configuration."""
    global _default_config
    return _default_config


def set_failover_config(config: FailoverConfig) -> None:
    """Override failover configuration (used in tests)."""
    global _default_config
    _default_config = config
