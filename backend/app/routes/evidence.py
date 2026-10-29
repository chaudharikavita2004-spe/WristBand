import uuid

from flask import Blueprint, current_app, jsonify, request

from ..auth import require_auth
from ..errors import ApiError
from ._util import ctx, repo

bp = Blueprint("evidence", __name__)
ALLOWED = {"image/jpeg", "image/png", "image/webp", "audio/webm", "audio/mpeg", "audio/mp4", "video/mp4", "video/webm", "application/pdf", "text/plain"}


def storage():
    return current_app.extensions["storage"]


@bp.get("/evidence")
@require_auth
def list_evidence():
    token, uid = ctx()
    return jsonify(repo().list(token, "evidence", uid))


@bp.post("/evidence")
@require_auth
def upload():
    token, uid = ctx()
    f = request.files.get("file")
    if not f or not f.filename:
        raise ApiError(400, "Attach a file in the 'file' field")
    ctype = f.mimetype or "application/octet-stream"
    if ctype not in ALLOWED:
        raise ApiError(415, f"File type {ctype} not allowed")
    data = f.read()
    if not data:
        raise ApiError(400, "File is empty")
    ext = f.filename.rsplit(".", 1)[-1][:8] if "." in f.filename else "bin"
    path = f"{uid}/{uuid.uuid4()}.{ext}"  # first folder = owner id (matches storage RLS)
    storage().upload(token, path, data, ctype)
    row = repo().insert(token, "evidence", {
        "user_id": uid, "storage_path": path, "file_name": f.filename[:200], "mime_type": ctype,
        "size_bytes": len(data), "note": (request.form.get("note") or "")[:500], "sos_event_id": request.form.get("sos_event_id") or None,
    })
    return jsonify(row), 201


@bp.get("/evidence/<eid>/url")
@require_auth
def signed(eid):
    token, uid = ctx()
    row = repo().get(token, "evidence", uid, eid)
    if not row:
        raise ApiError(404, "Evidence not found")
    return jsonify({"url": storage().signed_url(token, row["storage_path"]), "expires_in": 300})


@bp.delete("/evidence/<eid>")
@require_auth
def delete(eid):
    token, uid = ctx()
    row = repo().get(token, "evidence", uid, eid)
    if not row:
        raise ApiError(404, "Evidence not found")
    storage().remove(token, row["storage_path"])
    repo().delete(token, "evidence", uid, eid)
    return "", 204
