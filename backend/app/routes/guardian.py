
from datetime import datetime, timezone
from uuid import UUID

from flask import Blueprint, jsonify, request

from ..auth import require_auth
from ..errors import ApiError
from ._util import ctx, repo

bp = Blueprint("guardian", __name__)


@bp.get("/guardian/grants")
@require_auth
def list_guardian_grants():
    token, uid = ctx()

    grants = repo().list(
        token,
        "guardian_access",
        uid,
        order="created_at",
        desc=True,
    )

    now = datetime.now(timezone.utc)
    active_grants = []

    for grant in grants:
        if grant.get("revoked_at") is not None:
            continue

        expires_at = grant.get("expires_at")

        if expires_at:
            expiry = datetime.fromisoformat(
                expires_at.replace("Z", "+00:00")
            )
            if expiry <= now:
                continue

        active_grants.append(grant)

    return jsonify(active_grants)


@bp.post("/guardian/grants")
@require_auth
def create_guardian_grant():
    token, uid = ctx()
    data = request.get_json(silent=True) or {}

    guardian_user_id = data.get("guardian_user_id")

    if not isinstance(guardian_user_id, str):
        raise ApiError(400, "Guardian user ID is required")

    try:
        guardian_user_id = str(UUID(guardian_user_id))
    except ValueError:
        raise ApiError(400, "Invalid guardian user ID")

    if guardian_user_id == uid:
        raise ApiError(400, "You cannot grant access to yourself")

    can_view_alerts = data.get("can_view_alerts", True)
    can_view_location = data.get("can_view_location", False)

    if not isinstance(can_view_alerts, bool):
        raise ApiError(400, "can_view_alerts must be true or false")

    if not isinstance(can_view_location, bool):
        raise ApiError(400, "can_view_location must be true or false")

    expires_at = data.get("expires_at")

    if expires_at is not None:
        if not isinstance(expires_at, str):
            raise ApiError(400, "Invalid expiry date")

        try:
            expiry = datetime.fromisoformat(
                expires_at.replace("Z", "+00:00")
            )

            if expiry.tzinfo is None:
                raise ValueError("Timezone is required")

            if expiry <= datetime.now(timezone.utc):
                raise ValueError("Expiry must be in the future")

            expires_at = expiry.astimezone(
                timezone.utc
            ).isoformat()

        except ValueError:
            raise ApiError(
                400,
                "Expiry must be a valid future ISO date with timezone",
            )

    existing_grants = repo().list(
        token,
        "guardian_access",
        uid,
        order="created_at",
        desc=True,
    )

    for grant in existing_grants:
        if (
            grant.get("guardian_user_id") == guardian_user_id
            and grant.get("revoked_at") is None
        ):
            existing_expiry = grant.get("expires_at")

            if existing_expiry:
                parsed_expiry = datetime.fromisoformat(
                    existing_expiry.replace("Z", "+00:00")
                )
                if parsed_expiry <= datetime.now(timezone.utc):
                    continue

            raise ApiError(
                409,
                "An active grant already exists for this guardian",
            )

    new_grant = repo().insert(
        token,
        "guardian_access",
        {
            "user_id": uid,
            "guardian_user_id": guardian_user_id,
            "can_view_alerts": can_view_alerts,
            "can_view_location": can_view_location,
            "expires_at": expires_at,
            "revoked_at": None,
        },
    )

    return jsonify(new_grant), 201


@bp.patch("/guardian/grants/<grant_id>/revoke")
@require_auth
def revoke_guardian_grant(grant_id):
    token, uid = ctx()

    grant = repo().get(
        token,
        "guardian_access",
        uid,
        grant_id,
    )

    if not grant or grant.get("revoked_at") is not None:
        raise ApiError(404, "Active guardian grant not found")

    updated = repo().update(
        token,
        "guardian_access",
        uid,
        grant_id,
        {
            "revoked_at": datetime.now(
                timezone.utc
            ).isoformat()
        },
    )

    if not updated:
        raise ApiError(404, "Guardian grant not found")

    return jsonify({"message": "Guardian access revoked"})


@bp.get("/guardian/shared-alerts")
@require_auth
def list_shared_guardian_alerts():
    token, uid = ctx()

    grants = repo().list_received_guardian_grants(token, uid)

    now = datetime.now(timezone.utc)
    active_grants = []
    events = []

    # Keep only active and unexpired grants.
    for grant in grants:
        if grant.get("revoked_at") is not None:
            continue

        expires_at = grant.get("expires_at")

        if expires_at:
            expiry = datetime.fromisoformat(
                expires_at.replace("Z", "+00:00")
            )
            if expiry <= now:
                continue

        active_grants.append(grant)

    # Look up names only for owners who have active grants.
    owner_ids = list({
        grant["user_id"]
        for grant in active_grants
    })

    owner_names = repo().get_profile_names(owner_ids)

    # Add the owner's display name to received grants.
    for grant in active_grants:
        owner_id = grant["user_id"]

        owner_name = (
            owner_names.get(owner_id) or "Shared account"
        )

        grant["owner_name"] = owner_name

        if not grant.get("can_view_alerts"):
            continue

        owner_events = repo().list(
            token,
            "sos_events",
            owner_id,
            order="created_at",
            desc=True,
            limit=200,
        )

        for event in owner_events:
            # Exclude demo and simulated SOS events.
            if event.get("is_demo") is not False:
                continue

            if event.get("status") not in (
                "initiated",
                "pending_synchronization",
                "alert_sent",
            ):
                continue

            shared_event = dict(event)
            shared_event["owner_user_id"] = owner_id
            shared_event["owner_name"] = owner_name

            # Remove location unless the owner authorized it.
            if not grant.get("can_view_location"):
                shared_event.pop("latitude", None)
                shared_event.pop("longitude", None)
                shared_event.pop("location_accuracy_m", None)

            events.append(shared_event)

    events.sort(
        key=lambda event: event.get("created_at") or "",
        reverse=True,
    )

    return jsonify({
        "grants": active_grants,
        "events": events,
    })
