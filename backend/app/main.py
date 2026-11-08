"""Shippy notifications demo API."""

from __future__ import annotations

import json
import logging

from fastapi import FastAPI, Header, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sse_starlette.sse import EventSourceResponse

from . import demo
from .catalogue import catalogue_listing
from .config import settings, switches
from .models import CLIENT_ID_PATTERN, ContextUpdate, DeviceRegistration, UserRef
from .parcels import PERSONAS
from .state import hub, pipeline

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")

app = FastAPI(title="Shippy notifications demo")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_methods=["GET", "POST", "PUT", "OPTIONS"],
    allow_headers=["Content-Type", "Last-Event-ID", "X-Demo-Key"],
)

app.include_router(demo.router)


def _user(user_id: str) -> str:
    if user_id not in PERSONAS:
        raise HTTPException(status_code=404, detail=f"Unknown user {user_id}")
    return user_id


# Cloud Run's front end reserves paths ending in "z" (e.g. /healthz) and returns its own 404,
# so the deployed health check is /api/health. /healthz is kept for local use.
@app.get("/api/health")
@app.get("/healthz", include_in_schema=False)
async def health():
    return {"ok": True}


@app.get("/api/config")
async def config():
    return {
        "personas": [{"user_id": uid, **info} for uid, info in PERSONAS.items()],
        "catalogue": catalogue_listing(),
        "gemini_configured": pipeline.enricher.configured,
        "gemini_model": settings.gemini_model if pipeline.enricher.configured else None,
        "fcm_enabled": pipeline.fcm.enabled,
        "demo_key_required": bool(settings.demo_key),
        "switches": switches.as_dict(),
    }


@app.get("/api/parcels")
async def parcels(user_id: str):
    return pipeline.parcels.list(_user(user_id))


@app.get("/api/inbox")
async def inbox(user_id: str):
    return hub.inbox(_user(user_id))


@app.post("/api/inbox/read")
async def inbox_read(ref: UserRef):
    hub.mark_inbox_read(_user(ref.user_id))
    return {"ok": True}


@app.get("/api/presence")
async def presence(user_id: str):
    return hub.presence_snapshot(_user(user_id))


@app.post("/api/session/context")
async def session_context(update: ContextUpdate):
    hub.update_context(_user(update.user_id), update.client_id, update.context)
    return hub.session_state(update.user_id)


@app.post("/api/devices")
async def register_device(reg: DeviceRegistration):
    hub.add_token(_user(reg.user_id), reg.token)
    return {"ok": True, "devices": len(hub.tokens(reg.user_id))}


@app.get("/api/stream")
async def stream(
    user_id: str,
    client_id: str = Query(pattern=CLIENT_ID_PATTERN),
    observer: bool = False,
    last_event_id_query: str | None = Query(default=None, alias="last_event_id"),
    last_event_id_header: str | None = Header(default=None, alias="Last-Event-ID"),
):
    """SSE stream. Observers (the stage/inspector page) see everything but do not count as presence.

    Demo auth only: user_id is a query param because EventSource cannot set headers.
    Production needs a cookie or a short-lived stream token.
    """
    _user(user_id)
    conn = hub.connect(user_id, client_id, observer)
    missed = hub.replay(user_id, last_event_id_header or last_event_id_query)

    async def events():
        try:
            yield {"event": "presence", "data": json.dumps(hub.presence_snapshot(user_id))}
            for delivery in missed:
                yield {"id": delivery.id, "event": "delivery", "data": delivery.model_dump_json()}
            while True:
                kind, event_id, data = await conn.queue.get()
                message = {"event": kind, "data": data}
                if event_id:
                    message["id"] = event_id
                yield message
        finally:
            hub.disconnect(conn)

    return EventSourceResponse(
        events(),
        ping=15,
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
