"""Demo personas and parcels. All data is fictional (it is sent to Gemini).

Each persona starts in a different situation so every scenario can be shown without first
replaying a chain of events:
  Amani    (en-KE)  everyday: parcels at each early stage, one delivered
  Wanjiru  (sw-KE)  Swahili wording, one parcel already out for delivery
  Otieno   (en-KE)  needs to act: fee due, address to confirm, a delay
  Fatuma   (sw-KE)  things went wrong: failed delivery, plus a delivered parcel
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

from .catalogue import CATALOGUE, timeline_label
from .models import Event, Parcel, TimelineEntry, new_id

PERSONAS: dict[str, dict[str, str]] = {
    "u_amani": {"name": "Amani", "locale": "en-KE", "about": "Everyday orders"},
    "u_wanjiru": {"name": "Wanjiru", "locale": "sw-KE", "about": "Swahili, rider on the way"},
    "u_otieno": {"name": "Otieno", "locale": "en-KE", "about": "Needs to act: fee, address, delay"},
    "u_fatuma": {"name": "Fatuma", "locale": "sw-KE", "about": "Failed delivery to fix"},
}

_EARLY = ["order.confirmed_by_store", "parcel.received_at_hub", "parcel.in_transit"]

# Seed order matters for Amani: the burst scenario uses a persona's first, second and last parcel,
# and the tests drive SHP-48213 (first, in transit).
_SEED: list[dict[str, Any]] = [
    # Amani
    {"parcel_id": "SHP-48213", "user_id": "u_amani", "store": "Kilimani Kicks", "item": "Running shoes",
     "rider_first_name": "Joseph", "history": _EARLY},
    {"parcel_id": "SHP-48214", "user_id": "u_amani", "store": "Nyota Books", "item": "Cookbook",
     "rider_first_name": "Joseph", "history": _EARLY[:2]},
    {"parcel_id": "SHP-48210", "user_id": "u_amani", "store": "Jua Kali Crafts", "item": "Woven basket",
     "rider_first_name": "Joseph", "history": [*_EARLY, "parcel.out_for_delivery", "parcel.delivered"], "days_ago": 1},
    {"parcel_id": "SHP-48215", "user_id": "u_amani", "store": "Savanna Home", "item": "Table lamp",
     "rider_first_name": "Joseph", "history": _EARLY[:1]},
    # Wanjiru
    {"parcel_id": "SHP-51022", "user_id": "u_wanjiru", "store": "Pwani Threads", "item": "Linen shirt",
     "rider_first_name": "Achieng", "history": _EARLY},
    {"parcel_id": "SHP-51024", "user_id": "u_wanjiru", "store": "Duka la Viungo", "item": "Spice set",
     "rider_first_name": "Achieng", "history": [*_EARLY, "parcel.out_for_delivery"], "payload": {"eta_minutes": 15}},
    {"parcel_id": "SHP-51023", "user_id": "u_wanjiru", "store": "Mlima Tech", "item": "Phone case",
     "rider_first_name": "Achieng", "history": _EARLY[:2]},
    # Otieno
    {"parcel_id": "SHP-60311", "user_id": "u_otieno", "store": "Rift Valley Coffee", "item": "Coffee beans",
     "rider_first_name": "Brian", "history": [*_EARLY[:2], "payment.delivery_fee_due"], "payload": {"fee_kes": 200}},
    {"parcel_id": "SHP-60312", "user_id": "u_otieno", "store": "Mtaani Electronics", "item": "Bluetooth speaker",
     "rider_first_name": "Brian", "history": [*_EARLY, "parcel.out_for_delivery", "address.confirmation_needed"]},
    {"parcel_id": "SHP-60313", "user_id": "u_otieno", "store": "Kilimani Kicks", "item": "Football boots",
     "rider_first_name": "Brian", "history": [*_EARLY, "parcel.delayed"], "payload": {"eta_minutes": 70, "delay_minutes": 30}},
    # Fatuma
    {"parcel_id": "SHP-72501", "user_id": "u_fatuma", "store": "Lamu Linens", "item": "Bedsheet set",
     "rider_first_name": "Hassan", "history": [*_EARLY, "parcel.out_for_delivery", "parcel.delivery_failed"]},
    {"parcel_id": "SHP-72502", "user_id": "u_fatuma", "store": "Nyota Books", "item": "Storybook",
     "rider_first_name": "Hassan", "history": [*_EARLY, "parcel.out_for_delivery", "parcel.delivered"], "days_ago": 3},
    {"parcel_id": "SHP-72503", "user_id": "u_fatuma", "store": "Soko Fresh", "item": "Blender",
     "rider_first_name": "Hassan", "history": _EARLY},
]

# Extra facts each event type needs when the demo controller does not supply them.
_EVENT_DEFAULTS: dict[str, dict[str, Any]] = {
    "parcel.out_for_delivery": {"eta_minutes": 25},
    "payment.delivery_fee_due": {"fee_kes": 150},
    "parcel.delayed": {"eta_minutes": 50, "delay_minutes": 25},
    "parcel.delivery_failed": {"reason_code": "recipient_unavailable"},
}

_RIDER_EVENTS = {"parcel.out_for_delivery", "address.confirmation_needed", "parcel.delivery_failed"}

# Gap between seeded timeline steps, so histories read naturally ("2 h ago", "yesterday").
_STEP_GAP = timedelta(minutes=40)


def _iso(dt: datetime) -> str:
    return dt.isoformat(timespec="seconds").replace("+00:00", "Z")


class ParcelStore:
    def __init__(self) -> None:
        self._parcels: dict[str, Parcel] = {}
        self.reset()

    def reset(self) -> None:
        self._parcels = {}
        now = datetime.now(timezone.utc)
        for seed in _SEED:
            parcel = Parcel(
                parcel_id=seed["parcel_id"],
                user_id=seed["user_id"],
                store=seed["store"],
                item=seed["item"],
                status=CATALOGUE[seed["history"][0]].status,
                rider_first_name=seed["rider_first_name"],
            )
            history = seed["history"]
            end = now - timedelta(days=seed.get("days_ago", 0))
            for i, event_type in enumerate(history):
                payload = self.default_payload(event_type, parcel)
                payload.update(seed.get("payload", {}))
                at = end - _STEP_GAP * (len(history) - 1 - i)
                self._advance(parcel, event_type, payload, new_id("seed"), _iso(at))
            self._parcels[parcel.parcel_id] = parcel

    def list(self, user_id: str) -> list[Parcel]:
        return [p.model_copy(deep=True) for p in self._parcels.values() if p.user_id == user_id]

    def get(self, parcel_id: str, user_id: str) -> Parcel | None:
        parcel = self._parcels.get(parcel_id)
        return parcel if parcel and parcel.user_id == user_id else None

    def default_payload(self, event_type: str, parcel: Parcel) -> dict[str, Any]:
        payload: dict[str, Any] = {"parcel_id": parcel.parcel_id, "store": parcel.store, "item": parcel.item}
        if event_type in _RIDER_EVENTS:
            payload["rider_first_name"] = parcel.rider_first_name
        payload.update(_EVENT_DEFAULTS.get(event_type, {}))
        return payload

    @staticmethod
    def _advance(parcel: Parcel, event_type: str, payload: dict[str, Any], event_id: str, at: str) -> None:
        """Move a parcel to the event's status, copy the facts it carries, append a timeline entry."""
        parcel.status = CATALOGUE[event_type].status
        if isinstance(payload.get("eta_minutes"), int):
            parcel.eta_minutes = payload["eta_minutes"]
        if isinstance(payload.get("rider_first_name"), str):
            parcel.rider_first_name = payload["rider_first_name"]
        if isinstance(payload.get("fee_kes"), int):
            parcel.fee_kes = payload["fee_kes"]
        if event_type == "parcel.delivered":
            parcel.eta_minutes = None
            parcel.fee_kes = None
        if event_type == "parcel.delivery_failed":
            parcel.eta_minutes = None  # no ETA until the customer reschedules
        parcel.timeline.append(
            TimelineEntry(event_id=event_id, type=event_type, label=timeline_label(event_type, payload), at=at)
        )

    def apply(self, event: Event) -> Parcel | None:
        """Move the parcel's state forward and append a timeline entry."""
        parcel = self.get(event.parcel_id or "", event.user_id)
        if event.type not in CATALOGUE or parcel is None:
            return None
        self._advance(parcel, event.type, event.payload, event.event_id, event.occurred_at)
        return parcel.model_copy(deep=True)
