from flask import Blueprint, jsonify

from ..auth import require_auth
from ._util import ctx, repo

bp = Blueprint("dashboard", __name__)


def safety_score(contacts, devices, active_sos, active_journey):
    score = 40
    score += min(len(contacts), 3) * 10
    score += 15 if any(d.get("status") == "connected" for d in devices) else 0
    score += 15 if active_journey else 0
    if active_sos:
        score = min(score, 20)
    return max(0, min(100, score))


@bp.get("/dashboard")
@require_auth
def dashboard():
    token, uid = ctx()
    r = repo()
    contacts = r.list(token, "emergency_contacts", uid)
    devices = r.list(token, "devices", uid)
    sos = r.list(token, "sos_events", uid, limit=10)
    journeys = r.list(token, "journeys", uid, {"status": "active"}, limit=1)
    active = next((s for s in sos if s["status"] == "active" and not s.get("duress")), None)
    return jsonify({
        "status": "emergency" if active else "safe",
        "safety_score": safety_score(contacts, devices, active, journeys[0] if journeys else None),
        "contacts_count": len(contacts),
        "devices": devices,
        "active_journey": journeys[0] if journeys else None,
        "recent_sos": [{k: v for k, v in s.items() if k != "duress"} for s in sos],
    })
