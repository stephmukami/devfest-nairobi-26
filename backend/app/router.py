"""Decision engine. A pure function: no I/O, no model calls, fully table-tested.

Rules decide *whether* and *where* to speak. The LLM only ever decides *how*.
"""

from __future__ import annotations

from .models import Decision, Event, SessionState


def decide(event: Event, session: SessionState) -> Decision:
    connected = session.connection_count > 0
    visible = connected and session.visible
    parcel_id = event.parcel_id

    # Suppression is checked first: the user is already looking at this parcel.
    if visible and session.view == "parcel_detail" and parcel_id and session.parcel_id == parcel_id:
        return Decision(
            action="inline",
            reason=f"User is viewing {parcel_id}; update the timeline in place, no notification.",
        )

    priority = event.priority

    if visible:
        # The toast reaches the device being looked at. Action and critical events also push to the
        # user's other devices (a phone in a pocket), which the FCM sender picks per device.
        also_push = priority != "info"
        return Decision(
            action="toast",
            sticky=priority == "critical",
            also_inbox=True,
            also_push=also_push,
            urgency="high" if priority == "critical" else "normal",
            reason=f"{priority} event, tab visible and connected: SSE toast"
            + (" (sticky)" if priority == "critical" else "")
            + ("; FCM push to the user's other devices." if also_push else "."),
        )

    if priority == "info":
        where = "tab hidden" if connected else "no open tab"
        return Decision(
            action="inbox_only",
            also_inbox=True,
            reason=f"info event, {where}: inbox and badge only, no interruption.",
        )

    where = "tab connected but hidden" if connected else "no open tab"
    return Decision(
        action="push",
        also_inbox=True,
        urgency="high" if priority == "critical" else "normal",
        reason=f"{priority} event, {where}: FCM push"
        + (" with high urgency." if priority == "critical" else "."),
    )
