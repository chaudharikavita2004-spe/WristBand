
from datetime import datetime, timezone

from .conftest import h


TEST_GUARDIAN_ID = "d580fac0-3cb5-4933-9630-2a39d33bb2ee"


def create_test_grant(client):
    repo = client.application.extensions["repo"]

    return repo.insert(
        "tok-alice",
        "guardian_access",
        {
            "user_id": "u-alice",
            "guardian_user_id": "u-bob",
            "can_view_alerts": True,
            "can_view_location": True,
            "expires_at": None,
            "revoked_at": None,
        },
    )


def test_list_guardian_grants(client):
    create_test_grant(client)

    response = client.get("/api/guardian/grants", headers=h("alice"))

    assert response.status_code == 200
    grants = response.get_json()
    assert len(grants) == 1
    assert grants[0]["guardian_user_id"] == "u-bob"


def test_revoked_grants_are_not_listed(client):
    grant = create_test_grant(client)
    repo = client.application.extensions["repo"]

    repo.update(
        "tok-alice",
        "guardian_access",
        "u-alice",
        grant["id"],
        {"revoked_at": datetime.now(timezone.utc).isoformat()},
    )

    response = client.get("/api/guardian/grants", headers=h("alice"))

    assert response.status_code == 200
    assert response.get_json() == []


def test_owner_can_revoke_guardian_access(client):
    grant = create_test_grant(client)

    response = client.patch(
        f"/api/guardian/grants/{grant['id']}/revoke",
        headers=h("alice"),
    )

    assert response.status_code == 200
    assert response.get_json()["message"] == "Guardian access revoked"

    repo = client.application.extensions["repo"]
    saved = repo.get(
        "tok-alice",
        "guardian_access",
        "u-alice",
        grant["id"],
    )
    assert saved["revoked_at"] is not None


def test_other_user_cannot_revoke_grant(client):
    grant = create_test_grant(client)

    response = client.patch(
        f"/api/guardian/grants/{grant['id']}/revoke",
        headers=h("bob"),
    )

    assert response.status_code == 404

    repo = client.application.extensions["repo"]
    saved = repo.get(
        "tok-alice",
        "guardian_access",
        "u-alice",
        grant["id"],
    )
    assert saved["revoked_at"] is None


def test_create_guardian_grant(client):
    response = client.post(
        "/api/guardian/grants",
        json={
            "guardian_user_id": TEST_GUARDIAN_ID,
            "can_view_alerts": True,
            "can_view_location": False,
        },
        headers=h("alice"),
    )

    assert response.status_code == 201

    grant = response.get_json()
    assert grant["user_id"] == "u-alice"
    assert grant["guardian_user_id"] == TEST_GUARDIAN_ID
    assert grant["can_view_alerts"] is True
    assert grant["can_view_location"] is False
    assert grant["revoked_at"] is None


def test_create_guardian_grant_requires_valid_uuid(client):
    response = client.post(
        "/api/guardian/grants",
        json={"guardian_user_id": "not-a-valid-uuid"},
        headers=h("alice"),
    )

    assert response.status_code == 400


def test_create_guardian_grant_requires_guardian_id(client):
    response = client.post(
        "/api/guardian/grants",
        json={"can_view_alerts": True},
        headers=h("alice"),
    )

    assert response.status_code == 400


def test_duplicate_active_guardian_grant_is_rejected(client):
    client.post(
        "/api/guardian/grants",
        json={"guardian_user_id": TEST_GUARDIAN_ID},
        headers=h("alice"),
    )

    response = client.post(
        "/api/guardian/grants",
        json={"guardian_user_id": TEST_GUARDIAN_ID},
        headers=h("alice"),
    )

    assert response.status_code == 409


def test_create_guardian_grant_rejects_invalid_permissions(client):
    response = client.post(
        "/api/guardian/grants",
        json={
            "guardian_user_id": TEST_GUARDIAN_ID,
            "can_view_alerts": "yes",
        },
        headers=h("alice"),
    )

    assert response.status_code == 400


def test_unauthenticated_guardian_request(client):
    response = client.get("/api/guardian/grants")

    assert response.status_code == 401


def test_unauthenticated_guardian_grant_creation(client):
    response = client.post(
        "/api/guardian/grants",
        json={"guardian_user_id": TEST_GUARDIAN_ID},
    )

    assert response.status_code == 401


# Guardian-side shared-alert tests

def test_guardian_can_see_received_grant(client):
    create_test_grant(client)

    response = client.get(
        "/api/guardian/shared-alerts",
        headers=h("bob"),
    )

    assert response.status_code == 200

    data = response.get_json()
    assert len(data["grants"]) == 1
    assert data["grants"][0]["user_id"] == "u-alice"
    assert data["events"] == []


def test_guardian_sees_only_real_shared_alerts(client):
    create_test_grant(client)

    repo = client.application.extensions["repo"]

    repo.insert("tok-alice", "sos_events", {
        "user_id": "u-alice",
        "status": "alert_sent",
        "is_demo": False,
        "latitude": 19.99,
        "longitude": 73.78,
        "location_accuracy_m": 10,
    })

    repo.insert("tok-alice", "sos_events", {
        "user_id": "u-alice",
        "status": "alert_sent",
        "is_demo": True,
        "latitude": 19.99,
        "longitude": 73.78,
    })

    response = client.get(
        "/api/guardian/shared-alerts",
        headers=h("bob"),
    )

    assert response.status_code == 200

    events = response.get_json()["events"]
    assert len(events) == 1
    assert events[0]["is_demo"] is False
    assert events[0]["owner_user_id"] == "u-alice"


def test_guardian_cannot_see_location_without_permission(client):
    repo = client.application.extensions["repo"]

    repo.insert("tok-alice", "guardian_access", {
        "user_id": "u-alice",
        "guardian_user_id": "u-bob",
        "can_view_alerts": True,
        "can_view_location": False,
        "expires_at": None,
        "revoked_at": None,
    })

    repo.insert("tok-alice", "sos_events", {
        "user_id": "u-alice",
        "status": "alert_sent",
        "is_demo": False,
        "latitude": 19.99,
        "longitude": 73.78,
        "location_accuracy_m": 10,
    })

    response = client.get(
        "/api/guardian/shared-alerts",
        headers=h("bob"),
    )

    assert response.status_code == 200
    event = response.get_json()["events"][0]

    assert "latitude" not in event
    assert "longitude" not in event
    assert "location_accuracy_m" not in event


def test_guardian_cannot_see_alerts_without_alert_permission(client):
    repo = client.application.extensions["repo"]

    repo.insert("tok-alice", "guardian_access", {
        "user_id": "u-alice",
        "guardian_user_id": "u-bob",
        "can_view_alerts": False,
        "can_view_location": True,
        "expires_at": None,
        "revoked_at": None,
    })

    repo.insert("tok-alice", "sos_events", {
        "user_id": "u-alice",
        "status": "alert_sent",
        "is_demo": False,
        "latitude": 19.99,
        "longitude": 73.78,
    })

    response = client.get(
        "/api/guardian/shared-alerts",
        headers=h("bob"),
    )

    assert response.status_code == 200
    assert response.get_json()["events"] == []


def test_guardian_cannot_see_revoked_grant(client):
    grant = create_test_grant(client)

    repo = client.application.extensions["repo"]
    repo.update(
        "tok-alice",
        "guardian_access",
        "u-alice",
        grant["id"],
        {"revoked_at": datetime.now(timezone.utc).isoformat()},
    )

    response = client.get(
        "/api/guardian/shared-alerts",
        headers=h("bob"),
    )

    assert response.status_code == 200
    assert response.get_json()["grants"] == []
    assert response.get_json()["events"] == []


def test_shared_alerts_requires_authentication(client):
    response = client.get("/api/guardian/shared-alerts")

    assert response.status_code == 401
