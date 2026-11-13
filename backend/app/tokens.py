"""FCM device token storage.

MemoryTokenStore: tokens live in this process and vanish on restart (local runs, tests).
FirestoreTokenStore: the same in-memory map, written through to Firestore and loaded per user
on first use, so tokens survive Cloud Run scaling to zero. Firestore errors are logged and the
in-memory copy keeps push working for the life of the process.
"""

from __future__ import annotations

import asyncio
import hashlib
import logging
import os
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Callable

log = logging.getLogger(__name__)

# The whole audience shares two demo personas, so each persona can hold a room's worth of devices.
# Oldest-refreshed tokens are dropped past this. FCM itself has no per-user device limit.
MAX_TOKENS_PER_USER = int(os.getenv("MAX_TOKENS_PER_USER") or 500)
COLLECTION = "fcm_tokens"
# Firestore TTL policy on `expires_at` deletes tokens nobody has refreshed in this long.
TOKEN_TTL = timedelta(days=60)


class MemoryTokenStore:
    def __init__(self) -> None:
        self._tokens: dict[str, dict[str, float]] = {}  # user_id -> {token: last registered}
        self._devices: dict[str, str] = {}  # token -> device_id (one browser), when the client sent one

    def _add_local(self, user_id: str, token: str, ts: float, device_id: str | None = None) -> list[str]:
        """Add or refresh a token. Returns tokens dropped: the device's older token, or the per-user cap."""
        # A browser token belongs to one persona at a time in this demo.
        for other, tokens in self._tokens.items():
            if other != user_id:
                tokens.pop(token, None)
        replaced: list[str] = []
        if device_id:
            # A browser holds one push subscription. An older token from the same browser would
            # make it ring twice (or not at all once FCM expires it), so the new one replaces it.
            replaced = [t for t, d in self._devices.items() if d == device_id and t != token]
            for old in replaced:
                self._remove_local(old)
            self._devices[token] = device_id
        tokens = self._tokens.setdefault(user_id, {})
        tokens[token] = ts
        evicted = sorted(tokens, key=tokens.__getitem__)[: max(0, len(tokens) - MAX_TOKENS_PER_USER)]
        for old in evicted:
            del tokens[old]
            self._devices.pop(old, None)
        return replaced + evicted

    def _remove_local(self, token: str) -> None:
        for tokens in self._tokens.values():
            tokens.pop(token, None)
        self._devices.pop(token, None)

    async def add(self, user_id: str, token: str, device_id: str | None = None) -> None:
        self._add_local(user_id, token, time.time(), device_id)

    async def remove(self, token: str) -> None:
        self._remove_local(token)

    async def for_user(self, user_id: str) -> list[str]:
        return sorted(self._tokens.get(user_id, {}))

    async def devices_for_user(self, user_id: str) -> dict[str, str | None]:
        """{token: device_id or None} for the user's registered devices."""
        return {t: self._devices.get(t) for t in await self.for_user(user_id)}

    async def clear(self) -> int:
        """Forget every device. Returns how many tokens were dropped."""
        dropped = sum(len(t) for t in self._tokens.values())
        self._tokens.clear()
        self._devices.clear()
        return dropped


def doc_id(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _default_client(project_id: str | None):
    from google.cloud import firestore

    return firestore.Client(project=project_id)


class FirestoreTokenStore(MemoryTokenStore):
    def __init__(self, project_id: str | None, client_factory: Callable[[], Any] | None = None) -> None:
        super().__init__()
        self._factory = client_factory or (lambda: _default_client(project_id))
        self._client = None
        self._client_error: str | None = None
        self._loaded: set[str] = set()
        self._load_lock = asyncio.Lock()

    def _collection(self):
        if self._client is None and self._client_error is None:
            try:
                self._client = self._factory()
            except Exception as exc:
                self._client_error = f"{type(exc).__name__}: {exc}"
                log.error("Firestore client init failed, tokens stay in memory: %s", self._client_error)
        if self._client is None:
            return None
        return self._client.collection(COLLECTION)

    async def _run(self, what: str, fn: Callable[[Any], Any]) -> Any:
        """Run a blocking Firestore call off the event loop. Returns None on any failure."""
        col = await asyncio.to_thread(self._collection)
        if col is None:
            return None
        try:
            return await asyncio.to_thread(fn, col)
        except Exception as exc:
            log.warning("Firestore %s failed, using in-memory tokens: %r", what, exc)
            return None

    async def _ensure_loaded(self, user_id: str) -> None:
        if user_id in self._loaded:
            return
        async with self._load_lock:
            if user_id in self._loaded:
                return

            def query(col):
                from google.cloud.firestore_v1.base_query import FieldFilter

                return [d.to_dict() for d in col.where(filter=FieldFilter("user_id", "==", user_id)).stream()]

            docs = await self._run("load", query)
            if docs is None:
                return  # retry on the next call
            tokens = self._tokens.setdefault(user_id, {})
            for data in docs:
                token, updated = data.get("token"), data.get("updated_at")
                if token and token not in tokens:
                    tokens[token] = updated.timestamp() if isinstance(updated, datetime) else 0.0
                    if data.get("device_id"):
                        self._devices.setdefault(token, data["device_id"])
            self._loaded.add(user_id)

    async def add(self, user_id: str, token: str, device_id: str | None = None) -> None:
        await self._ensure_loaded(user_id)
        now = datetime.now(timezone.utc)
        evicted = self._add_local(user_id, token, now.timestamp(), device_id)

        def write(col):
            # Keyed by token: registering under another persona overwrites the old owner.
            col.document(doc_id(token)).set(
                {
                    "user_id": user_id,
                    "token": token,
                    "device_id": device_id,
                    "updated_at": now,
                    "expires_at": now + TOKEN_TTL,
                }
            )
            for old in evicted:
                col.document(doc_id(old)).delete()

        await self._run("write", write)

    async def remove(self, token: str) -> None:
        self._remove_local(token)
        await self._run("delete", lambda col: col.document(doc_id(token)).delete())

    async def for_user(self, user_id: str) -> list[str]:
        await self._ensure_loaded(user_id)
        return await super().for_user(user_id)

    async def clear(self) -> int:
        dropped = await super().clear()

        def delete_all(col) -> int:
            count = 0
            for doc in col.stream():
                doc.reference.delete()
                count += 1
            return count

        deleted = await self._run("clear", delete_all)
        if deleted is not None:
            # Firestore is empty now, so an empty in-memory map is the full picture for every user.
            self._loaded.clear()
            dropped = max(dropped, deleted)
        return dropped
