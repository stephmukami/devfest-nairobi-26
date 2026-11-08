"""Event -> decision -> words -> channel. Also handles optional burst coalescing."""

from __future__ import annotations

import asyncio
import logging

from .catalogue import CATALOGUE
from .config import switches
from .enrich import Enricher
from .fcm import FcmSender
from .hub import Hub
from .models import (
    PRIORITY_RANK,
    ChannelResult,
    Delivery,
    Event,
    InboxItem,
    Parcel,
    new_id,
    utcnow_iso,
)
from .parcels import ParcelStore
from .router import decide

log = logging.getLogger(__name__)


class Pipeline:
    def __init__(
        self,
        hub: Hub,
        parcels: ParcelStore,
        enricher: Enricher,
        fcm: FcmSender,
        coalesce_window_s: float = 2.0,
    ) -> None:
        self.hub = hub
        self.parcels = parcels
        self.enricher = enricher
        self.fcm = fcm
        self._window = coalesce_window_s
        self._pending: dict[str, list[Event]] = {}
        self._flush_tasks: dict[str, asyncio.Task] = {}

    @staticmethod
    def build_event(event_type: str, user_id: str, payload: dict) -> Event:
        spec = CATALOGUE[event_type]
        return Event(
            event_id=new_id("evt"),
            type=event_type,
            occurred_at=utcnow_iso(),
            user_id=user_id,
            priority=spec.priority,  # from the catalogue, never from the emitter
            payload=payload,
        )

    async def submit(self, event: Event) -> Delivery | None:
        """Process now, or hold for the coalescing window when coalescing is on."""
        if not switches.coalesce:
            return await self.process([event])
        self._pending.setdefault(event.user_id, []).append(event)
        if event.user_id not in self._flush_tasks:
            self._flush_tasks[event.user_id] = asyncio.create_task(self._flush_later(event.user_id))
        return None

    async def _flush_later(self, user_id: str) -> None:
        try:
            await asyncio.sleep(self._window)
        finally:
            events = self._pending.pop(user_id, [])
            self._flush_tasks.pop(user_id, None)
        if events:
            try:
                await self.process(events)
            except Exception:
                log.exception("failed to process coalesced burst for %s", user_id)

    @staticmethod
    def _digest(events: list[Event]) -> Event:
        parcel_ids = {e.parcel_id for e in events}
        priority = max((e.priority for e in events), key=PRIORITY_RANK.__getitem__)
        payload: dict = {
            "count": len(events),
            "updates": [{"type": e.type, **e.payload} for e in events],
        }
        if len(parcel_ids) == 1:
            payload["parcel_id"] = parcel_ids.pop()
        return Event(
            event_id=new_id("dig"),
            type="digest",
            occurred_at=utcnow_iso(),
            user_id=events[0].user_id,
            priority=priority,
            payload=payload,
        )

    async def process(self, events: list[Event]) -> Delivery:
        user_id = events[0].user_id

        updated: dict[str, Parcel] = {}
        for event in events:
            parcel = self.parcels.apply(event)
            if parcel:
                updated[parcel.parcel_id] = parcel

        event = events[0] if len(events) == 1 else self._digest(events)
        session = self.hub.session_state(user_id)
        context = self.hub.enrichment_context(user_id)
        decision = decide(event, session)

        # Rules first: if we are not going to speak, do not spend a model call on words.
        message = None if decision.action == "inline" else await self.enricher.enrich(event, context)

        channels: list[ChannelResult] = []
        tabs = session.connection_count
        if decision.action == "inline":
            channels.append(ChannelResult(channel="inline", status="delivered", detail=f"timeline updated in {tabs} tab(s)"))
        elif decision.action == "toast":
            kind = "sticky toast" if decision.sticky else "toast"
            channels.append(ChannelResult(channel="sse", status="delivered", detail=f"{kind} in {tabs} tab(s)"))
        elif decision.action == "push":
            assert message is not None
            channels.append(await self.fcm.send(user_id, event, message, decision))

        inbox_item = None
        if decision.also_inbox and message is not None:
            inbox_item = InboxItem(
                event_id=event.event_id,
                title=message.title,
                body=message.body,
                priority=event.priority,
                icon=message.icon,
                parcel_id=event.parcel_id,
                created_at=event.occurred_at,
            )
            self.hub.add_inbox(user_id, inbox_item)
            channels.append(ChannelResult(channel="inbox", status="added", detail="badge updated"))

        delivery = Delivery(
            id=event.event_id,
            kind="single" if len(events) == 1 else "digest",
            user_id=user_id,
            priority=event.priority,
            events=events,
            session=session,
            context=context,
            decision=decision,
            message=message,
            channels=channels,
            parcels=list(updated.values()),
            inbox_item=inbox_item,
            created_at=utcnow_iso(),
        )
        self.hub.publish(delivery)
        log.info(
            "delivered %s %s -> %s (%s)",
            delivery.id,
            event.type,
            decision.action,
            message.source if message else "no words",
        )
        return delivery
