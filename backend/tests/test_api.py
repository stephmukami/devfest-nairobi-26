"""End-to-end through the HTTP API (no Gemini, no FCM credentials needed)."""

import asyncio

import pytest
from fastapi.testclient import TestClient

from app.config import switches
from app.hub import Hub
from app.main import app
from app.models import Context, Decision, Delivery, Event, SessionState
from app.state import hub, pipeline


@pytest.fixture()
def client():
    switches.enrich_mode = "template"
    switches.coalesce = False
    with TestClient(app) as c:
        c.post("/api/demo/reset")
        yield c


def test_emit_offline_action_goes_to_push_then_inbox(client):
    r = client.post("/api/demo/events", json={"type": "parcel.out_for_delivery", "user_id": "u_amani"})
    assert r.status_code == 200, r.text
    delivery = r.json()["delivery"]
    assert delivery["decision"]["action"] == "push"
    assert delivery["events"][0]["priority"] == "action"
    channels = {c["channel"]: c["status"] for c in delivery["channels"]}
    assert channels["fcm"] == "no_tokens"
    assert channels["inbox"] == "added"
    assert client.get("/api/inbox", params={"user_id": "u_amani"}).json()[0]["event_id"] == delivery["id"]
    parcel = next(p for p in client.get("/api/parcels", params={"user_id": "u_amani"}).json() if p["parcel_id"] == "SHP-48213")
    assert parcel["status"] == "out_for_delivery" and parcel["eta_minutes"] == 25


def test_device_counts_follow_the_persona_a_browser_last_registered_as(client):
    token = "tok-device-counts-" + "x" * 40
    assert client.post("/api/devices", json={"user_id": "u_amani", "token": token}).status_code == 200
    counts = client.get("/api/demo/devices").json()
    assert set(counts) >= {"u_amani", "u_wanjiru"}
    amani_before = counts["u_amani"]
    assert amani_before >= 1

    # Switching persona on the same phone moves its token.
    client.post("/api/devices", json={"user_id": "u_wanjiru", "token": token})
    counts = client.get("/api/demo/devices").json()
    assert counts["u_amani"] == amani_before - 1
    assert counts["u_wanjiru"] >= 1
    asyncio.run(hub.remove_token(token))


def test_priority_cannot_be_set_by_emitter(client):
    r = client.post(
        "/api/demo/events",
        json={"type": "parcel.delivered", "user_id": "u_amani", "payload": {"priority": "critical"}},
    )
    assert r.json()["event"]["priority"] == "info"


def test_unknown_type_and_user_rejected(client):
    assert client.post("/api/demo/events", json={"type": "nope", "user_id": "u_amani"}).status_code == 422
    assert client.post("/api/demo/events", json={"type": "parcel.delivered", "user_id": "x"}).status_code == 404


def test_context_rejects_free_text(client):
    body = {
        "user_id": "u_amani",
        "client_id": "tab_123456",
        "context": {"view": "home", "visible": True, "recent_actions": ["my phone is 0712 345 678"]},
    }
    assert client.post("/api/session/context", json=body).status_code == 422


def test_inline_when_viewing_same_parcel(client):
    conn = hub.connect("u_amani", "tab_inline1")
    try:
        client.post(
            "/api/session/context",
            json={
                "user_id": "u_amani",
                "client_id": "tab_inline1",
                "context": {"view": "parcel_detail", "parcel_id": "SHP-48213", "visible": True},
            },
        )
        r = client.post("/api/demo/events", json={"type": "parcel.out_for_delivery", "user_id": "u_amani"})
        delivery = r.json()["delivery"]
        assert delivery["decision"]["action"] == "inline"
        assert delivery["message"] is None
        assert delivery["inbox_item"] is None
    finally:
        hub.disconnect(conn)


def test_demo_key_required_when_configured(client):
    from app import demo

    object.__setattr__(demo.settings, "demo_key", "s3cret")  # Settings is a frozen dataclass
    try:
        assert client.get("/api/demo/settings").status_code == 401
        assert client.get("/api/demo/settings", headers={"X-Demo-Key": "s3cret"}).status_code == 200
    finally:
        object.__setattr__(demo.settings, "demo_key", None)


def _delivery(i: int) -> Delivery:
    return Delivery(
        id=f"evt_{i}",
        kind="single",
        user_id="u_amani",
        priority="info",
        events=[Event(event_id=f"evt_{i}", type="t", occurred_at="", user_id="u_amani", priority="info", payload={})],
        session=SessionState(),
        context=Context(),
        decision=Decision(action="inbox_only", reason=""),
        created_at="",
    )


def test_replay_after_last_event_id():
    h = Hub(buffer_size=3)
    for i in range(5):
        h.publish(_delivery(i))
    assert [d.id for d in h.replay("u_amani", "evt_3")] == ["evt_4"]
    assert [d.id for d in h.replay("u_amani", "evt_0")] == ["evt_2", "evt_3", "evt_4"]  # rolled off
    assert h.replay("u_amani", None) == []


def test_burst_coalesces_into_one_delivery(client):
    import time

    pipeline._window = 0.8  # burst events are 0.15 s apart
    client.put("/api/demo/settings", json={"coalesce": True})
    try:
        r = client.post("/api/demo/scenarios/burst", json={"user_id": "u_amani"})
        assert r.json()["coalesced"] is True
        time.sleep(1.2)
        recent = client.get("/api/demo/deliveries", params={"user_id": "u_amani"}).json()
        assert len(recent) == 1
        assert recent[0]["kind"] == "digest" and len(recent[0]["events"]) == 3
        assert recent[0]["priority"] == "action"
    finally:
        client.put("/api/demo/settings", json={"coalesce": False})
