from datetime import datetime, timezone

from flask import Blueprint, current_app, jsonify, request
from werkzeug.security import check_password_hash

from ..auth import require_auth
from ..errors import ApiError
from ..validation import require_json, validate
from ._util import ctx, repo

bp = Blueprint("sos", __name__)
TRIGGER = {
    "trigger": (str, True, {"choices": ["button", "shake", "checkin", "pulse", "device", "voice"]}),
    "lat": (float, False, {"range": (-90, 90)}),
    "lng": (float, False, {"range": (-180, 180)}),
    "accuracy_m": (float, False, {"range": (0, 100000)}),
    "note": (str, False, {"max": 500}),
}


def _alert_contacts(token, uid, event):
    r = repo()
    notifier = current_app.extensions["notifier"]
    loc = f" Location: https://maps.google.com/?q={event['lat']},{event['lng']}" if event.get("lat") is not None else " Location unavailable."
    results = []
    for c in r.list(token, "emergency_contacts", uid, order="priority", desc=False):
        status = notifier.send_sms(c["phone"], f"WristBand SOS: your contact needs help.{loc}") if c.get("notify_sms", True) else "skipped"
        results.append(r.insert(token, "alert_deliveries", {
            "user_id": uid, "sos_event_id": event["id"], "contact_id": c["id"], "channel": notifier.channel, "status": status}))
    return results


@bp.post("/sos")
@require_auth
def trigger():
    token, uid = ctx()
    data = validate(require_json(request), TRIGGER)
    event = repo().insert(token, "sos_events", {**data, "user_id": uid, "status": "active", "duress": False})
    deliveries = _alert_contacts(token, uid, event)
    sent = sum(1 for d in deliveries if d["status"] == "sent")
    return jsonify({
        "event": event,
        "alerts": {"attempted": len(deliveries), "sent": sent,
                   "message": f"{sent} SMS alert(s) sent." if sent else
                   "No automatic alerts were delivered (SMS not configured or no contacts). Call your contacts or local emergency number (112 in India) directly."},
    }), 201


@bp.post("/sos/<eid>/location")
@require_auth
def update_location(eid):
    token, uid = ctx()
    data = validate(require_json(request), {k: TRIGGER[k] for k in ("lat", "lng", "accuracy_m")})
    row = repo().update(token, "sos_events", uid, eid, data)
    if not row:
        raise ApiError(404, "SOS event not found")
    return jsonify({"ok": True})


@bp.post("/sos/<eid>/cancel")
@require_auth
def cancel(eid):
    """Correct PIN cancels. Duress PIN *appears* to cancel but keeps the alert active and flags it."""
    token, uid = ctx()
    pin = str(require_json(request).get("pin", ""))
    r = repo()
    event = r.get(token, "sos_events", uid, eid)
    if not event:
        raise ApiError(404, "SOS event not found")
    if event["status"] != "active":
        raise ApiError(409, "SOS is not active")
    profile = r.get_profile(token, uid) or {}
    if profile.get("duress_pin_hash") and check_password_hash(profile["duress_pin_hash"], pin):
        r.update(token, "sos_events", uid, eid, {"duress": True})
        _alert_contacts(token, uid, {**event, "id": eid})
        return jsonify({"status": "cancelled"})  # intentionally identical to a real cancel
    if not profile.get("cancel_pin_hash"):
        raise ApiError(400, "Set a cancel PIN in your profile first")
    if not check_password_hash(profile["cancel_pin_hash"], pin):
        raise ApiError(403, "Incorrect PIN")
    r.update(token, "sos_events", uid, eid, {"status": "cancelled", "resolved_at": datetime.now(timezone.utc).isoformat()})
    return jsonify({"status": "cancelled"})


@bp.get("/sos")
@require_auth
def history():
    token, uid = ctx()
    return jsonify([{k: v for k, v in e.items() if k != "duress"} for e in repo().list(token, "sos_events", uid)])


@bp.post("/checkins")
@require_auth
def checkin():
    token, uid = ctx()
    data = validate(require_json(request), {"ok": (bool, True, {}), "note": (str, False, {"max": 200})})
    return jsonify(repo().insert(token, "checkins", {**data, "user_id": uid})), 201
