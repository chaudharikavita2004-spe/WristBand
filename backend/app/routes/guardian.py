
from flask import Blueprint, jsonify

from ..auth import require_auth
from ._util import ctx, repo

bp = Blueprint("guardian", __name__)


@bp.get("/guardian/grants")
@require_auth
def list_guardian_grants():
    token, uid = ctx()

    # Grants created by this user (the person sharing access).
    grants = repo().list(
        token,
        "guardian_access",
        uid,
        order="created_at",
        desc=True,
    )

    # Only return grants that have not been revoked.
    active_grants = [
        grant for grant in grants
        if grant.get("revoked_at") is None
    ]

    return jsonify(active_grants)


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
        from ..errors import ApiError
        raise ApiError(404, "Active guardian grant not found")

    from datetime import datetime, timezone

    updated = repo().update(
        token,
        "guardian_access",
        uid,
        grant_id,
        {"revoked_at": datetime.now(timezone.utc).isoformat()},
    )

    if not updated:
        from ..errors import ApiError
        raise ApiError(404, "Guardian grant not found")

    return jsonify({"message": "Guardian access revoked"})
