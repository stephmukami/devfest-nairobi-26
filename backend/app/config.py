"""Environment configuration and runtime kill switches.

`settings` is read once at startup from env vars.
`switches` can be flipped at runtime from the demo controller (PUT /api/demo/settings).
"""

from __future__ import annotations

import os
from dataclasses import asdict, dataclass, field
from typing import Literal


def _bool(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None or raw == "":
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _optional_int(name: str, default: int | None) -> int | None:
    raw = os.getenv(name)
    if raw is None:
        return default
    raw = raw.strip()
    return None if raw == "" or raw.lower() == "none" else int(raw)


def _list(name: str, default: list[str]) -> list[str]:
    raw = os.getenv(name)
    if not raw:
        return default
    return [item.strip().rstrip("/") for item in raw.split(",") if item.strip()]


@dataclass(frozen=True)
class Settings:
    gemini_api_key: str | None = None
    gemini_model: str = "gemini-2.5-flash"
    # Thinking adds latency that blows the 1.5 s budget. 0 disables it on 2.5 Flash.
    # Set GEMINI_THINKING_BUDGET="" to omit the setting for models that reject it.
    gemini_thinking_budget: int | None = 0
    enrich_timeout_s: float = 1.5
    allowed_origins: list[str] = field(default_factory=list)
    demo_key: str | None = None
    # Absolute https origin of the web app; used for FCM deep links. Empty = relative links.
    public_app_url: str = ""
    fcm_enabled: bool = True
    firebase_project_id: str | None = None
    rate_limit_per_min: int = 60
    replay_buffer_size: int = 50
    coalesce_window_s: float = 2.0

    @classmethod
    def from_env(cls) -> "Settings":
        return cls(
            # strip(): secrets created from a shell pipe often carry a trailing newline
            gemini_api_key=(os.getenv("GEMINI_API_KEY") or "").strip() or None,
            gemini_model=os.getenv("GEMINI_MODEL") or cls.gemini_model,
            gemini_thinking_budget=_optional_int("GEMINI_THINKING_BUDGET", 0),
            enrich_timeout_s=float(os.getenv("ENRICH_TIMEOUT_S") or 1.5),
            allowed_origins=_list(
                "ALLOWED_ORIGIN",
                ["http://localhost:5173", "http://127.0.0.1:5173"],
            ),
            demo_key=os.getenv("DEMO_KEY") or None,
            public_app_url=(os.getenv("PUBLIC_APP_URL") or "").rstrip("/"),
            fcm_enabled=_bool("FCM_ENABLED", True),
            firebase_project_id=os.getenv("FIREBASE_PROJECT_ID") or None,
            rate_limit_per_min=int(os.getenv("RATE_LIMIT_PER_MIN") or 60),
            replay_buffer_size=int(os.getenv("REPLAY_BUFFER_SIZE") or 50),
            coalesce_window_s=float(os.getenv("COALESCE_WINDOW_S") or 2.0),
        )


EnrichMode = Literal["gemini", "template"]


@dataclass
class Switches:
    enrich_mode: EnrichMode = "gemini"
    simulate_gemini_failure: bool = False
    coalesce: bool = False

    @classmethod
    def from_env(cls) -> "Switches":
        mode = (os.getenv("ENRICH_MODE") or "gemini").strip().lower()
        return cls(
            enrich_mode="template" if mode == "template" else "gemini",
            simulate_gemini_failure=_bool("SIMULATE_GEMINI_FAILURE"),
            coalesce=_bool("COALESCE"),
        )

    def as_dict(self) -> dict:
        return asdict(self)


settings = Settings.from_env()
switches = Switches.from_env()
