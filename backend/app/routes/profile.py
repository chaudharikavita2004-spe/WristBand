from flask import Blueprint, jsonify, request
from werkzeug.security import generate_password_hash

from ..auth import require_auth
from ..errors import ApiError
from ..validation import require_json, validate
from ._util import ctx, repo

bp = Blueprint("profile", __name__)

SCHEMA = {
    "full_name": (str, False, {"max": 120}),
    "phone": (str, False, {"max": 25}),
    "blood_group": (str, False, {"choices": ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]}),
    "allergies": (str, False, {"max": 500}),
    "medications": (str, False, {"max": 500}),
    "lang": (str, False, {"choices": ["en", "hi"]}),
    "pulse_low": (int, False, {"range": (30, 120)}),
    "pulse_high": (int, False, {"range": (80, 220)}),
    "cancel_pin": (str, False, {"max": 8}),
    "duress_pin": (str, False, {"max": 8}),
}


def public(p):
    if not p:
        return None
    p = {k: v for k, v in p.items() if k not in ("cancel_pin_hash", "duress_pin_hash")}
    return p


@bp.get("/me")
@require_auth
def me():
    token, uid = ctx()
    p = repo().get_profile(token, uid) or repo().upsert_profile(token, uid, {})
    return jsonify({"user": {"id": uid}, "profile": public(p), "is_admin": repo().has_role(token, uid, "admin")})


@bp.patch("/me")
@require_auth
def update_me():
    token, uid = ctx()
    data = validate(require_json(request), SCHEMA, partial=True)
    for key in ("cancel_pin", "duress_pin"):
        if key in data:
            pin = data.pop(key)
            if not pin.isdigit() or not 4 <= len(pin) <= 8:
                raise ApiError(422, "Validation failed", {key: "PIN must be 4-8 digits"})
            data[f"{key}_hash"] = generate_password_hash(pin)
    if data.get("pulse_low") and data.get("pulse_high") and data["pulse_low"] >= data["pulse_high"]:
        raise ApiError(422, "Validation failed", {"pulse_low": "must be below pulse_high"})
    return jsonify(public(repo().upsert_profile(token, uid, data)))
