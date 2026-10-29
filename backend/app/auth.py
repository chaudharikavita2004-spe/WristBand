from functools import wraps

import requests
from flask import current_app, g, request

from .errors import ApiError


def _verify_token(token: str) -> dict:
    cfg = current_app.config
    if cfg["DATA_BACKEND"] == "memory":
        user = cfg["TEST_TOKENS"].get(token)
        if not user:
            raise ApiError(401, "Invalid or expired session")
        return user
    # Ask Supabase Auth who owns this access token (validates signature + expiry server-side).
    r = requests.get(
        f"{cfg['SUPABASE_URL']}/auth/v1/user",
        headers={"apikey": cfg["SUPABASE_ANON_KEY"], "Authorization": f"Bearer {token}"},
        timeout=10,
    )
    if r.status_code != 200:
        raise ApiError(401, "Invalid or expired session")
    u = r.json()
    return {"id": u["id"], "email": u.get("email")}


def require_auth(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        header = request.headers.get("Authorization", "")
        if not header.startswith("Bearer "):
            raise ApiError(401, "Missing bearer token")
        token = header.removeprefix("Bearer ").strip()
        g.user = _verify_token(token)
        g.token = token
        return fn(*args, **kwargs)
    return wrapper


def require_admin(fn):
    @require_auth
    @wraps(fn)
    def wrapper(*args, **kwargs):
        repo = current_app.extensions["repo"]
        # Role lookup runs as the caller (RLS lets users read their own roles), never via service role.
        if not repo.has_role(g.token, g.user["id"], "admin"):
            raise ApiError(403, "Admin access required")
        return fn(*args, **kwargs)
    return wrapper
