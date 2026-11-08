"""Enrichment: validation, fallback paths and golden cases.

The live golden test calls Gemini and only runs when GEMINI_API_KEY is set.
"""

import asyncio
import json
import os

import pytest

from app.catalogue import BODY_MAX, CATALOGUE, TITLE_MAX, default_icon, render_template
from app.config import switches
from app.enrich import Enricher, EnrichmentError, build_prompt, make_gemini_generate, validate_output
from app.models import ICON_NAMES, Context, Event
from app.parcels import ParcelStore

CONTEXTS = {
    "orders_list": Context(view="orders_list", visible=True, locale="en-KE", local_hour=14),
    "home": Context(view="home", visible=True, locale="en-KE", local_hour=9),
    "away": Context(view="payment", visible=False, locale="en-KE", local_hour=18),
}


def make_event(event_type: str) -> Event:
    store = ParcelStore()
    parcel = store.get("SHP-48213", "u_amani")
    return Event(
        event_id="evt_test",
        type=event_type,
        occurred_at="2026-11-08T14:05:00Z",
        user_id="u_amani",
        priority=CATALOGUE[event_type].priority,
        payload=store.default_payload(event_type, parcel),
    )


@pytest.fixture(autouse=True)
def reset_switches():
    switches.enrich_mode = "gemini"
    switches.simulate_gemini_failure = False
    yield
    switches.enrich_mode = "gemini"
    switches.simulate_gemini_failure = False


def run(coro):
    return asyncio.run(coro)


def fake(response, delay: float = 0.0):
    calls = []

    async def generate(system: str, user: str) -> str:
        calls.append(user)
        await asyncio.sleep(delay)
        if isinstance(response, Exception):
            raise response
        return response

    generate.calls = calls
    return generate


# ---------------------------------------------------------------- templates


@pytest.mark.parametrize("event_type", list(CATALOGUE))
@pytest.mark.parametrize("ctx", list(CONTEXTS))
def test_every_template_passes_the_same_rules_as_the_model(event_type, ctx):
    event = make_event(event_type)
    title, body = render_template(event)
    prompt = build_prompt(event, CONTEXTS[ctx])
    assert validate_output(json.dumps({"title": title, "body": body}), prompt)[:2] == (title, body)
    assert "{" not in title + body
    assert default_icon(event) in ICON_NAMES


# ---------------------------------------------------------------- validator


def test_rejects_invented_numbers():
    prompt = build_prompt(make_event("parcel.out_for_delivery"), CONTEXTS["home"])
    with pytest.raises(EnrichmentError, match="invented_numbers"):
        validate_output(json.dumps({"title": "Arriving in 10 min", "body": "Joseph is close."}), prompt)


def test_accepts_numbers_from_the_facts():
    prompt = build_prompt(make_event("parcel.out_for_delivery"), CONTEXTS["home"])
    assert validate_output(json.dumps({"title": "Arriving in 25 min", "body": "Joseph is on the way."}), prompt)


@pytest.mark.parametrize(
    "raw, reason",
    [
        ("not json", "invalid_json"),
        ("[1, 2]", "invalid_json"),
        (json.dumps({"title": "Hi"}), "missing_fields"),
        (json.dumps({"title": " ", "body": "x"}), "empty_output"),
        (json.dumps({"title": "x" * (TITLE_MAX + 1), "body": "ok"}), "too_long"),
        (json.dumps({"title": "ok", "body": "x" * (BODY_MAX + 1)}), "too_long"),
        (json.dumps({"title": "On its way \U0001F69A", "body": "ok"}), "emoji"),
    ],
)
def test_rejects_bad_output(raw, reason):
    with pytest.raises(EnrichmentError) as exc:
        validate_output(raw, "{}")
    assert exc.value.reason == reason


# ---------------------------------------------------------------- enricher paths

GOOD = json.dumps(
    {"title": "Joseph is 25 min away", "body": "Your Running shoes from Kilimani Kicks are coming.", "icon": "truck"}
)


def test_success_then_cache():
    gen = fake(GOOD)
    enricher = Enricher(gen, timeout_s=1.0)
    event = make_event("parcel.out_for_delivery")
    first = run(enricher.enrich(event, CONTEXTS["home"]))
    second = run(enricher.enrich(event, CONTEXTS["home"]))
    assert first.source == "gemini" and first.title == "Joseph is 25 min away"
    assert first.icon == "truck"
    assert second.source == "cache" and second.title == first.title and second.icon == "truck"
    assert len(gen.calls) == 1


@pytest.mark.parametrize("icon", [None, "rocket", "\U0001F69A", 7])
def test_bad_icon_keeps_wording_but_uses_catalogue_icon(icon):
    raw = {"title": "Joseph is 25 min away", "body": "Your shoes are coming."}
    if icon is not None:
        raw["icon"] = icon
    message = run(Enricher(fake(json.dumps(raw)), timeout_s=1.0).enrich(make_event("parcel.out_for_delivery"), CONTEXTS["home"]))
    assert message.source == "gemini"
    assert message.icon == CATALOGUE["parcel.out_for_delivery"].icon


def test_template_carries_catalogue_icon():
    switches.enrich_mode = "template"
    message = run(Enricher(None).enrich(make_event("parcel.delivery_failed"), CONTEXTS["home"]))
    assert message.icon == "alert"


def test_digest_icon_is_most_urgent_update():
    event = Event(
        event_id="dig_test", type="digest", occurred_at="", user_id="u_amani", priority="critical",
        payload={"updates": [{"type": "parcel.in_transit"}, {"type": "address.confirmation_needed"}, {"type": "parcel.delayed"}]},
    )
    assert default_icon(event) == "location"


def test_cache_is_keyed_on_view():
    gen = fake(GOOD)
    enricher = Enricher(gen, timeout_s=1.0)
    event = make_event("parcel.out_for_delivery")
    run(enricher.enrich(event, CONTEXTS["home"]))
    run(enricher.enrich(event, CONTEXTS["orders_list"]))
    assert len(gen.calls) == 2


@pytest.mark.parametrize(
    "generate, reason",
    [
        (fake(GOOD, delay=0.5), "timeout"),
        (fake("{oops"), "invalid_json"),
        (fake(json.dumps({"title": "x" * 80, "body": "y"})), "too_long"),
        (fake(json.dumps({"title": "Arriving in 3 min", "body": "Soon."})), "invented_numbers:3"),
        (fake(RuntimeError("quota")), "error:RuntimeError"),
    ],
)
def test_failures_fall_back_to_template(generate, reason):
    event = make_event("parcel.out_for_delivery")
    message = run(Enricher(generate, timeout_s=0.1).enrich(event, CONTEXTS["home"]))
    assert message.source == "template"
    assert message.fallback_reason == reason
    assert (message.title, message.body) == render_template(event)


def test_kill_switch_skips_the_model():
    gen = fake(GOOD)
    switches.enrich_mode = "template"
    message = run(Enricher(gen).enrich(make_event("parcel.delayed"), CONTEXTS["home"]))
    assert message.source == "template" and message.fallback_reason == "kill_switch"
    assert gen.calls == []


def test_simulated_failure_hits_the_real_timeout_guard():
    switches.simulate_gemini_failure = True
    message = run(Enricher(fake(GOOD), timeout_s=0.1).enrich(make_event("parcel.delayed"), CONTEXTS["home"]))
    assert message.fallback_reason == "timeout"


def test_not_configured_uses_template():
    message = run(Enricher(None).enrich(make_event("parcel.delivered"), CONTEXTS["home"]))
    assert message.fallback_reason == "gemini_not_configured"


def test_prompt_contains_no_identifiers():
    prompt = build_prompt(make_event("parcel.delivered"), CONTEXTS["home"])
    assert "u_amani" not in prompt and "evt_test" not in prompt


# ---------------------------------------------------------------- live golden cases


@pytest.mark.skipif(not os.getenv("GEMINI_API_KEY"), reason="GEMINI_API_KEY not set")
@pytest.mark.parametrize("event_type", list(CATALOGUE))
@pytest.mark.parametrize("ctx", list(CONTEXTS))
def test_golden_live(event_type, ctx):
    """9 event types x 3 contexts against the real model. Validation is applied inside enrich."""
    generate = make_gemini_generate(
        os.environ["GEMINI_API_KEY"],
        os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
        int(os.getenv("GEMINI_THINKING_BUDGET", "0")) if os.getenv("GEMINI_THINKING_BUDGET", "0") else None,
    )
    timeout = float(os.getenv("GOLDEN_TIMEOUT_S", "5"))
    message = run(Enricher(generate, timeout_s=timeout).enrich(make_event(event_type), CONTEXTS[ctx]))
    assert message.source == "gemini", f"fell back: {message.fallback_reason}"
    assert len(message.title) <= TITLE_MAX and len(message.body) <= BODY_MAX
    assert message.icon in ICON_NAMES
