import os
from pathlib import Path

import pytest
import requests
from dotenv import dotenv_values


def _load_env_value(file_path: str, key: str) -> str | None:
    values = dotenv_values(file_path)
    value = values.get(key)
    return str(value).strip() if value is not None else None


@pytest.fixture(scope="session")
def base_url() -> str:
    url = _load_env_value("/app/frontend/.env", "REACT_APP_BACKEND_URL")
    if not url:
        pytest.fail("REACT_APP_BACKEND_URL is missing in /app/frontend/.env")
    return url.rstrip("/")


@pytest.fixture(scope="session")
def origin() -> str:
    frontend = _load_env_value("/app/backend/.env", "FRONTEND_URL")
    if not frontend:
        pytest.fail("FRONTEND_URL is missing in /app/backend/.env")
    return frontend.rstrip("/")


@pytest.fixture(scope="session")
def owner_credentials() -> dict:
    # Auth test account from credentials memory file
    return {
        "email": _load_env_value("/app/backend/.env", "ADMIN_EMAIL"),
        "password": _load_env_value("/app/backend/.env", "ADMIN_PASSWORD"),
    }


@pytest.fixture
def api_client() -> requests.Session:
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture
def owner_session(api_client: requests.Session, base_url: str, origin: str, owner_credentials: dict) -> requests.Session:
    response = api_client.post(
        f"{base_url}/api/auth/login",
        json=owner_credentials,
        headers={"Origin": origin},
        timeout=30,
    )
    assert response.status_code == 200, response.text
    api_client.headers.update({"Origin": origin})
    return api_client
