"""Data access. SupabaseRepository forwards the user's JWT so Postgres RLS enforces ownership.
MemoryRepository mimics the same contract for local demo and tests."""
import copy
import uuid
from datetime import datetime, timezone

import requests

from ..errors import ApiError


def now_iso():
    return datetime.now(timezone.utc).isoformat()


class MemoryRepository:
    def __init__(self):
        self.tables: dict[str, list[dict]] = {}
        self.roles: list[dict] = []

    def _t(self, table):
        return self.tables.setdefault(table, [])

    def list(self, token, table, user_id, filters=None, order="created_at", desc=True, limit=200):
        rows = [r for r in self._t(table) if r.get("user_id") == user_id]
        for k, v in (filters or {}).items():
            rows = [r for r in rows if r.get(k) == v]
        rows.sort(key=lambda r: r.get(order) or "", reverse=desc)
        return copy.deepcopy(rows[:limit])

    def list_received_guardian_grants(self, token, guardian_user_id):
        now = datetime.now(timezone.utc)
        rows = []

        for grant in self._t("guardian_access"):
            if grant.get("guardian_user_id") != guardian_user_id:
                continue

            if grant.get("revoked_at") is not None:
                continue

            expires_at = grant.get("expires_at")
            if expires_at:
                expiry = datetime.fromisoformat(
                    expires_at.replace("Z", "+00:00")
                )
                if expiry <= now:
                    continue

            rows.append(grant)

        rows.sort(key=lambda r: r.get("created_at") or "", reverse=True)
        return copy.deepcopy(rows[:200])




    def get(self, token, table, user_id, row_id):
        for r in self._t(table):
            if r["id"] == row_id and r.get("user_id") == user_id:
                return copy.deepcopy(r)
        return None

    def insert(self, token, table, row):
        row = {"id": str(uuid.uuid4()), "created_at": now_iso(), **row}
        self._t(table).append(row)
        return copy.deepcopy(row)

    def update(self, token, table, user_id, row_id, patch):
        for r in self._t(table):
            if r["id"] == row_id and r.get("user_id") == user_id:
                r.update(patch); r["updated_at"] = now_iso()
                return copy.deepcopy(r)
        return None

    def delete(self, token, table, user_id, row_id):
        before = len(self._t(table))
        self.tables[table] = [r for r in self._t(table) if not (r["id"] == row_id and r.get("user_id") == user_id)]
        return len(self.tables[table]) < before

    def upsert_profile(self, token, user_id, patch):
        for r in self._t("profiles"):
            if r["id"] == user_id:
                r.update(patch); return copy.deepcopy(r)
        row = {"id": user_id, "user_id": user_id, "created_at": now_iso(), **patch}
        self._t("profiles").append(row)
        return copy.deepcopy(row)

    def get_profile(self, token, user_id):
        return next((copy.deepcopy(r) for r in self._t("profiles") if r["id"] == user_id), None)

    def has_role(self, token, user_id, role):
        return any(r["user_id"] == user_id and r["role"] == role for r in self.roles)

    def admin_stats(self):
        return {
            "users": len(self._t("profiles")),
            "sos_active": sum(1 for r in self._t("sos_events") if r["status"] == "active"),
            "sos_total": len(self._t("sos_events")),
            "evidence_items": len(self._t("evidence")),
            "devices": len(self._t("devices")),
            "journeys_active": sum(1 for r in self._t("journeys") if r["status"] == "active"),
        }

    def admin_recent_sos(self, limit=50):
        rows = sorted(self._t("sos_events"), key=lambda r: r["created_at"], reverse=True)
        return copy.deepcopy(rows[:limit])


class SupabaseRepository:
    def __init__(self, cfg):
        self.base = f"{cfg['SUPABASE_URL']}/rest/v1"
        self.anon = cfg["SUPABASE_ANON_KEY"]
        self.service = cfg["SUPABASE_SERVICE_ROLE_KEY"]

    def _h(self, token, prefer=None):
        h = {"apikey": self.anon, "Authorization": f"Bearer {token}", "Content-Type": "application/json"}
        if prefer:
            h["Prefer"] = prefer
        return h

    def _check(self, r):
        if r.status_code >= 400:
            raise ApiError(502 if r.status_code >= 500 else 400, "Database request failed", r.text[:300])
        return r.json() if r.text else None

    def list(self, token, table, user_id, filters=None, order="created_at", desc=True, limit=200):
        params = {"select": "*", "user_id": f"eq.{user_id}", "order": f"{order}.{'desc' if desc else 'asc'}", "limit": str(limit)}
        for k, v in (filters or {}).items():
            params[k] = f"eq.{v}"
        return self._check(requests.get(f"{self.base}/{table}", headers=self._h(token), params=params, timeout=15))

    def list_received_guardian_grants(self, token, guardian_user_id):
        params = {
            "select": "*",
            "guardian_user_id": f"eq.{guardian_user_id}",
            "revoked_at": "is.null",
            "order": "created_at.desc",
            "limit": "200",
        }

        return self._check(
            requests.get(
                f"{self.base}/guardian_access",
                headers=self._h(token),
                params=params,
                timeout=15,
            )
        )

    def get(self, token, table, user_id, row_id):
        rows = self._check(requests.get(f"{self.base}/{table}", headers=self._h(token),
                                        params={"select": "*", "id": f"eq.{row_id}", "user_id": f"eq.{user_id}"}, timeout=15))
        return rows[0] if rows else None

    def insert(self, token, table, row):
        rows = self._check(requests.post(f"{self.base}/{table}", headers=self._h(token, "return=representation"), json=row, timeout=15))
        return rows[0]

    def update(self, token, table, user_id, row_id, patch):
        rows = self._check(requests.patch(f"{self.base}/{table}", headers=self._h(token, "return=representation"),
                                          params={"id": f"eq.{row_id}", "user_id": f"eq.{user_id}"}, json=patch, timeout=15))
        return rows[0] if rows else None

    def delete(self, token, table, user_id, row_id):
        rows = self._check(requests.delete(f"{self.base}/{table}", headers=self._h(token, "return=representation"),
                                           params={"id": f"eq.{row_id}", "user_id": f"eq.{user_id}"}, timeout=15))
        return bool(rows)

    def get_profile(self, token, user_id):
        rows = self._check(requests.get(f"{self.base}/profiles", headers=self._h(token), params={"select": "*", "id": f"eq.{user_id}"}, timeout=15))
        return rows[0] if rows else None

    def upsert_profile(self, token, user_id, patch):
        rows = self._check(requests.patch(f"{self.base}/profiles", headers=self._h(token, "return=representation"),
                                          params={"id": f"eq.{user_id}"}, json=patch, timeout=15))
        return rows[0] if rows else None

    def has_role(self, token, user_id, role):
        rows = self._check(requests.get(f"{self.base}/user_roles", headers=self._h(token),
                                        params={"select": "role", "user_id": f"eq.{user_id}", "role": f"eq.{role}"}, timeout=15))
        return bool(rows)

    # Admin-only aggregate reads. Called only after require_admin verified the caller.
    def _svc(self):
        if not self.service:
            raise ApiError(503, "SUPABASE_SERVICE_ROLE_KEY not configured for admin reports")
        return {"apikey": self.service, "Authorization": f"Bearer {self.service}", "Prefer": "count=exact"}

    def _count(self, table, params=None):
        r = requests.head(f"{self.base}/{table}", headers=self._svc(), params={"select": "id", **(params or {})}, timeout=15)
        rng = r.headers.get("content-range", "*/0")
        return int(rng.split("/")[-1] or 0)

    def admin_stats(self):
        return {
            "users": self._count("profiles"),
            "sos_active": self._count("sos_events", {"status": "eq.active"}),
            "sos_total": self._count("sos_events"),
            "evidence_items": self._count("evidence"),
            "devices": self._count("devices"),
            "journeys_active": self._count("journeys", {"status": "eq.active"}),
        }

    def admin_recent_sos(self, limit=50):
        h = self._svc(); h.pop("Prefer")
        return self._check(requests.get(f"{self.base}/sos_events", headers=h,
                                        params={"select": "id,user_id,status,trigger,lat,lng,created_at", "order": "created_at.desc", "limit": str(limit)}, timeout=15))


def build_repository(cfg):
    if cfg["DATA_BACKEND"] == "supabase":
        if not cfg["SUPABASE_URL"] or not cfg["SUPABASE_ANON_KEY"]:
            raise RuntimeError("DATA_BACKEND=supabase requires SUPABASE_URL and SUPABASE_ANON_KEY")
        return SupabaseRepository(cfg)
    return MemoryRepository()
