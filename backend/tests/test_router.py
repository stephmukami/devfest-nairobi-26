"""The routing policy table from the plan, one test per cell, plus suppression."""

import pytest

from app.models import Event, SessionState
from app.router import decide


def event(priority: str, parcel_id: str = "SHP-48213") -> Event:
    return Event(
        event_id="evt_test",
        type="test",
        occurred_at="2026-11-08T14:05:00Z",
        user_id="u_amani",
        priority=priority,
        payload={"parcel_id": parcel_id},
    )


VISIBLE = SessionState(connection_count=1, visible=True, view="orders_list")
HIDDEN = SessionState(connection_count=1, visible=False)
OFFLINE = SessionState(connection_count=0, visible=False)


@pytest.mark.parametrize(
    "priority, session, action, sticky, urgency, also_push",
    [
        # Tab visible and connected: toast there, and push to other devices unless info
        ("info", VISIBLE, "toast", False, "normal", False),
        ("action", VISIBLE, "toast", False, "normal", True),
        ("critical", VISIBLE, "toast", True, "high", True),
        # Connected but hidden
        ("info", HIDDEN, "inbox_only", False, "normal", False),
        ("action", HIDDEN, "push", False, "normal", False),
        ("critical", HIDDEN, "push", False, "high", False),
        # Not connected
        ("info", OFFLINE, "inbox_only", False, "normal", False),
        ("action", OFFLINE, "push", False, "normal", False),
        ("critical", OFFLINE, "push", False, "high", False),
    ],
)
def test_policy_table(priority, session, action, sticky, urgency, also_push):
    decision = decide(event(priority), session)
    assert decision.action == action
    assert decision.sticky is sticky
    assert decision.urgency == urgency
    assert decision.also_push is also_push
    assert decision.also_inbox is True


@pytest.mark.parametrize("priority", ["info", "action", "critical"])
def test_suppressed_when_viewing_same_parcel(priority):
    session = SessionState(connection_count=1, visible=True, view="parcel_detail", parcel_id="SHP-48213")
    decision = decide(event(priority), session)
    assert decision.action == "inline"
    assert decision.also_inbox is False


def test_not_suppressed_for_a_different_parcel():
    session = SessionState(connection_count=1, visible=True, view="parcel_detail", parcel_id="SHP-48214")
    assert decide(event("action"), session).action == "toast"


def test_not_suppressed_when_detail_tab_is_hidden():
    session = SessionState(connection_count=1, visible=False, view="parcel_detail", parcel_id="SHP-48213")
    assert decide(event("action"), session).action == "push"


def test_visible_flag_without_connection_is_treated_as_offline():
    session = SessionState(connection_count=0, visible=True, view="orders_list")
    assert decide(event("action"), session).action == "push"
