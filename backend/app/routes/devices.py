from datetime import datetime, timezone

from flask import Blueprint, jsonify, request

from ..auth import require_auth
from ..errors import ApiError
from ..validation import require_json, validate
from ._util import ctx, repo

bp = Blueprint("devices", __name__)
SCHEMA = {
    "name": (str, True, {"max": 100}),
    "hardware_id": (str, True, {"max": 200}),
    "source": (str, True, {"choices": ["real", "demo"]}),
    "status": (str, False, {"choices": ["connected", "disconnected"]}),
    "battery": (int, False, {"range": (0, 100)}),
}


@bp.get("/devices")
@require_auth
def list_devices():
    token, uid = ctx()
    return jsonify(repo().list(token, "devices", uid))


@bp.post("/devices")
@require_auth
def register():
    token, uid = ctx()
    data = validate(require_json(request), SCHEMA)
    data.setdefault("status", "connected")
    return jsonify(repo().insert(token, "devices", {**data, "user_id": uid, "last_seen": datetime.now(timezone.utc).isoformat()})), 201


@bp.patch("/devices/<did>")
@require_auth
def update(did):
    token, uid = ctx()
    data = validate(require_json(request), {k: SCHEMA[k] for k in ("name", "status", "battery")}, partial=True)
    data["last_seen"] = datetime.now(timezone.utc).isoformat()
    row = repo().update(token, "devices", uid, did, data)
    if not row:
        raise ApiError(404, "Device not found")
    return jsonify(row)


@bp.delete("/devices/<did>")
@require_auth
def remove(did):
    token, uid = ctx()
    if not repo().delete(token, "devices", uid, did):
        raise ApiError(404, "Device not found")
    return "", 204


@bp.post("/devices/<did>/readings")
@require_auth
def reading(did):
    token, uid = ctx()
    if not repo().get(token, "devices", uid, did):
        raise ApiError(404, "Device not found")
    data = validate(require_json(request), {"bpm": (int, True, {"range": (20, 250)}), "source": (str, True, {"choices": ["real", "demo"]})})
    return jsonify(repo().insert(token, "pulse_readings", {**data, "user_id": uid, "device_id": did})), 201
