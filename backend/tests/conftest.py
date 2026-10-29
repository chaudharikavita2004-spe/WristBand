import pytest

from app import create_app

TOKENS = {"tok-alice": {"id": "u-alice", "email": "alice@example.com"},
          "tok-bob": {"id": "u-bob", "email": "bob@example.com"},
          "tok-admin": {"id": "u-admin", "email": "admin@example.com"}}


@pytest.fixture
def app():
    app = create_app({"TESTING": True, "DATA_BACKEND": "memory", "TEST_TOKENS": TOKENS,
                      "TWILIO_ACCOUNT_SID": "", "TWILIO_AUTH_TOKEN": "", "TWILIO_FROM_NUMBER": ""})
    app.extensions["repo"].roles.append({"user_id": "u-admin", "role": "admin"})
    return app


@pytest.fixture
def client(app):
    return app.test_client()


def h(name="alice"):
    return {"Authorization": f"Bearer tok-{name}"}
