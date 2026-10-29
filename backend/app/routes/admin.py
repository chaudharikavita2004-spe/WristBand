from flask import Blueprint, jsonify

from ..auth import require_admin
from ._util import repo

bp = Blueprint("admin", __name__)


@bp.get("/admin/stats")
@require_admin
def stats():
    return jsonify(repo().admin_stats())


@bp.get("/admin/sos")
@require_admin
def recent_sos():
    return jsonify(repo().admin_recent_sos())
