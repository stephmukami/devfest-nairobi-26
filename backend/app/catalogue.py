"""Event catalogue: type -> priority, parcel status and fallback templates.

Priority comes from here, never from whoever emits the event.
Templates are the safe fallback when Gemini is off, slow or wrong, so they must
always satisfy the same length rules as the model output.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

from .models import PRIORITY_RANK, Event, IconName, Priority

TITLE_MAX = 45
BODY_MAX = 110


@dataclass(frozen=True)
class EventSpec:
    priority: Priority
    meaning: str
    status: str
    title: str
    body: str
    timeline: str
    icon: IconName  # default icon; Gemini may choose another from the allowlist


CATALOGUE: dict[str, EventSpec] = {
    "order.confirmed_by_store": EventSpec(
        "info", "Store accepted the order", "confirmed",
        "{store} confirmed your order",
        "Your {item} is being packed and will head to the Shippy hub next.",
        "Order confirmed by {store}", "store",
    ),
    "parcel.received_at_hub": EventSpec(
        "info", "Parcel reached the Shippy hub", "at_hub",
        "Your {item} is at the Shippy hub",
        "It arrived from {store} and will travel with your other parcels.",
        "Received at the Shippy hub", "warehouse",
    ),
    "parcel.in_transit": EventSpec(
        "info", "Moving to the customer's area", "in_transit",
        "Your {item} is on the move",
        "Your parcel from {store} is heading to your area.",
        "In transit to your area", "truck",
    ),
    "parcel.out_for_delivery": EventSpec(
        "action", "Customer should be reachable", "out_for_delivery",
        "Arriving in about {eta_minutes} min",
        "{rider_first_name} is bringing your {item} from {store}. Please keep your phone close.",
        "Out for delivery with {rider_first_name}", "rider",
    ),
    "payment.delivery_fee_due": EventSpec(
        "action", "Fee must be paid before dispatch", "payment_due",
        "Delivery fee due: KES {fee_kes}",
        "Pay the fee so we can dispatch your {item} from {store}.",
        "Delivery fee of KES {fee_kes} due", "payment",
    ),
    "parcel.delayed": EventSpec(
        "action", "ETA slipped", "delayed",
        "Your {item} is running late",
        "New estimate: about {eta_minutes} min. Sorry for the wait.",
        "Delayed, new ETA about {eta_minutes} min", "clock",
    ),
    "address.confirmation_needed": EventSpec(
        "critical", "Rider cannot proceed without it", "needs_address",
        "Please confirm your delivery address",
        "{rider_first_name} cannot continue with your {item} until you confirm where to deliver.",
        "Address confirmation needed", "location",
    ),
    "parcel.delivery_failed": EventSpec(
        "critical", "Customer must reschedule", "failed",
        "We could not deliver your {item}",
        "Pick a new delivery time for your parcel from {store}.",
        "Delivery attempt failed", "alert",
    ),
    "parcel.delivered": EventSpec(
        "info", "Done", "delivered",
        "Your {item} has arrived",
        "Delivered from {store}. Enjoy!",
        "Delivered", "delivered",
    ),
}

_DEFAULTS = {
    "store": "the store",
    "item": "parcel",
    "rider_first_name": "Your rider",
    "eta_minutes": "a few",
    "fee_kes": "",
}


class _SafeDict(dict):
    def __missing__(self, key: str) -> str:
        return _DEFAULTS.get(key, "")


def _fill(template: str, payload: dict[str, Any]) -> str:
    values = _SafeDict({k: v for k, v in payload.items() if v is not None})
    text = template.format_map(values)
    return re.sub(r"\s{2,}", " ", text).strip()


def clip(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    return text[: limit - 1].rstrip(" ,.;:") + "…"


def timeline_label(event_type: str, payload: dict[str, Any]) -> str:
    spec = CATALOGUE.get(event_type)
    return _fill(spec.timeline, payload) if spec else event_type


def render_template(event: Event) -> tuple[str, str]:
    """Deterministic, always-valid wording for any event (including a digest)."""
    if event.type == "digest":
        updates = event.payload.get("updates", [])
        title = f"{len(updates)} updates on your parcels"
        parts = []
        for u in updates:
            label = timeline_label(u.get("type", ""), u)
            parts.append(f"{u.get('item', 'Parcel')}: {label[:1].lower()}{label[1:]}")
        body = "; ".join(parts) + "."
        return clip(title, TITLE_MAX), clip(body, BODY_MAX)

    spec = CATALOGUE[event.type]
    return clip(_fill(spec.title, event.payload), TITLE_MAX), clip(_fill(spec.body, event.payload), BODY_MAX)


def default_icon(event: Event) -> IconName:
    """Catalogue icon for an event. A digest takes the icon of its most urgent update."""
    if event.type == "digest":
        specs = [CATALOGUE[u["type"]] for u in event.payload.get("updates", []) if u.get("type") in CATALOGUE]
        if not specs:
            return "bell"
        return max(specs, key=lambda s: PRIORITY_RANK[s.priority]).icon
    spec = CATALOGUE.get(event.type)
    return spec.icon if spec else "bell"


def catalogue_listing() -> list[dict[str, str]]:
    return [{"type": t, "priority": s.priority, "meaning": s.meaning} for t, s in CATALOGUE.items()]
