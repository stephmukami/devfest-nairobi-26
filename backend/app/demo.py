"""Demo controller endpoints. Protected by X-Demo-Key (when DEMO_KEY is set) and a rate limit,
because every emit can cost a Gemini call."""

from __future__ import annotations

import asyncio
import secrets
import time
from collections import deque

from fastapi import APIRouter, Depends, Header, HTTPException, Request

from .catalogue import CATALOGUE
from .config import settings, switches
from .models import BurstRequest, EmitRequest, SwitchesUpdate
from .parcels import PERSONAS
from .state import pipeline


class RateLimiter:
    """Sliding one-minute window per client IP. Good enough for a single-instance demo."""

    def __init__(self, per_minute: int) -> None:
        self._per_minute = per_minute
        self._hits: dict[str, deque[float]] = {}

    def check(self, key: str) -> bool:
        now = time.monotonic()
        hits = self._hits.setdefault(key, deque())
        while hits and now - hits[0] > 60:
            hits.popleft()
        if len(hits) >= self._per_minute:
            return False
        hits.append(now)
        return True


limiter = RateLimiter(settings.rate_limit_per_min)


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def require_demo_key(x_demo_key: str | None = Header(default=None)) -> None:
    if settings.demo_key and not secrets.compare_digest(x_demo_key or "", settings.demo_key):
        raise HTTPException(status_code=401, detail="Missing or wrong X-Demo-Key")


async def rate_limit(request: Request) -> None:
    if not limiter.check(client_ip(request)):
        raise HTTPException(status_code=429, detail="Slow down: demo rate limit reached")


def require_user(user_id: str) -> None:
    if user_id not in PERSONAS:
        raise HTTPException(status_code=404, detail=f"Unknown user {user_id}")


router = APIRouter(prefix="/api/demo", dependencies=[Depends(require_demo_key), Depends(rate_limit)])
# Cheap reads the stage view refreshes often: demo key only, no rate limit.
status_router = APIRouter(prefix="/api/demo", dependencies=[Depends(require_demo_key)])


@status_router.get("/devices")
async def devices():
    """Devices with alerts on, per persona. A browser's token belongs to the persona it last
    registered as, so this shows which persona a phone will actually receive pushes for."""
    return {user_id: len(await pipeline.hub.tokens(user_id)) for user_id in PERSONAS}


@router.post("/events")
async def emit(req: EmitRequest):
    require_user(req.user_id)
    if req.type not in CATALOGUE:
        raise HTTPException(status_code=422, detail=f"Unknown event type {req.type}")
    parcels = pipeline.parcels.list(req.user_id)
    parcel_id = req.parcel_id or (parcels[0].parcel_id if parcels else None)
    parcel = pipeline.parcels.get(parcel_id or "", req.user_id)
    if parcel is None:
        raise HTTPException(status_code=404, detail=f"Parcel {parcel_id} not found for {req.user_id}")

    payload = pipeline.parcels.default_payload(req.type, parcel)
    payload.update(req.payload or {})
    payload["parcel_id"] = parcel.parcel_id  # the target parcel cannot be overridden via payload

    event = pipeline.build_event(req.type, req.user_id, payload)
    delivery = await pipeline.submit(event)
    if delivery is None:
        return {"queued": True, "event": event, "window_s": settings.coalesce_window_s}
    return {"queued": False, "event": event, "delivery": delivery}


@router.post("/scenarios/burst")
async def burst(req: BurstRequest):
    """Three things happen at once. With coalescing on, the customer gets one notification."""
    require_user(req.user_id)
    parcels = pipeline.parcels.list(req.user_id)
    if not parcels:
        raise HTTPException(status_code=404, detail="No parcels")
    plan = [
        ("parcel.received_at_hub", parcels[-1]),
        ("parcel.in_transit", parcels[min(1, len(parcels) - 1)]),
        ("payment.delivery_fee_due", parcels[0]),
    ]
    results = []
    for event_type, parcel in plan:
        event = pipeline.build_event(event_type, req.user_id, pipeline.parcels.default_payload(event_type, parcel))
        results.append(await pipeline.submit(event))
        await asyncio.sleep(0.15)
    return {"coalesced": switches.coalesce, "deliveries": [d for d in results if d is not None]}


@router.get("/settings")
async def get_settings():
    return switches.as_dict()


@router.put("/settings")
async def put_settings(update: SwitchesUpdate):
    for key, value in update.model_dump(exclude_none=True).items():
        setattr(switches, key, value)
    if update.enrich_mode is not None or update.simulate_gemini_failure is not None:
        pipeline.enricher.clear_cache()
    return switches.as_dict()


@router.post("/reset")
async def reset():
    pipeline.parcels.reset()
    pipeline.hub.reset()
    pipeline.enricher.clear_cache()
    return {"ok": True}


@router.post("/devices/clear")
async def clear_devices():
    """Start a demo run with no registered devices. Phones with alerts still allowed register again
    the next time Shippy opens (or its live stream reconnects)."""
    return {"cleared": await pipeline.hub.clear_tokens()}


@router.get("/deliveries")
async def deliveries(user_id: str):
    require_user(user_id)
    return pipeline.hub.recent(user_id)
