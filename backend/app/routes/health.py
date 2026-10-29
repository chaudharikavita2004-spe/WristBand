from flask import Blueprint, current_app, jsonify

bp = Blueprint("health", __name__)


@bp.get("/health")
def health():
    n = current_app.extensions["notifier"]
    return jsonify({
        "status": "ok",
        "data_backend": current_app.config["DATA_BACKEND"],
        "sms_alerts": "configured" if n.channel == "sms" else "not_configured",
        "phone_calls": "not_implemented",
        "emergency_dispatch": "not_implemented",
    })
