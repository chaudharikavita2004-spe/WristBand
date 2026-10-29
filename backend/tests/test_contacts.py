from .conftest import h


def test_contact_crud_and_isolation(client):
    r = client.post("/api/contacts", json={"name": "Mom", "phone": "+91 98765 43210", "relation": "Mother"}, headers=h())
    assert r.status_code == 201
    cid = r.get_json()["id"]
    assert len(client.get("/api/contacts", headers=h()).get_json()) == 1
    # Bob cannot see or change Alice's contact
    assert client.get("/api/contacts", headers=h("bob")).get_json() == []
    assert client.delete(f"/api/contacts/{cid}", headers=h("bob")).status_code == 404
    assert client.patch(f"/api/contacts/{cid}", json={"name": "Mum"}, headers=h()).get_json()["name"] == "Mum"
    assert client.delete(f"/api/contacts/{cid}", headers=h()).status_code == 204


def test_contact_validation(client):
    r = client.post("/api/contacts", json={"name": "", "phone": "x"}, headers=h())
    assert r.status_code == 422


def test_max_ten_contacts(client):
    for i in range(10):
        assert client.post("/api/contacts", json={"name": f"C{i}", "phone": "+911234567890"}, headers=h()).status_code == 201
    assert client.post("/api/contacts", json={"name": "C11", "phone": "+911234567890"}, headers=h()).status_code == 409
