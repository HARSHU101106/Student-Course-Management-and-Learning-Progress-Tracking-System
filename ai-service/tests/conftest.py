import pytest
from fastapi.testclient import TestClient

from app.config import Settings
from app.main import create_app
from app.services.llm import OfflineLLM
from app.services.store import MemoryStore

TOKEN = "test-service-token-0123456789abcdef"
HEADERS = {"Authorization": f"Bearer {TOKEN}"}

LESSONS = [
    {"id": "l1", "title": "B+ trees on Disks", "order": 1, "topics": ["Indexing"],
     "text": "B+ trees are the standard disk-based index. They are balanced, so every lookup traverses the same number of levels. "
             "Each node is sized to fit a disk block so the fan-out is large and the tree is shallow. "
             "All data pointers live in the leaf nodes, which are linked in order, making range scans efficient."},
    {"id": "l2", "title": "ACID properties and operations in transactions", "order": 2, "topics": ["Transactions"],
     "text": "A transaction is a unit of work that must succeed or fail as a whole. "
             "Atomicity means all or nothing. Consistency moves the database from one valid state to another. "
             "Isolation makes concurrent transactions behave as if run serially. Durability means committed changes survive crashes."},
    {"id": "l3", "title": "Aggregate functions", "order": 3, "topics": ["SQL"],
     "text": "Aggregates summarise many rows into one value: COUNT, SUM, AVG, MIN and MAX. "
             "GROUP BY splits rows into groups and applies the aggregate to each group. "
             "WHERE filters rows before grouping, whereas HAVING filters groups after aggregation."},
]


@pytest.fixture
def settings():
    return Settings(environment="test", ai_service_token=TOKEN, _env_file=None)


@pytest.fixture
def app(settings):
    return create_app(settings, MemoryStore(), OfflineLLM())


@pytest.fixture
def client(app):
    with TestClient(app) as c:
        yield c


@pytest.fixture
def indexed(client):
    response = client.post("/v1/ingest", json={"courseId": "c1", "lessons": LESSONS}, headers=HEADERS)
    assert response.status_code == 200, response.text
    return client


class FakeLLM:
    """Scriptable stand-in for a hosted model. Records every prompt it receives."""

    available = True
    name = "fake:model"

    def __init__(self, reply="", error=None):
        self.reply = reply
        self.error = error
        self.calls = []

    async def complete(self, system, user, *, json_mode=False, max_tokens=600):
        self.calls.append({"system": system, "user": user, "json_mode": json_mode})
        if self.error:
            raise self.error
        return self.reply(user) if callable(self.reply) else self.reply


@pytest.fixture
def make_client(settings):
    """Build a client with a custom LLM; returns (client, llm)."""
    clients = []

    def factory(llm):
        client = TestClient(create_app(settings, MemoryStore(), llm))
        client.__enter__()
        clients.append(client)
        response = client.post("/v1/ingest", json={"courseId": "c1", "lessons": LESSONS}, headers=HEADERS)
        assert response.status_code == 200
        return client

    yield factory
    for client in clients:
        client.__exit__(None, None, None)
