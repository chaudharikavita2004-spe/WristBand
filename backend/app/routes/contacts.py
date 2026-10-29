from flask import Blueprint, jsonify, request

from ..auth import require_auth
from ..errors import ApiError
from ..validation import EMAIL_RE, PHONE_RE, require_json, validate
from ._util import ctx, repo

bp = Blueprint("contacts", __name__)
SCHEMA = {
    "name": (str, True, {"max": 100}),
    "phone": (str, True, {"pattern": PHONE_RE}),
    "email": (str, False, {"pattern": EMAIL_RE, "max": 200}),
    "relation": (str, False, {"max": 50}),
    "priority": (int, False, {"range": (1, 10)}),
    "notify_sms": (bool, False, {}),
}


@bp.get("/contacts")
@require_auth
def list_contacts():
    token, uid = ctx()
    return jsonify(repo().list(token, "emergency_contacts", uid, order="priority", desc=False))


@bp.post("/contacts")
@require_auth
def create_contact():
    token, uid = ctx()
    data = validate(require_json(request), SCHEMA)
    if len(repo().list(token, "emergency_contacts", uid)) >= 10:
        raise ApiError(409, "Maximum of 10 emergency contacts")
    data.setdefault("priority", 1); data.setdefault("notify_sms", True)
    return jsonify(repo().insert(token, "emergency_contacts", {**data, "user_id": uid})), 201


@bp.patch("/contacts/<cid>")
@require_auth
def update_contact(cid):
    token, uid = ctx()
    row = repo().update(token, "emergency_contacts", uid, cid, validate(require_json(request), SCHEMA, partial=True))
    if not row:
        raise ApiError(404, "Contact not found")
    return jsonify(row)


@bp.delete("/contacts/<cid>")
@require_auth
def delete_contact(cid):
    token, uid = ctx()
    if not repo().delete(token, "emergency_contacts", uid, cid):
        raise ApiError(404, "Contact not found")
    return "", 204
