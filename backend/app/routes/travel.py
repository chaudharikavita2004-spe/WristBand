from datetime import datetime, timezone

from flask import Blueprint, jsonify, request

from ..auth import require_auth
from ..errors import ApiError
from ..validation import require_json, validate
from ._util import ctx, repo

bp = Blueprint("travel", __name__)
START = {
    "destination": (str, True, {"max": 200}),
    "mode": (str, False, {"choices": ["walk", "cab", "bus", "train", "car", "other"]}),
    "vehicle_info": (str, False, {"max": 120}),
    "expected_minutes": (int, True, {"range": (1, 1440)}),
    "share_with_contacts": (bool, False, {}),
}
POINT = {"lat": (float, True, {"range": (-90, 90)}), "lng": (float, True, {"range": (-180, 180)}), "accuracy_m": (float, False, {"range": (0, 100000)})}


@bp.get("/journeys")
@require_auth
def list_journeys():
    token, uid = ctx()
    return jsonify(repo().list(token, "journeys", uid))


@bp.post("/journeys")
@require_auth
def start():
    token, uid = ctx()
    data = validate(require_json(request), START)
    if repo().list(token, "journeys", uid, {"status": "active"}, limit=1):
        raise ApiError(409, "You already have an active journey")
    return jsonify(repo().insert(token, "journeys", {**data, "user_id": uid, "status": "active",
                                                      "started_at": datetime.now(timezone.utc).isoformat()})), 201


@bp.post("/journeys/<jid>/points")
@require_auth
def add_point(jid):
    token, uid = ctx()
    j = repo().get(token, "journeys", uid, jid)
    if not j or j["status"] != "active":
        raise ApiError(404, "Active journey not found")
    data = validate(require_json(request), POINT)
    return jsonify(repo().insert(token, "location_points", {**data, "user_id": uid, "journey_id": jid})), 201


@bp.post("/journeys/<jid>/end")
@require_auth
def end(jid):
    token, uid = ctx()
    status = (request.get_json(silent=True) or {}).get("status", "completed")
    if status not in ("completed", "cancelled"):
        raise ApiError(422, "status must be completed or cancelled")
    row = repo().update(token, "journeys", uid, jid, {"status": status, "ended_at": datetime.now(timezone.utc).isoformat()})
    if not row:
        raise ApiError(404, "Journey not found")
    return jsonify(row)
