from app.validation import validate, PHONE_RE
from app.errors import ApiError
import pytest
from .conftest import h


def test_health_reports_unconfigured_integrations(client):
    body = client.get("/api/health").get_json()
    assert body["status"] == "ok"
    assert body["sms_alerts"] == "not_configured"
    assert body["emergency_dispatch"] == "not_implemented"


def test_protected_routes_require_token(client):
    for path in ["/api/me", "/api/contacts", "/api/dashboard", "/api/evidence", "/api/devices", "/api/journeys", "/api/sos"]:
        assert client.get(path).status_code == 401
    assert client.get("/api/contacts", headers={"Authorization": "Bearer bogus"}).status_code == 401


def test_validate_rejects_unknown_and_bad_fields():
    with pytest.raises(ApiError) as e:
        validate({"phone": "abc", "x": 1}, {"phone": (str, True, {"pattern": PHONE_RE})})
    assert e.value.status == 422
    assert e.value.details == {"phone": "invalid format", "x": "unknown field"}


def test_pin_must_be_digits(client):
    r = client.patch("/api/me", json={"cancel_pin": "12ab"}, headers=h())
    assert r.status_code == 422


def test_pin_hashes_never_returned(client):
    r = client.patch("/api/me", json={"cancel_pin": "1234"}, headers=h())
    assert r.status_code == 200
    assert "cancel_pin_hash" not in r.get_json()
