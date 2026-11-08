"""Process-wide singletons. One instance only (see hub.py)."""

from __future__ import annotations

import logging

from .config import settings
from .enrich import Enricher, make_gemini_generate
from .fcm import FcmSender
from .hub import Hub
from .parcels import ParcelStore
from .pipeline import Pipeline

log = logging.getLogger(__name__)


def _build() -> Pipeline:
    hub = Hub(buffer_size=settings.replay_buffer_size)
    generate = None
    if settings.gemini_api_key:
        generate = make_gemini_generate(
            settings.gemini_api_key, settings.gemini_model, settings.gemini_thinking_budget
        )
    else:
        log.warning("GEMINI_API_KEY not set: enrichment will use templates")
    return Pipeline(
        hub=hub,
        parcels=ParcelStore(),
        enricher=Enricher(generate, timeout_s=settings.enrich_timeout_s),
        fcm=FcmSender(hub, settings.fcm_enabled, settings.firebase_project_id, settings.public_app_url),
        coalesce_window_s=settings.coalesce_window_s,
    )


pipeline = _build()
hub = pipeline.hub
