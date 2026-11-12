"""Pydantic models: events carry facts, decisions carry routing, messages carry words."""

from __future__ import annotations

import secrets
from datetime import datetime, timezone
from typing import Annotated, Any, Literal, get_args

from pydantic import BaseModel, Field, StringConstraints, field_validator

Priority = Literal["info", "action", "critical"]
View = Literal["home", "orders_list", "parcel_detail", "payment"]
Action = Literal["inline", "toast", "push", "inbox_only"]

# Notification icons (rendered with Hugeicons on the web; see web/src/lib/icons.tsx).
# A fixed allowlist: the model may pick one, but can never emit anything else.
IconName = Literal[
    "package", "store", "warehouse", "truck", "rider", "clock",
    "location", "alert", "delivered", "payment", "cancel", "bell",
]
ICON_NAMES: tuple[str, ...] = get_args(IconName)

PARCEL_ID_PATTERN = r"^SHP-\d{5}$"
CLIENT_ID_PATTERN = r"^[A-Za-z0-9_-]{6,64}$"

PRIORITY_RANK: dict[str, int] = {"info": 0, "action": 1, "critical": 2}


def new_id(prefix: str) -> str:
    return f"{prefix}_{secrets.token_hex(4)}"


def utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


# ---------------------------------------------------------------- events


class Event(BaseModel):
    event_id: str
    type: str
    occurred_at: str
    user_id: str
    priority: Priority
    payload: dict[str, Any]

    @property
    def parcel_id(self) -> str | None:
        value = self.payload.get("parcel_id")
        return value if isinstance(value, str) else None


# Only short UI tokens such as "opened_parcel:SHP-48213" or "tapped:track_rider".
# No free text, so nothing personal can leak into the Gemini prompt.
RecentAction = Annotated[str, StringConstraints(pattern=r"^[a-z_]{1,32}(:[A-Za-z0-9_-]{1,32})?$")]


class Context(BaseModel):
    """UI state only. This is sent to Gemini, so it must never hold free text or PII."""

    view: View = "home"
    parcel_id: str | None = Field(default=None, pattern=PARCEL_ID_PATTERN)
    visible: bool = False
    locale: str = Field(default="en-KE", pattern=r"^[a-z]{2}(-[A-Z]{2})?$")
    local_hour: int | None = Field(default=None, ge=0, le=23)
    recent_actions: list[RecentAction] = Field(default_factory=list, max_length=10)


class SessionState(BaseModel):
    connection_count: int = 0
    visible: bool = False
    view: View | None = None
    parcel_id: str | None = None
    last_seen: str | None = None


class Decision(BaseModel):
    action: Action
    sticky: bool = False
    also_inbox: bool = False
    urgency: Literal["normal", "high"] = "normal"
    # Toast on the device being looked at, and also push to the user's other devices.
    also_push: bool = False
    reason: str


class Message(BaseModel):
    title: str
    body: str
    icon: IconName = "bell"
    source: Literal["gemini", "template", "cache"]
    latency_ms: int | None = None
    fallback_reason: str | None = None


class ChannelResult(BaseModel):
    channel: Literal["sse", "fcm", "inbox", "inline"]
    status: str
    detail: str | None = None


class InboxItem(BaseModel):
    event_id: str
    title: str
    body: str
    priority: Priority
    icon: IconName = "bell"
    parcel_id: str | None = None
    created_at: str
    read: bool = False


class TimelineEntry(BaseModel):
    event_id: str
    type: str
    label: str
    at: str


class Parcel(BaseModel):
    parcel_id: str
    user_id: str
    store: str
    item: str
    status: str
    eta_minutes: int | None = None
    rider_first_name: str | None = None
    fee_kes: int | None = None
    timeline: list[TimelineEntry] = Field(default_factory=list)


class Delivery(BaseModel):
    """Everything that happened to one event (or one coalesced burst). Feeds the Channel Inspector."""

    id: str
    kind: Literal["single", "digest"]
    user_id: str
    priority: Priority
    events: list[Event]
    session: SessionState
    context: Context
    decision: Decision
    message: Message | None = None
    channels: list[ChannelResult] = Field(default_factory=list)
    parcels: list[Parcel] = Field(default_factory=list)
    inbox_item: InboxItem | None = None
    created_at: str


# ---------------------------------------------------------------- requests

PayloadValue = str | int | float | bool | None


class EmitRequest(BaseModel):
    type: str
    user_id: str
    parcel_id: str | None = Field(default=None, pattern=PARCEL_ID_PATTERN)
    payload: dict[str, PayloadValue] | None = None

    @field_validator("payload")
    @classmethod
    def _small_payload(cls, value: dict[str, PayloadValue] | None) -> dict[str, PayloadValue] | None:
        if value is None:
            return value
        if len(value) > 12:
            raise ValueError("payload has too many fields")
        for key, item in value.items():
            if len(key) > 40:
                raise ValueError("payload key too long")
            if isinstance(item, str) and len(item) > 80:
                raise ValueError(f"payload.{key} too long")
        return value


class ContextUpdate(BaseModel):
    user_id: str
    client_id: str = Field(pattern=CLIENT_ID_PATTERN)
    # One id per browser (localStorage), shared by its tabs and its FCM token.
    device_id: str | None = Field(default=None, pattern=CLIENT_ID_PATTERN)
    context: Context


class DeviceRegistration(BaseModel):
    user_id: str
    token: str = Field(min_length=20, max_length=4096)
    device_id: str | None = Field(default=None, pattern=CLIENT_ID_PATTERN)


class DeviceRef(BaseModel):
    token: str = Field(min_length=20, max_length=4096)


class UserRef(BaseModel):
    user_id: str


class SwitchesUpdate(BaseModel):
    enrich_mode: Literal["gemini", "template"] | None = None
    simulate_gemini_failure: bool | None = None
    coalesce: bool | None = None


class BurstRequest(BaseModel):
    user_id: str
