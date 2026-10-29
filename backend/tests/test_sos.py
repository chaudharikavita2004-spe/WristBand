from .conftest import h


def setup_pins(client):
    client.patch("/api/me", json={"cancel_pin": "1234", "duress_pin": "9111"}, headers=h())
    client.post("/api/contacts", json={"name": "Mom", "phone": "+919876543210"}, headers=h())


def test_sos_without_sms_is_honest(client):
    setup_pins(client)
    r = client.post("/api/sos", json={"trigger": "button", "lat": 28.61, "lng": 77.2}, headers=h())
    assert r.status_code == 201
    body = r.get_json()
    assert body["alerts"] == {"attempted": 1, "sent": 0, "message": body["alerts"]["message"]}
    assert "No automatic alerts" in body["alerts"]["message"]
    assert client.get("/api/dashboard", headers=h()).get_json()["status"] == "emergency"


def test_cancel_with_correct_pin(client):
    setup_pins(client)
    eid = client.post("/api/sos", json={"trigger": "button"}, headers=h()).get_json()["event"]["id"]
    assert client.post(f"/api/sos/{eid}/cancel", json={"pin": "0000"}, headers=h()).status_code == 403
    assert client.post(f"/api/sos/{eid}/cancel", json={"pin": "1234"}, headers=h()).get_json() == {"status": "cancelled"}
    assert client.get("/api/dashboard", headers=h()).get_json()["status"] == "safe"


def test_duress_pin_looks_cancelled_but_stays_active(app, client):
    setup_pins(client)
    eid = client.post("/api/sos", json={"trigger": "button"}, headers=h()).get_json()["event"]["id"]
    r = client.post(f"/api/sos/{eid}/cancel", json={"pin": "9111"}, headers=h())
    assert r.get_json() == {"status": "cancelled"}
    stored = app.extensions["repo"].get(None, "sos_events", "u-alice", eid)
    assert stored["status"] == "active" and stored["duress"] is True
    # duress flag never leaks to the (possibly coerced) user's screen
    assert all("duress" not in e for e in client.get("/api/sos", headers=h()).get_json())


def test_invalid_trigger(client):
    assert client.post("/api/sos", json={"trigger": "telepathy"}, headers=h()).status_code == 422
