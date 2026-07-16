"""
Pytest fixtures shared across all test modules.

Key design decisions:
- Uses FastAPI's dependency_overrides to inject a fresh NullPool SQLAlchemy
  engine per test. NullPool means connections are never cached across event
  loops, eliminating the "Future attached to a different loop" asyncpg error.
- Each test gets a unique test user via random email, so tests are fully
  isolated with no shared state in the database.
"""

import uuid
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.pool import NullPool
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from typing import AsyncGenerator

from app.main import app
from app.db.session import get_db, Base
from app.core.config import settings

BASE_URL = "http://test"


async def _get_test_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency override for get_db that uses NullPool so no connections
    are shared between event loops (one per test in asyncio_mode=auto).
    """
    engine = create_async_engine(settings.DATABASE_URL, poolclass=NullPool)
    factory = async_sessionmaker(bind=engine, class_=AsyncSession, expire_on_commit=False)
    async with factory() as session:
        try:
            yield session
        finally:
            await session.close()
    await engine.dispose()


@pytest.fixture(autouse=True)
def override_get_db():
    """Auto-applied to every test: swap get_db with the NullPool version."""
    app.dependency_overrides[get_db] = _get_test_db
    yield
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def async_client():
    """Async HTTPX client wired directly to the FastAPI ASGI app."""
    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url=BASE_URL,
    ) as client:
        yield client


def _random_email() -> str:
    return f"test_{uuid.uuid4().hex[:8]}@nairaai-test.com"


@pytest_asyncio.fixture
async def auth_headers(async_client: AsyncClient):
    """
    Register a fresh test user, log in, and return the session cookie header
    so that subsequent requests are authenticated.
    """
    email = _random_email()
    password = "TestPass123!"

    # Register (endpoint returns 200)
    reg_resp = await async_client.post("/auth/register", json={
        "email": email,
        "password": password,
        "full_name": "Test User",
        "monthly_income": 200000.0,
        "consent_given": True,
    })
    assert reg_resp.status_code == 200, f"Registration failed: {reg_resp.text}"

    # Login to get session cookie
    login_resp = await async_client.post("/auth/login", json={
        "email": email,
        "password": password,
    })
    assert login_resp.status_code == 200, f"Login failed: {login_resp.text}"

    # Extract the Set-Cookie header
    set_cookie = login_resp.headers.get("set-cookie", "")
    cookie_value = set_cookie.split(";")[0] if set_cookie else ""

    yield {"Cookie": cookie_value}


@pytest_asyncio.fixture
async def auth_client(async_client: AsyncClient, auth_headers: dict):
    """Convenience fixture: client with auth cookie pre-set."""
    async_client.headers.update(auth_headers)
    yield async_client
