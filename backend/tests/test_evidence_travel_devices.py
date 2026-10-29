import io
from .conftest import h


def test_evidence_upload_list_url_delete(client):
    r = client.post("/api/evidence", data={"file": (io.BytesIO(b"hello"), "note.txt", "text/plain"), "note": "incident"},
                    headers=h(), content_type="multipart/form-data")
    assert r.status_code == 201
    item = r.get_json()
    assert item["storage_path"].startswith("u-alice/")
    assert client.get(f"/api/evidence/{item['id']}/url", headers=h()).status_code == 200
    assert client.get(f"/api/evidence/{item['id']}/url", headers=h("bob")).status_code == 404
    assert client.delete(f"/api/evidence/{item['id']}", headers=h()).status_code == 204


def test_evidence_rejects_bad_type(client):
    r = client.post("/api/evidence", data={"file": (io.BytesIO(b"MZ"), "x.exe", "application/x-msdownload")}, headers=h(), content_type="multipart/form-data")
    assert r.status_code == 415


def test_journey_lifecycle(client):
    j = client.post("/api/journeys", json={"destination": "Home", "expected_minutes": 30, "mode": "cab"}, headers=h()).get_json()
    assert client.post("/api/journeys", json={"destination": "X", "expected_minutes": 5}, headers=h()).status_code == 409
    assert client.post(f"/api/journeys/{j['id']}/points", json={"lat": 28.6, "lng": 77.2}, headers=h()).status_code == 201
    assert client.post(f"/api/journeys/{j['id']}/end", json={}, headers=h()).get_json()["status"] == "completed"
    assert client.post(f"/api/journeys/{j['id']}/points", json={"lat": 1.0, "lng": 1.0}, headers=h()).status_code == 404


def test_device_register_and_reading(client):
    d = client.post("/api/devices", json={"name": "Band", "hardware_id": "abc", "source": "demo", "battery": 80}, headers=h()).get_json()
    assert client.post(f"/api/devices/{d['id']}/readings", json={"bpm": 78, "source": "demo"}, headers=h()).status_code == 201
    assert client.post(f"/api/devices/{d['id']}/readings", json={"bpm": 999, "source": "demo"}, headers=h()).status_code == 422
    assert client.delete(f"/api/devices/{d['id']}", headers=h()).status_code == 204


def test_admin_endpoints_protected(client):
    assert client.get("/api/admin/stats", headers=h()).status_code == 403
    r = client.get("/api/admin/stats", headers=h("admin"))
    assert r.status_code == 200 and "sos_active" in r.get_json()
    assert client.get("/api/admin/sos").status_code == 401
