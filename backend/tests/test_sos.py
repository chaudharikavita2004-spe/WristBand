from .conftest import h


def setup_pins(client):
    client.patch(
        "/api/me",
        json={"cancel_pin": "1234", "duress_pin": "9111"},
        headers=h(),
    )
    client.post(
        "/api/contacts",
        json={"name": "Mom", "phone": "+919876543210"},
        headers=h(),
    )


def test_sos_without_sms_is_honest(client):
    setup_pins(client)

    r = client.post(
        "/api/sos",
        json={"trigger": "button", "lat": 28.61, "lng": 77.2},
        headers=h(),
    )

    assert r.status_code == 201

    body = r.get_json()
    event = body["event"]

    assert body["alerts"]["attempted"] == 0
    assert body["alerts"]["sent"] == 0
    assert "No automatic SMS was sent" in body["alerts"]["message"]

    assert event["trigger_type"] == "button"
    assert event["status"] == "initiated"
    assert event["latitude"] == 28.61
    assert event["longitude"] == 77.2
    assert event["is_demo"] is False

    assert client.get(
        "/api/dashboard", headers=h()
    ).get_json()["status"] == "emergency"


def test_cancel_with_correct_pin(client):
    setup_pins(client)

    eid = client.post(
        "/api/sos",
        json={"trigger": "button"},
        headers=h(),
    ).get_json()["event"]["id"]

    wrong_pin = client.post(
        f"/api/sos/{eid}/cancel",
        json={"pin": "0000"},
        headers=h(),
    )
    assert wrong_pin.status_code == 403

    correct_pin = client.post(
        f"/api/sos/{eid}/cancel",
        json={"pin": "1234"},
        headers=h(),
    )
    assert correct_pin.get_json() == {"status": "cancelled"}

    assert client.get(
        "/api/dashboard", headers=h()
    ).get_json()["status"] == "safe"


def test_duress_pin_looks_cancelled_but_stays_active(app, client):
    setup_pins(client)

    eid = client.post(
        "/api/sos",
        json={"trigger": "button"},
        headers=h(),
    ).get_json()["event"]["id"]

    r = client.post(
        f"/api/sos/{eid}/cancel",
        json={"pin": "9111"},
        headers=h(),
    )

    assert r.get_json() == {"status": "cancelled"}

    stored = app.extensions["repo"].get(
        None, "sos_events", "u-alice", eid
    )

    assert stored["status"] == "initiated"
    assert "duress" not in stored

    history = client.get("/api/sos", headers=h()).get_json()
    assert all("duress" not in event for event in history)

    assert client.get(
        "/api/dashboard", headers=h()
    ).get_json()["status"] == "emergency"


def test_invalid_trigger(client):
    r = client.post(
        "/api/sos",
        json={"trigger": "telepathy"},
        headers=h(),
    )

    assert r.status_code == 422