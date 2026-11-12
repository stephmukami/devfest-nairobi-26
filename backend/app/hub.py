"""In-memory hub: SSE connections, presence, replay buffer and inbox. FCM tokens go through a
token store (tokens.py), which is Firestore-backed in production so they survive restarts.

All other state lives in this process, which is why Cloud Run runs with --max-instances 1.
Production swap: Pub/Sub for fan-out, Firestore or Redis for presence.
"""

from __future__ import annotations

import asyncio
import itertools
import json
import logging
import time
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timezone

from .models import Context, Delivery, InboxItem, SessionState
from .tokens import MemoryTokenStore

log = logging.getLogger(__name__)

MAX_CLIENTS_PER_USER = 20
MAX_INBOX = 100
# A "visible" report older than this counts as hidden. Visible tabs re-report every 20s, so a phone
# that locked or froze the tab without telling us stops blocking push to the user's devices.
VISIBLE_TTL_S = 60.0

QueueItem = tuple[str, str | None, str]  # (sse event name, sse id, json data)


@dataclass(eq=False)
class Connection:
    id: int
    user_id: str
    client_id: str
    observer: bool
    queue: asyncio.Queue[QueueItem] = field(default_factory=lambda: asyncio.Queue(maxsize=256))


@dataclass
class ClientPresence:
    context: Context
    updated_at: float  # wall clock, seconds
    device_id: str | None = None  # the browser this tab runs in

    def seen_now(self, now: float) -> bool:
        return self.context.visible and now - self.updated_at <= VISIBLE_TTL_S


def _iso(ts: float) -> str:
    return datetime.fromtimestamp(ts, timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


class Hub:
    def __init__(self, buffer_size: int = 50, token_store: MemoryTokenStore | None = None) -> None:
        self._ids = itertools.count(1)
        self._buffer_size = buffer_size
        self._conns: dict[str, dict[int, Connection]] = {}
        self._clients: dict[str, dict[str, ClientPresence]] = {}
        self._buffers: dict[str, deque[Delivery]] = {}
        self._inbox: dict[str, list[InboxItem]] = {}
        self._token_store = token_store or MemoryTokenStore()

    # ------------------------------------------------------------ connections

    def connect(self, user_id: str, client_id: str, observer: bool = False) -> Connection:
        conn = Connection(next(self._ids), user_id, client_id, observer)
        self._conns.setdefault(user_id, {})[conn.id] = conn
        log.info("connect user=%s client=%s observer=%s", user_id, client_id, observer)
        if not observer:
            self._broadcast_presence(user_id)
        return conn

    def disconnect(self, conn: Connection) -> None:
        self._conns.get(conn.user_id, {}).pop(conn.id, None)
        log.info("disconnect user=%s client=%s", conn.user_id, conn.client_id)
        if not conn.observer:
            self._broadcast_presence(conn.user_id)

    def _customer_conns(self, user_id: str) -> list[Connection]:
        return [c for c in self._conns.get(user_id, {}).values() if not c.observer]

    def connection_count(self, user_id: str, include_observers: bool = False) -> int:
        if include_observers:
            return len(self._conns.get(user_id, {}))
        return len(self._customer_conns(user_id))

    # ------------------------------------------------------------ presence

    def update_context(self, user_id: str, client_id: str, context: Context, device_id: str | None = None) -> None:
        clients = self._clients.setdefault(user_id, {})
        if client_id not in clients and len(clients) >= MAX_CLIENTS_PER_USER:
            oldest = min(clients, key=lambda cid: clients[cid].updated_at)
            clients.pop(oldest)
        clients[client_id] = ClientPresence(context, time.time(), device_id)
        self._broadcast_presence(user_id)

    def _connected_presences(self, user_id: str) -> list[ClientPresence]:
        clients = self._clients.get(user_id, {})
        seen: set[str] = set()
        result: list[ClientPresence] = []
        for conn in self._customer_conns(user_id):
            if conn.client_id in clients and conn.client_id not in seen:
                seen.add(conn.client_id)
                result.append(clients[conn.client_id])
        return result

    def session_state(self, user_id: str) -> SessionState:
        """Aggregate presence. A connected tab with no context yet counts as hidden (safer: push)."""
        presences = self._connected_presences(user_id)
        now = time.time()
        visible = [p for p in presences if p.seen_now(now)]
        latest_visible = max(visible, key=lambda p: p.updated_at, default=None)
        latest_any = max(presences, key=lambda p: p.updated_at, default=None)
        return SessionState(
            connection_count=len(self._customer_conns(user_id)),
            visible=latest_visible is not None,
            view=latest_visible.context.view if latest_visible else None,
            parcel_id=latest_visible.context.parcel_id if latest_visible else None,
            last_seen=_iso(latest_any.updated_at) if latest_any else None,
        )

    def enrichment_context(self, user_id: str) -> Context:
        """The context to hand Gemini: the visible tab if any, else the last known one."""
        presences = self._connected_presences(user_id)
        now = time.time()
        visible = [p for p in presences if p.seen_now(now)]
        chosen = max(visible, key=lambda p: p.updated_at, default=None)
        if chosen is None:
            everything = list(self._clients.get(user_id, {}).values())
            last = max(everything, key=lambda p: p.updated_at, default=None)
            if last is None:
                return Context(visible=False)
            return last.context.model_copy(update={"visible": False})
        return chosen.context

    def presence_snapshot(self, user_id: str) -> dict:
        clients = self._clients.get(user_id, {})
        connected_ids = {c.client_id for c in self._customer_conns(user_id)}
        return {
            "session": self.session_state(user_id).model_dump(),
            "observers": sum(1 for c in self._conns.get(user_id, {}).values() if c.observer),
            "clients": [
                {
                    "client_id": cid,
                    "connected": cid in connected_ids,
                    "visible": p.seen_now(time.time()),
                    "view": p.context.view,
                    "parcel_id": p.context.parcel_id,
                    "updated_at": _iso(p.updated_at),
                }
                for cid, p in sorted(clients.items(), key=lambda kv: -kv[1].updated_at)
                if cid in connected_ids
            ],
        }

    def _broadcast_presence(self, user_id: str) -> None:
        data = json.dumps(self.presence_snapshot(user_id))
        for conn in list(self._conns.get(user_id, {}).values()):
            self._offer(conn, ("presence", None, data))

    # ------------------------------------------------------------ deliveries

    def publish(self, delivery: Delivery) -> int:
        """Buffer for replay and fan out to every open stream for the user."""
        buffer = self._buffers.setdefault(delivery.user_id, deque(maxlen=self._buffer_size))
        buffer.append(delivery)
        data = delivery.model_dump_json()
        conns = list(self._conns.get(delivery.user_id, {}).values())
        for conn in conns:
            self._offer(conn, ("delivery", delivery.id, data))
        return len(conns)

    def replay(self, user_id: str, last_event_id: str | None) -> list[Delivery]:
        """Deliveries after `last_event_id`. Unknown id (rolled off the buffer) replays everything held."""
        if not last_event_id:
            return []
        buffer = list(self._buffers.get(user_id, ()))
        for index, delivery in enumerate(buffer):
            if delivery.id == last_event_id:
                return buffer[index + 1 :]
        return buffer

    def recent(self, user_id: str) -> list[Delivery]:
        return list(self._buffers.get(user_id, ()))

    @staticmethod
    def _offer(conn: Connection, item: QueueItem) -> None:
        try:
            conn.queue.put_nowait(item)
        except asyncio.QueueFull:
            log.warning("dropping message for slow connection %s; client will replay", conn.id)

    # ------------------------------------------------------------ inbox

    def add_inbox(self, user_id: str, item: InboxItem) -> None:
        items = self._inbox.setdefault(user_id, [])
        items.insert(0, item)
        del items[MAX_INBOX:]

    def inbox(self, user_id: str) -> list[InboxItem]:
        return list(self._inbox.get(user_id, []))

    def mark_inbox_read(self, user_id: str) -> None:
        for item in self._inbox.get(user_id, []):
            item.read = True

    # ------------------------------------------------------------ device tokens

    def visible_devices(self, user_id: str) -> set[str]:
        """Browsers where the user is looking at the app right now (they already got a toast)."""
        now = time.time()
        return {p.device_id for p in self._connected_presences(user_id) if p.device_id and p.seen_now(now)}

    async def add_token(self, user_id: str, token: str, device_id: str | None = None) -> None:
        await self._token_store.add(user_id, token, device_id)

    async def push_tokens(self, user_id: str) -> tuple[list[str], int]:
        """Tokens to push to, skipping devices the user is looking at. Returns (tokens, skipped).
        Tokens registered without a device id are always included: better twice than never."""
        looking = self.visible_devices(user_id)
        devices = await self._token_store.devices_for_user(user_id)
        tokens = [t for t, d in devices.items() if d is None or d not in looking]
        return tokens, len(devices) - len(tokens)

    async def remove_token(self, token: str) -> None:
        await self._token_store.remove(token)

    async def tokens(self, user_id: str) -> list[str]:
        return await self._token_store.for_user(user_id)

    async def clear_tokens(self) -> int:
        return await self._token_store.clear()

    # ------------------------------------------------------------ demo reset

    def reset(self) -> None:
        """Clear history and inbox. Connections, presence and device tokens survive."""
        self._buffers.clear()
        self._inbox.clear()
