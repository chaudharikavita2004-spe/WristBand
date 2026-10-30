
from flask import Flask
from flask_cors import CORS

from .config import Config
from .errors import register_error_handlers
from .services.repository import build_repository
from .services.storage import build_storage
from .services.notifier import build_notifier


def create_app(config: dict | None = None) -> Flask:
    app = Flask(__name__)
    app.config.from_object(Config)
    if config:
        app.config.update(config)

    CORS(app, origins=app.config["CORS_ORIGINS"], supports_credentials=False)

    app.extensions["repo"] = build_repository(app.config)
    app.extensions["storage"] = build_storage(app.config)
    app.extensions["notifier"] = build_notifier(app.config)

    from .routes import (
        health,
        profile,
        dashboard,
        contacts,
        guardian,
        sos,
        evidence,
        travel,
        devices,
        admin,
    )

    for bp in (
        health.bp,
        profile.bp,
        dashboard.bp,
        contacts.bp,
        guardian.bp,
        sos.bp,
        evidence.bp,
        travel.bp,
        devices.bp,
        admin.bp,
    ):
        app.register_blueprint(bp, url_prefix="/api")

    register_error_handlers(app)
    return app
