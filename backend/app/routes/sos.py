from datetime import datetime, timezone

from flask import Blueprint, current_app, jsonify, request
from werkzeug.security import check_password_hash

from ..auth import require_auth
from ..errors import ApiError
from ..validation import require_json, validate
from ._util import ctx, repo

bp = Blueprint("sos", __name__)

ACTIVE_SOS_STATUSES = (
    "initiated",
    "pending_synchronization",
    "alert_sent",
    "acknowledged",
    "delivery_failed",
)

TRIGGER = {
    "trigger": (
        str,
        True,
        {
            "choices": [
                "button",
                "shake",
                "duress",
                "checkin",
                "deviation",
                "pulse",
                "device",
                "voice",
            ]
        },
    ),
    "lat": (float, False, {"range": (-90, 90)}),
    "lng": (float, False, {"range": (-180, 180)}),
    "accuracy_m": (float, False, {"range": (0, 100000)}),
    "client_event_id": (str, False, {"max": 100}),
    "note": (str, False, {"max": 500}),
}


def _alert_contacts(token, uid, event):
    r = repo()
    notifier = current_app.extensions["notifier"]

    contacts = r.list(
        token,
        "emergency_contacts",
        uid,
        order="priority",
        desc=False,
    )

    eligible = [
        contact
        for contact in contacts
        if contact.get("notify_sms", True) and contact.get("phone")
    ]

    if notifier.channel == "none":
        return {
            "attempted": 0,
            "sent": 0,
            "message": (
                "No automatic SMS was sent because SMS is not configured. "
                "Contact your emergency contacts or call 112 in India directly."
            ),
        }

    if not eligible:
        return {
            "attempted": 0,
            "sent": 0,
            "message": (
                "No emergency contacts with SMS notifications enabled were found. "
                "Contact your emergency contacts or call 112 in India directly."
            ),
        }

    latitude = event.get("latitude")
    longitude = event.get("longitude")

    location = (
        f" Location: https://maps.google.com/?q={latitude},{longitude}"
        if latitude is not None and longitude is not None
        else " Location unavailable."
    )

    sent = 0

    for contact in eligible:
        status = notifier.send_sms(
            contact["phone"],
            f"WristBand SOS: your contact needs help.{location}",
        )

        if status == "sent":
            sent += 1

    return {
        "attempted": len(eligible),
        "sent": sent,
        "message": (
            f"{sent} SMS alert(s) sent."
            if sent > 0
            else (
                "SMS delivery failed. Contact your emergency contacts "
                "or call 112 in India directly."
            )
        ),
    }


@bp.post("/sos")
@require_auth
def trigger():
    token, uid = ctx()
    data = validate(require_json(request), TRIGGER)

    event_data = {
        "user_id": uid,
        "trigger_type": data["trigger"],
        "status": "initiated",
        "latitude": data.get("lat"),
        "longitude": data.get("lng"),
        "location_accuracy_m": data.get("accuracy_m"),
        "is_demo": False,
    }

    if data.get("client_event_id"):
        event_data["client_event_id"] = data["client_event_id"]

    event = repo().insert(token, "sos_events", event_data)

    alerts = _alert_contacts(token, uid, event)

    if alerts["sent"] > 0:
        event = repo().update(
            token,
            "sos_events",
            uid,
            event["id"],
            {"status": "alert_sent"},
        )
    elif alerts["attempted"] > 0:
        event = repo().update(
            token,
            "sos_events",
            uid,
            event["id"],
            {"status": "delivery_failed"},
        )

    return jsonify({
        "event": event,
        "alerts": alerts,
    }), 201


@bp.post("/sos/<eid>/location")
@require_auth
def update_location(eid):
    token, uid = ctx()

    data = validate(
        require_json(request),
        {
            "lat": TRIGGER["lat"],
            "lng": TRIGGER["lng"],
            "accuracy_m": TRIGGER["accuracy_m"],
        },
    )

    patch = {}

    if "lat" in data:
        patch["latitude"] = data["lat"]

    if "lng" in data:
        patch["longitude"] = data["lng"]

    if "accuracy_m" in data:
        patch["location_accuracy_m"] = data["accuracy_m"]

    row = repo().update(
        token,
        "sos_events",
        uid,
        eid,
        patch,
    )

    if not row:
        raise ApiError(404, "SOS event not found")

    return jsonify({"ok": True})


@bp.post("/sos/<eid>/cancel")
@require_auth
def cancel(eid):
    """
    Correct PIN cancels the SOS.
    Duress PIN appears to cancel it but leaves the SOS active.
    """

    token, uid = ctx()
    pin = str(require_json(request).get("pin", ""))

    r = repo()
    event = r.get(token, "sos_events", uid, eid)

    if not event:
        raise ApiError(404, "SOS event not found")

    if event["status"] not in ACTIVE_SOS_STATUSES:
        raise ApiError(409, "SOS is not active")

    profile = r.get_profile(token, uid) or {}

    # Duress PIN: keep the SOS active and send another alert if possible.
    if (
        profile.get("duress_pin_hash")
        and check_password_hash(profile["duress_pin_hash"], pin)
    ):
        _alert_contacts(token, uid, event)

        # Same response as a normal cancellation.
        return jsonify({"status": "cancelled"})

    # Normal cancellation PIN.
    if not profile.get("cancel_pin_hash"):
        raise ApiError(400, "Set a cancel PIN in your profile first")

    if not check_password_hash(profile["cancel_pin_hash"], pin):
        raise ApiError(403, "Incorrect PIN")

    r.update(
        token,
        "sos_events",
        uid,
        eid,
        {
            "status": "cancelled",
            "resolved_at": datetime.now(timezone.utc).isoformat(),
        },
    )

    return jsonify({"status": "cancelled"})


@bp.get("/sos")
@require_auth
def history():
    token, uid = ctx()
    return jsonify(
        repo().list(token, "sos_events", uid)
    )


@bp.post("/checkins")
@require_auth
def checkin():
    token, uid = ctx()

    data = validate(
        require_json(request),
        {
            "ok": (bool, True, {}),
            "note": (str, False, {"max": 200}),
        },
    )

    return jsonify(
        repo().insert(
            token,
            "checkins",
            {**data, "user_id": uid},
        )
    ), 201