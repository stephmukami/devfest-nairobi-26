"""Per-device push: skip the browser showing the toast, replace a browser's old token, expire stale visibility."""

import asyncio

from app import hub as hub_module
from app.hub import Hub
from app.models import Context

PHONE, LAPTOP = "dev_phone01", "dev_laptop1"


def tok(name: str) -> str:
    return f"token-{name}-" + "x" * 30


def run(coro):
    return asyncio.run(coro)


def test_skips_only_the_device_being_looked_at():
    hub = Hub()

    async def go():
        await hub.add_token("u_amani", tok("phone"), PHONE)
        await hub.add_token("u_amani", tok("laptop"), LAPTOP)
        hub.connect("u_amani", "tab_laptop")
        hub.update_context("u_amani", "tab_laptop", Context(visible=True), LAPTOP)
        return await hub.push_tokens("u_amani")

    tokens, skipped = run(go())
    assert tokens == [tok("phone")]
    assert skipped == 1


def test_token_without_device_id_is_always_pushed():
    hub = Hub()

    async def go():
        await hub.add_token("u_amani", tok("legacy"))
        hub.connect("u_amani", "tab_laptop")
        hub.update_context("u_amani", "tab_laptop", Context(visible=True), LAPTOP)
        return await hub.push_tokens("u_amani")

    assert run(go()) == ([tok("legacy")], 0)


def test_new_token_replaces_the_same_browsers_old_one():
    hub = Hub()

    async def go():
        await hub.add_token("u_amani", tok("old"), PHONE)
        await hub.add_token("u_amani", tok("new"), PHONE)
        return await hub.tokens("u_amani")

    assert run(go()) == [tok("new")]


def test_stale_visible_report_counts_as_hidden(monkeypatch):
    hub = Hub()
    hub.connect("u_amani", "tab_phone")
    hub.update_context("u_amani", "tab_phone", Context(visible=True), PHONE)
    assert hub.session_state("u_amani").visible is True

    real_time = hub_module.time.time
    monkeypatch.setattr(hub_module.time, "time", lambda: real_time() + hub_module.VISIBLE_TTL_S + 1)
    assert hub.session_state("u_amani").visible is False
    assert hub.visible_devices("u_amani") == set()
