"""FCM web push via firebase-admin, using Application Default Credentials."""

from __future__ import annotations

import asyncio
import logging

from .hub import Hub
from .models import ChannelResult, Decision, Event, Message

log = logging.getLogger(__name__)

NO_CREDENTIALS_HINT = (
    "no Google credentials on this machine. Run `gcloud auth application-default login` "
    "and `gcloud auth application-default set-quota-project <project>`, then restart the API"
)


class FcmSender:
    def __init__(self, hub: Hub, enabled: bool, project_id: str | None, public_app_url: str) -> None:
        self._hub = hub
        self._enabled = enabled
        self._project_id = project_id
        self._public_app_url = public_app_url
        self._app = None
        self._init_error: str | None = None

    @property
    def enabled(self) -> bool:
        return self._enabled

    def _ensure_app(self):
        if self._app is not None or self._init_error is not None:
            return self._app
        try:
            import firebase_admin

            options = {"projectId": self._project_id} if self._project_id else None
            try:
                self._app = firebase_admin.get_app()
            except ValueError:
                self._app = firebase_admin.initialize_app(options=options)
        except Exception as exc:
            self._init_error = f"{type(exc).__name__}: {exc}"
            log.error("firebase-admin init failed: %s", self._init_error)
        return self._app

    def deep_link(self, parcel_id: str | None) -> str:
        path = f"/parcels/{parcel_id}" if parcel_id else "/"
        return f"{self._public_app_url}{path}"

    def _build(self, token: str, event: Event, message: Message, decision: Decision):
        from firebase_admin import messaging

        parcel_id = event.parcel_id
        link = self.deep_link(parcel_id)
        critical = decision.urgency == "high"
        return messaging.Message(
            token=token,
            notification=messaging.Notification(title=message.title, body=message.body),
            data={
                "event_id": event.event_id,
                "parcel_id": parcel_id or "",
                "deep_link": link,
                "priority": event.priority,
                "icon": message.icon,  # foreground toasts render it; OS notifications use /icon-192.png
            },
            webpush=messaging.WebpushConfig(
                # Always high on the wire: info events never push, and FCM holds "normal" web pushes
                # while an Android phone is dozing (screen off), so they only show on unlock.
                # The decision's urgency still drives require_interaction below.
                headers={"Urgency": "high", "TTL": "3600"},
                notification=messaging.WebpushNotification(
                    title=message.title,
                    body=message.body,
                    # PNG: Android cannot render SVG notification icons.
                    icon="/icon-192.png",
                    # A newer update for the same parcel replaces the older notification.
                    tag=parcel_id or event.event_id,
                    renotify=True,
                    require_interaction=critical,
                ),
                # FCM only accepts https links; on localhost the service worker handles clicks.
                fcm_options=messaging.WebpushFCMOptions(link=link) if link.startswith("https://") else None,
            ),
        )

    async def send(self, user_id: str, event: Event, message: Message, decision: Decision) -> ChannelResult:
        if not self._enabled:
            return ChannelResult(channel="fcm", status="disabled", detail="FCM_ENABLED is off")
        tokens = await self._hub.tokens(user_id)
        if not tokens:
            return ChannelResult(channel="fcm", status="no_tokens", detail="No device has enabled alerts for this user")
        app = self._ensure_app()
        if app is None:
            return ChannelResult(channel="fcm", status="error", detail=f"firebase-admin unavailable: {self._init_error}")

        from firebase_admin import exceptions, messaging
        from google.auth.exceptions import DefaultCredentialsError

        sent, errors = 0, []
        for token in tokens:
            try:
                await asyncio.to_thread(messaging.send, self._build(token, event, message, decision), app=app)
                sent += 1
            except DefaultCredentialsError:
                # Same for every token, so stop and say how to fix it. On Cloud Run this never happens.
                log.warning("fcm send: no Application Default Credentials on this machine")
                errors.append(NO_CREDENTIALS_HINT)
                break
            except (messaging.UnregisteredError, messaging.SenderIdMismatchError, exceptions.InvalidArgumentError) as exc:
                await self._hub.remove_token(token)
                errors.append(f"removed stale token ({type(exc).__name__})")
            except Exception as exc:
                log.warning("fcm send failed: %r", exc)
                errors.append(f"{type(exc).__name__}: {exc}")

        status = "sent" if sent else "error"
        detail = f"{sent}/{len(tokens)} device(s), Urgency: high"
        if decision.urgency == "high":
            detail += ", sticky"
        if errors:
            detail += "; " + "; ".join(errors)
        return ChannelResult(channel="fcm", status=status, detail=detail)
