"""Seed data: every persona has parcels, and together they start in every status."""

from app.catalogue import CATALOGUE
from app.parcels import PERSONAS, ParcelStore


def test_every_persona_has_parcels():
    store = ParcelStore()
    for user_id in PERSONAS:
        assert store.list(user_id), user_id


def test_seed_covers_every_status():
    store = ParcelStore()
    seeded = {p.status for u in PERSONAS for p in store.list(u)}
    assert seeded == {spec.status for spec in CATALOGUE.values()}


def test_seeded_facts_match_status():
    store = ParcelStore()
    for user_id in PERSONAS:
        for p in store.list(user_id):
            if p.status == "payment_due":
                assert p.fee_kes
            if p.status in {"out_for_delivery", "delayed"}:
                assert p.eta_minutes
            if p.status in {"delivered", "failed"}:
                assert p.eta_minutes is None
            # Timeline is in time order and ends with the current status.
            assert [t.at for t in p.timeline] == sorted(t.at for t in p.timeline)
            assert CATALOGUE[p.timeline[-1].type].status == p.status
