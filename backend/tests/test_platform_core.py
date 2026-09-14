import hashlib
from datetime import datetime, timezone

import pytest
from dotenv import dotenv_values
from pymongo import MongoClient


# Authentication and session security behaviors
def test_health_endpoint(base_url, api_client):
    response = api_client.get(f"{base_url}/api/health", timeout=30)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["brand"] == "ORYNVE"


def test_unauthenticated_admin_workspace_returns_401(base_url, api_client):
    response = api_client.get(f"{base_url}/api/admin/workspace", timeout=30)
    assert response.status_code == 401
    assert "sign in" in response.json().get("detail", "").lower()


def test_login_rejects_wrong_origin(base_url, api_client, owner_credentials):
    response = api_client.post(
        f"{base_url}/api/auth/login",
        json=owner_credentials,
        headers={"Origin": "https://evil.example"},
        timeout=30,
    )
    assert response.status_code == 403
    assert "origin" in response.json().get("detail", "").lower()


def test_login_wrong_password_401(base_url, api_client, origin, owner_credentials):
    response = api_client.post(
        f"{base_url}/api/auth/login",
        json={"email": owner_credentials["email"], "password": "wrong-pass-123"},
        headers={"Origin": origin},
        timeout=30,
    )
    assert response.status_code == 401
    assert "incorrect" in response.json().get("detail", "").lower()


def test_login_sets_secure_http_only_cookies(base_url, api_client, origin, owner_credentials):
    response = api_client.post(
        f"{base_url}/api/auth/login",
        json=owner_credentials,
        headers={"Origin": origin},
        timeout=30,
    )
    assert response.status_code == 200
    set_cookie = response.headers.get("set-cookie", "")
    assert "access_token=" in set_cookie
    assert "refresh_token=" in set_cookie
    assert "HttpOnly" in set_cookie
    assert "Secure" in set_cookie
    assert "samesite=none" in set_cookie.lower()


def test_auth_me_excludes_password_hash(base_url, owner_session):
    response = owner_session.get(f"{base_url}/api/auth/me", timeout=30)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "owner@orynve.com"
    assert "password_hash" not in data


def test_refresh_then_logout_revokes_session(base_url, owner_session, origin):
    refresh = owner_session.post(f"{base_url}/api/auth/refresh", headers={"Origin": origin}, timeout=30)
    assert refresh.status_code == 200
    refreshed = refresh.json()
    assert refreshed["email"] == "owner@orynve.com"

    logout = owner_session.post(f"{base_url}/api/auth/logout", headers={"Origin": origin}, timeout=30)
    assert logout.status_code == 200
    assert logout.json().get("success") is True

    post_logout_refresh = owner_session.post(f"{base_url}/api/auth/refresh", headers={"Origin": origin}, timeout=30)
    assert post_logout_refresh.status_code == 401


def test_bruteforce_lockout_after_5_failures(base_url, api_client, origin):
    email = f"lockout-test-{int(datetime.now(timezone.utc).timestamp() * 1000)}@orynve.com"
    for _ in range(5):
        response = api_client.post(
            f"{base_url}/api/auth/login",
            json={"email": email, "password": "bad-password"},
            headers={"Origin": origin},
            timeout=30,
        )
        assert response.status_code == 401

    locked = api_client.post(
        f"{base_url}/api/auth/login",
        json={"email": email, "password": "bad-password"},
        headers={"Origin": origin},
        timeout=30,
    )
    assert locked.status_code == 429
    assert "too many attempts" in locked.json().get("detail", "").lower()


# CMS draft/publish and storefront consistency
def test_storefront_seeded_data(base_url, api_client):
    response = api_client.get(f"{base_url}/api/store", timeout=30)
    assert response.status_code == 200
    data = response.json()
    store = data["store"]
    assert data["preview"] is False
    assert len(store["products"]) == 6
    p001 = next(p for p in store["products"] if p["id"] == "p001")
    stock = {s["name"]: s["stock"] for s in p001["sizes"]}
    assert stock == {"XS": 0, "S": 6, "M": 10, "L": 3, "XL": 5, "XXL": 0}


def test_draft_save_does_not_change_public_until_publish(base_url, owner_session):
    workspace = owner_session.get(f"{base_url}/api/admin/workspace", timeout=30)
    assert workspace.status_code == 200
    ws = workspace.json()
    version = ws["version"]
    original_headline = ws["store"]["hero"]["headline"]
    temp_headline = "TEST DRAFT HEADLINE"

    modified = ws["store"]
    modified["hero"]["headline"] = temp_headline

    save = owner_session.put(
        f"{base_url}/api/admin/workspace",
        json={"store": modified, "version": version},
        timeout=30,
    )
    if save.status_code == 409:
        refreshed = owner_session.get(f"{base_url}/api/admin/workspace", timeout=30).json()
        retry_store = refreshed["store"]
        retry_store["hero"]["headline"] = temp_headline
        save = owner_session.put(
            f"{base_url}/api/admin/workspace",
            json={"store": retry_store, "version": refreshed["version"]},
            timeout=30,
        )
    assert save.status_code == 200

    public_store = owner_session.get(f"{base_url}/api/store", timeout=30).json()["store"]
    assert public_store["hero"]["headline"] != temp_headline

    # restore draft snapshot to avoid permanent test pollution
    fresh_ws = owner_session.get(f"{base_url}/api/admin/workspace", timeout=30).json()
    restore = fresh_ws["store"]
    restore["hero"]["headline"] = original_headline
    restore_resp = owner_session.put(
        f"{base_url}/api/admin/workspace",
        json={"store": restore, "version": fresh_ws["version"]},
        timeout=30,
    )
    if restore_resp.status_code == 409:
        latest_ws = owner_session.get(f"{base_url}/api/admin/workspace", timeout=30).json()
        latest_store = latest_ws["store"]
        latest_store["hero"]["headline"] = original_headline
        restore_resp = owner_session.put(
            f"{base_url}/api/admin/workspace",
            json={"store": latest_store, "version": latest_ws["version"]},
            timeout=30,
        )
    assert restore_resp.status_code == 200


# Commerce inquiry and data persistence behaviors
def test_order_prepare_without_whatsapp_number_persists_inquiry(base_url, api_client):
    payload = {
        "items": [{"product_id": "p001", "size": "S", "color": "Sand", "quantity": 2}],
        "currency": "USD",
        "notes": "Testing prepare endpoint",
    }
    response = api_client.post(f"{base_url}/api/orders/prepare", json=payload, timeout=30)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "prepared"
    assert data["currency"] == "USD"
    assert data["total"] == 145.96
    assert data["whatsapp_url"] is None
    assert "Reference:" in data["summary"]


def test_order_prepare_rejects_out_of_stock_quantity(base_url, api_client):
    payload = {
        "items": [{"product_id": "p001", "size": "L", "color": "Sand", "quantity": 4}],
        "currency": "BDT",
    }
    response = api_client.post(f"{base_url}/api/orders/prepare", json=payload, timeout=30)
    assert response.status_code == 409
    assert "only 3 available" in response.json().get("detail", "").lower()


def test_newsletter_and_contact_persist_and_visible_in_admin(base_url, api_client, owner_session):
    unique = str(int(datetime.now(timezone.utc).timestamp() * 1000))
    newsletter_email = f"qa-newsletter-{unique}@orynve.com"
    contact_email = f"qa-contact-{unique}@orynve.com"

    subscribe = api_client.post(
        f"{base_url}/api/newsletter",
        json={"email": newsletter_email},
        timeout=30,
    )
    assert subscribe.status_code == 200
    assert subscribe.json().get("success") is True

    contact = api_client.post(
        f"{base_url}/api/contact",
        json={
            "name": "QA Agent",
            "email": contact_email,
            "message": "Testing contact persistence with a valid message body.",
            "website": "",
        },
        timeout=30,
    )
    assert contact.status_code == 200
    assert contact.json().get("success") is True

    activity = owner_session.get(f"{base_url}/api/admin/activity", timeout=30)
    assert activity.status_code == 200
    activity_data = activity.json()
    assert any(x["email"] == newsletter_email.lower() for x in activity_data["subscribers"])
    assert any(x["email"] == contact_email for x in activity_data["contacts"])


# Technical SEO/public metadata checks
def test_sitemap_and_robots(base_url, api_client):
    sitemap = api_client.get(f"{base_url}/api/sitemap.xml", timeout=30)
    assert sitemap.status_code == 200
    assert "<urlset" in sitemap.text
    assert "/product/the-form-overcoat" in sitemap.text

    robots = api_client.get(f"{base_url}/api/robots.txt", timeout=30)
    assert robots.status_code == 200
    assert "Disallow: /admin" in robots.text
    assert "Sitemap:" in robots.text


# Auth seed integrity checks from DB documents
def test_seeded_admin_hash_prefix_2b():
    env = dotenv_values("/app/backend/.env")
    mongo_url = str(env["MONGO_URL"]).strip('"')
    db_name = str(env["DB_NAME"]).strip('"')
    admin_email = str(env["ADMIN_EMAIL"]).strip('"').lower()

    client = MongoClient(mongo_url)
    doc = client[db_name].users.find_one({"email": admin_email})
    assert doc is not None
    assert doc["password_hash"].startswith("$2b$")


@pytest.fixture(autouse=True)
def cleanup_lockout_records():
    # prevent lockout data from affecting future test runs
    yield
    env = dotenv_values("/app/backend/.env")
    mongo_url = str(env["MONGO_URL"]).strip('"')
    db_name = str(env["DB_NAME"]).strip('"')
    identifier = hashlib.sha256("127.0.0.1:lockout-test@orynve.com".encode()).hexdigest()
    client = MongoClient(mongo_url)
    client[db_name].login_attempts.delete_one({"identifier": identifier})
