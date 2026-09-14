import copy
import io
from datetime import datetime, timezone

import pytest
from PIL import Image


# CMS regression coverage for preview/publish/revisions/media/toggles/currency
def _workspace(session, base_url):
    response = session.get(f"{base_url}/api/admin/workspace", timeout=30)
    assert response.status_code == 200
    return response.json()


def _save_workspace(session, base_url, store, version):
    response = session.put(
        f"{base_url}/api/admin/workspace",
        json={"store": store, "version": version},
        timeout=30,
    )
    assert response.status_code == 200, response.text
    return response.json()


@pytest.fixture
def restore_site_after_test(owner_session, base_url):
    original_ws = _workspace(owner_session, base_url)
    original_draft = copy.deepcopy(original_ws["store"])
    original_public = owner_session.get(f"{base_url}/api/store", timeout=30).json()["store"]
    yield
    latest_ws = _workspace(owner_session, base_url)
    _save_workspace(owner_session, base_url, original_draft, latest_ws["version"])
    owner_session.post(f"{base_url}/api/admin/publish", timeout=30)
    verify_public = owner_session.get(f"{base_url}/api/store", timeout=30).json()["store"]
    assert verify_public["hero"]["headline"] == original_public["hero"]["headline"]


def test_admin_mutation_requires_valid_origin(base_url, api_client, owner_credentials, origin):
    login = api_client.post(
        f"{base_url}/api/auth/login",
        json=owner_credentials,
        headers={"Origin": origin},
        timeout=30,
    )
    assert login.status_code == 200

    no_origin = api_client.post(f"{base_url}/api/admin/publish", timeout=30)
    assert no_origin.status_code == 403

    wrong_origin = api_client.post(
        f"{base_url}/api/admin/publish",
        headers={"Origin": "https://evil.example"},
        timeout=30,
    )
    assert wrong_origin.status_code == 403


def test_preview_publish_revisions_revert_discard_workflow(base_url, owner_session, restore_site_after_test):
    ws = _workspace(owner_session, base_url)
    original_public_headline = owner_session.get(f"{base_url}/api/store", timeout=30).json()["store"]["hero"]["headline"]
    temp_headline = f"QA HEADLINE {int(datetime.now(timezone.utc).timestamp())}"
    ws_store = ws["store"]
    ws_store["hero"]["headline"] = temp_headline

    _save_workspace(owner_session, base_url, ws_store, ws["version"])

    public_before_publish = owner_session.get(f"{base_url}/api/store", timeout=30).json()["store"]
    assert public_before_publish["hero"]["headline"] == original_public_headline

    preview = owner_session.post(f"{base_url}/api/admin/preview", timeout=30)
    assert preview.status_code == 200
    token = preview.json()["token"]
    preview_store = owner_session.get(f"{base_url}/api/store", params={"preview": token}, timeout=30)
    assert preview_store.status_code == 200
    assert preview_store.json()["store"]["hero"]["headline"] == temp_headline

    publish = owner_session.post(f"{base_url}/api/admin/publish", timeout=30)
    assert publish.status_code == 200

    public_after_publish = owner_session.get(f"{base_url}/api/store", timeout=30).json()["store"]
    assert public_after_publish["hero"]["headline"] == temp_headline

    revisions = owner_session.get(f"{base_url}/api/admin/revisions", timeout=30)
    assert revisions.status_code == 200
    assert len(revisions.json()) >= 1
    revision_id = revisions.json()[0]["id"]

    revert = owner_session.post(
        f"{base_url}/api/admin/revert",
        json={"revision_id": revision_id},
        timeout=30,
    )
    assert revert.status_code == 200

    draft_after_revert = _workspace(owner_session, base_url)["store"]
    assert draft_after_revert["hero"]["headline"] != temp_headline

    public_after_revert = owner_session.get(f"{base_url}/api/store", timeout=30).json()["store"]
    assert public_after_revert["hero"]["headline"] == temp_headline

    discard = owner_session.post(f"{base_url}/api/admin/discard", timeout=30)
    assert discard.status_code == 200
    draft_after_discard = _workspace(owner_session, base_url)["store"]
    assert draft_after_discard["hero"]["headline"] == temp_headline


def test_product_collection_page_nav_footer_draft_mutations(base_url, owner_session, restore_site_after_test):
    ws = _workspace(owner_session, base_url)
    store = ws["store"]

    created_id = f"qa-prod-{int(datetime.now(timezone.utc).timestamp())}"
    created = {
        "id": created_id,
        "name": "QA Product",
        "slug": f"qa-product-{created_id[-4:]}",
        "price": 1000,
        "sale_price": None,
        "status": "draft",
        "sizes": [{"name": "M", "stock": 2}],
        "images": [],
        "colors": [{"name": "Sand", "hex": "#d6c7aa"}],
        "description": "QA product",
    }
    store["products"].append(created)
    duplicate = copy.deepcopy(created)
    duplicate["id"] = f"{created_id}-dup"
    duplicate["slug"] = f"{created['slug']}-dup"
    duplicate["name"] = "QA Product Copy"
    store["products"].append(duplicate)
    store["products"] = [p for p in store["products"] if p["id"] != duplicate["id"]]

    if len(store["collections"]) >= 2:
        store["collections"][0], store["collections"][1] = store["collections"][1], store["collections"][0]
    target_collection_slug = store["collections"][0]["slug"] if store["collections"] else ""
    store["products"][0]["collection"] = target_collection_slug

    page_slug = f"qa-page-{created_id[-4:]}"
    store["pages"].append(
        {
            "id": f"page-{created_id}",
            "slug": page_slug,
            "title": "QA page",
            "body": "QA page body",
            "published": False,
            "seo_title": "QA page",
            "seo_description": "QA description",
        }
    )

    if store.get("navigation"):
        store["navigation"][0]["label"] = "Shop Updated QA"
    if store.get("footer", {}).get("groups"):
        store["footer"]["groups"][0]["title"] = "Customer Care QA"

    _save_workspace(owner_session, base_url, store, ws["version"])
    latest = _workspace(owner_session, base_url)["store"]
    assert any(p["id"] == created_id for p in latest["products"])
    assert any(p["slug"] == page_slug for p in latest["pages"])


def test_media_upload_metadata_validation_and_reference_delete_lock(base_url, owner_session, restore_site_after_test):
    owner_session.headers.pop("Content-Type", None)
    image = Image.new("RGB", (20, 20), color=(120, 100, 80))
    png_io = io.BytesIO()
    image.save(png_io, format="PNG")
    png_io.seek(0)

    upload = owner_session.post(
        f"{base_url}/api/admin/media",
        files={"file": ("qa-image.png", png_io.read(), "image/png")},
        timeout=30,
    )
    assert upload.status_code == 200, upload.text
    media = upload.json()
    media_id = media["id"]

    fetch = owner_session.get(f"{base_url}/api/media/{media_id}", timeout=30)
    assert fetch.status_code == 200
    assert fetch.headers.get("content-type", "").startswith("image/png")

    edit = owner_session.put(
        f"{base_url}/api/admin/media/{media_id}",
        json={"name": "QA Edited", "alt": "QA alt", "focal_point": "45% 55%", "folder": "Campaign"},
        timeout=30,
    )
    assert edit.status_code == 200

    wrong_type = owner_session.post(
        f"{base_url}/api/admin/media",
        files={"file": ("bad.txt", b"not-an-image", "text/plain")},
        timeout=30,
    )
    assert wrong_type.status_code == 415

    ws = _workspace(owner_session, base_url)
    ws_store = ws["store"]
    ws_store["hero"]["image"] = media["url"]
    _save_workspace(owner_session, base_url, ws_store, ws["version"])

    delete_referenced = owner_session.delete(f"{base_url}/api/admin/media/{media_id}", timeout=30)
    assert delete_referenced.status_code == 409

    ws2 = _workspace(owner_session, base_url)
    ws2_store = ws2["store"]
    ws2_store["hero"]["image"] = ""
    _save_workspace(owner_session, base_url, ws2_store, ws2["version"])

    delete_unused = owner_session.delete(f"{base_url}/api/admin/media/{media_id}", timeout=30)
    assert delete_unused.status_code == 200


def test_currency_features_and_site_mode_propagate_after_publish(base_url, owner_session, restore_site_after_test):
    ws = _workspace(owner_session, base_url)
    store = ws["store"]

    usd = next((c for c in store["currencies"] if c["code"] == "USD"), None)
    assert usd is not None
    usd["rate"] = 0.02
    store["features"]["wishlist"] = False
    store["site_mode"] = "maintenance"

    _save_workspace(owner_session, base_url, store, ws["version"])
    publish = owner_session.post(f"{base_url}/api/admin/publish", timeout=30)
    assert publish.status_code == 200

    public_store = owner_session.get(f"{base_url}/api/store", timeout=30).json()["store"]
    usd_live = next(c for c in public_store["currencies"] if c["code"] == "USD")
    assert usd_live["rate"] == 0.02
    assert public_store["features"]["wishlist"] is False
    assert public_store["site_mode"] == "maintenance"

    prepare = owner_session.post(
        f"{base_url}/api/orders/prepare",
        json={"items": [{"product_id": "p001", "size": "S", "color": "Sand", "quantity": 1}], "currency": "USD"},
        timeout=30,
    )
    assert prepare.status_code == 409
    assert "paused" in prepare.json().get("detail", "").lower()