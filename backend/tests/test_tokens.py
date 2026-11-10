"""Token stores. Firestore is replaced by a small in-memory fake (no credentials needed)."""

import asyncio

from app.tokens import MAX_TOKENS_PER_USER, FirestoreTokenStore, MemoryTokenStore, doc_id


class FakeDoc:
    def __init__(self, data):
        self._data = data

    def to_dict(self):
        return dict(self._data)


class FakeDocRef:
    def __init__(self, store, id_):
        self._store, self._id = store, id_

    def set(self, data):
        self._store.check()
        self._store.docs[self._id] = dict(data)

    def delete(self):
        self._store.check()
        self._store.docs.pop(self._id, None)


class FakeQuery:
    def __init__(self, store, f):
        self._store, self._f = store, f

    def stream(self):
        self._store.check()
        self._store.queries += 1
        assert self._f.op_string == "=="
        return [FakeDoc(d) for d in self._store.docs.values() if d.get(self._f.field_path) == self._f.value]


class FakeCollection:
    def __init__(self, store):
        self._store = store

    def document(self, id_):
        return FakeDocRef(self._store, id_)

    def where(self, *, filter):
        return FakeQuery(self._store, filter)


class FakeFirestore:
    """Plays the Firestore client. `docs` is the database and outlives any one store (a restart)."""

    def __init__(self):
        self.docs: dict[str, dict] = {}
        self.failing = False
        self.queries = 0

    def check(self):
        if self.failing:
            raise RuntimeError("firestore down")

    def collection(self, name):
        assert name == "fcm_tokens"
        return FakeCollection(self)


def tok(n: int) -> str:
    return f"token-{n:04d}-" + "x" * 30


def run(coro):
    return asyncio.run(coro)


def store_for(db: FakeFirestore) -> FirestoreTokenStore:
    return FirestoreTokenStore("demo", client_factory=lambda: db)


def test_tokens_survive_a_restart():
    db = FakeFirestore()
    run(store_for(db).add("u_amani", tok(1)))
    assert db.docs[doc_id(tok(1))]["user_id"] == "u_amani"
    assert "expires_at" in db.docs[doc_id(tok(1))]

    db.queries = 0
    fresh = store_for(db)  # new process, empty memory
    assert run(fresh.for_user("u_amani")) == [tok(1)]
    run(fresh.for_user("u_amani"))
    assert db.queries == 1  # loaded once, then served from memory


def test_token_moves_to_new_persona():
    db = FakeFirestore()
    s = store_for(db)

    async def go():
        await s.add("u_amani", tok(1))
        await s.add("u_wanjiru", tok(1))
        return await s.for_user("u_amani"), await s.for_user("u_wanjiru")

    assert run(go()) == ([], [tok(1)])
    assert db.docs[doc_id(tok(1))]["user_id"] == "u_wanjiru"
    assert run(store_for(db).for_user("u_amani")) == []


def test_cap_evicts_oldest_everywhere():
    db = FakeFirestore()
    s = store_for(db)

    async def go():
        for i in range(MAX_TOKENS_PER_USER + 2):
            await s.add("u_amani", tok(i))
        return await s.for_user("u_amani")

    tokens = run(go())
    assert len(tokens) == MAX_TOKENS_PER_USER
    assert tok(0) not in tokens and tok(1) not in tokens
    assert doc_id(tok(0)) not in db.docs and len(db.docs) == MAX_TOKENS_PER_USER


def test_remove_deletes_document():
    db = FakeFirestore()
    s = store_for(db)
    run(s.add("u_amani", tok(1)))
    run(s.remove(tok(1)))
    assert db.docs == {}
    assert run(s.for_user("u_amani")) == []


def test_firestore_outage_falls_back_to_memory_then_recovers():
    db = FakeFirestore()
    db.failing = True
    s = store_for(db)
    run(s.add("u_amani", tok(1)))
    assert run(s.for_user("u_amani")) == [tok(1)]  # still pushable this process

    db.failing = False
    db.docs[doc_id(tok(2))] = {"user_id": "u_amani", "token": tok(2)}  # registered by an earlier process
    assert run(s.for_user("u_amani")) == [tok(1), tok(2)]  # load retried once Firestore is back


def test_client_init_failure_is_memory_only():
    def boom():
        raise RuntimeError("no credentials")

    s = FirestoreTokenStore("demo", client_factory=boom)
    run(s.add("u_amani", tok(1)))
    assert run(s.for_user("u_amani")) == [tok(1)]


def test_memory_store_rules():
    s = MemoryTokenStore()

    async def go():
        await s.add("a", tok(1))
        await s.add("b", tok(1))
        return await s.for_user("a"), await s.for_user("b")

    assert run(go()) == ([], [tok(1)])
