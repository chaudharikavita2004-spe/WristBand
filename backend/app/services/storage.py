"""Evidence file storage. Supabase Storage (private bucket, RLS on storage.objects) or in-memory."""
import requests

from ..errors import ApiError


class MemoryStorage:
    def __init__(self):
        self.objects: dict[str, tuple[bytes, str]] = {}

    def upload(self, token, path, data: bytes, content_type: str):
        self.objects[path] = (data, content_type)

    def signed_url(self, token, path, expires=300):
        if path not in self.objects:
            raise ApiError(404, "File not found")
        return f"memory://{path}?expires={expires}"

    def remove(self, token, path):
        self.objects.pop(path, None)


class SupabaseStorage:
    def __init__(self, cfg):
        self.base = f"{cfg['SUPABASE_URL']}/storage/v1"
        self.bucket = cfg["EVIDENCE_BUCKET"]
        self.anon = cfg["SUPABASE_ANON_KEY"]
        self.public_base = cfg["SUPABASE_URL"]

    def _h(self, token, extra=None):
        return {"apikey": self.anon, "Authorization": f"Bearer {token}", **(extra or {})}

    def upload(self, token, path, data, content_type):
        r = requests.post(f"{self.base}/object/{self.bucket}/{path}", headers=self._h(token, {"Content-Type": content_type, "x-upsert": "false"}), data=data, timeout=60)
        if r.status_code >= 400:
            raise ApiError(400, "Upload failed", r.text[:300])

    def signed_url(self, token, path, expires=300):
        r = requests.post(f"{self.base}/object/sign/{self.bucket}/{path}", headers=self._h(token), json={"expiresIn": expires}, timeout=15)
        if r.status_code >= 400:
            raise ApiError(404, "File not found")
        return f"{self.public_base}/storage/v1{r.json()['signedURL']}"

    def remove(self, token, path):
        requests.delete(f"{self.base}/object/{self.bucket}", headers=self._h(token), json={"prefixes": [path]}, timeout=15)


def build_storage(cfg):
    return SupabaseStorage(cfg) if cfg["DATA_BACKEND"] == "supabase" else MemoryStorage()
