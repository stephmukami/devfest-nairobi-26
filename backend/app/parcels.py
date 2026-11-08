"""Demo personas and parcels. All data is fictional (it is sent to Gemini)."""

from __future__ import annotations

from typing import Any

from .catalogue import CATALOGUE, timeline_label
from .models import Event, Parcel, TimelineEntry, new_id, utcnow_iso

PERSONAS: dict[str, dict[str, str]] = {
    "u_amani": {"name": "Amani", "locale": "en-KE"},
    "u_wanjiru": {"name": "Wanjiru", "locale": "sw-KE"},
}

_SEED: list[dict[str, Any]] = [
    {"parcel_id": "SHP-48213", "user_id": "u_amani", "store": "Kilimani Kicks", "item": "Running shoes",
     "rider_first_name": "Joseph", "history": ["order.confirmed_by_store", "parcel.received_at_hub", "parcel.in_transit"]},
    {"parcel_id": "SHP-48214", "user_id": "u_amani", "store": "Nyota Books", "item": "Cookbook",
     "rider_first_name": "Joseph", "history": ["order.confirmed_by_store", "parcel.received_at_hub"]},
    {"parcel_id": "SHP-48215", "user_id": "u_amani", "store": "Savanna Home", "item": "Table lamp",
     "rider_first_name": "Joseph", "history": ["order.confirmed_by_store"]},
    {"parcel_id": "SHP-51022", "user_id": "u_wanjiru", "store": "Pwani Threads", "item": "Linen shirt",
     "rider_first_name": "Achieng", "history": ["order.confirmed_by_store", "parcel.received_at_hub", "parcel.in_transit"]},
    {"parcel_id": "SHP-51023", "user_id": "u_wanjiru", "store": "Mlima Tech", "item": "Phone case",
     "rider_first_name": "Achieng", "history": ["order.confirmed_by_store", "parcel.received_at_hub"]},
]

# Extra facts each event type needs when the demo controller does not supply them.
_EVENT_DEFAULTS: dict[str, dict[str, Any]] = {
    "parcel.out_for_delivery": {"eta_minutes": 25},
    "payment.delivery_fee_due": {"fee_kes": 150},
    "parcel.delayed": {"eta_minutes": 50, "delay_minutes": 25},
    "parcel.delivery_failed": {"reason_code": "recipient_unavailable"},
}

_RIDER_EVENTS = {"parcel.out_for_delivery", "address.confirmation_needed", "parcel.delivery_failed"}


class ParcelStore:
    def __init__(self) -> None:
        self._parcels: dict[str, Parcel] = {}
        self.reset()

    def reset(self) -> None:
        self._parcels = {}
        now = utcnow_iso()
        for seed in _SEED:
            facts = {"store": seed["store"], "item": seed["item"]}
            parcel = Parcel(
                parcel_id=seed["parcel_id"],
                user_id=seed["user_id"],
                store=seed["store"],
                item=seed["item"],
                status=CATALOGUE[seed["history"][-1]].status,
                rider_first_name=seed["rider_first_name"],
                timeline=[
                    TimelineEntry(event_id=new_id("seed"), type=t, label=timeline_label(t, facts), at=now)
                    for t in seed["history"]
                ],
            )
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

    def apply(self, event: Event) -> Parcel | None:
        """Move the parcel's state forward and append a timeline entry."""
        spec = CATALOGUE.get(event.type)
        parcel = self.get(event.parcel_id or "", event.user_id)
        if spec is None or parcel is None:
            return None
        payload = event.payload
        parcel.status = spec.status
        if isinstance(payload.get("eta_minutes"), int):
            parcel.eta_minutes = payload["eta_minutes"]
        if isinstance(payload.get("rider_first_name"), str):
            parcel.rider_first_name = payload["rider_first_name"]
        if isinstance(payload.get("fee_kes"), int):
            parcel.fee_kes = payload["fee_kes"]
        if event.type == "parcel.delivered":
            parcel.eta_minutes = None
            parcel.fee_kes = None
        parcel.timeline.append(
            TimelineEntry(
                event_id=event.event_id,
                type=event.type,
                label=timeline_label(event.type, payload),
                at=event.occurred_at,
            )
        )
        return parcel.model_copy(deep=True)
