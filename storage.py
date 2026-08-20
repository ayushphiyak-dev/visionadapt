import os, json, logging, time

logger = logging.getLogger("visionadapt.storage")

KV_URL = os.getenv("KV_REST_API_URL", "")
KV_TOKEN = os.getenv("KV_REST_API_TOKEN", "")


class _KVStorage:
    def __init__(self, url, token):
        import requests as _req
        self.url = url.rstrip("/")
        self.headers = {"Authorization": f"Bearer {token}"}
        self._s = _req.Session()

    def _get(self, key):
        try:
            r = self._s.get(f"{self.url}/get/{key}", headers=self.headers, timeout=5)
            r.raise_for_status()
            val = r.json().get("result")
            return json.loads(val) if val is not None else None
        except Exception as e:
            logger.warning("KV GET %s failed: %s", key, e)
            return None

    def _set(self, key, value):
        try:
            r = self._s.post(f"{self.url}/set/{key}", headers=self.headers,
                             json={"value": json.dumps(value)}, timeout=5)
            r.raise_for_status()
            return True
        except Exception as e:
            logger.warning("KV SET %s failed: %s", key, e)
            return False

    def _del(self, key):
        try:
            r = self._s.post(f"{self.url}/del", headers=self.headers,
                             json={"keys": [key]}, timeout=5)
            r.raise_for_status()
            return True
        except Exception as e:
            logger.warning("KV DEL %s failed: %s", key, e)
            return False


class _MemStorage:
    def __init__(self):
        self._d = {}

    def _get(self, key):
        return self._d.get(key)

    def _set(self, key, value):
        self._d[key] = value
        return True

    def _del(self, key):
        self._d.pop(key, None)
        return True


class Storage:
    def __init__(self):
        if KV_URL and KV_TOKEN:
            self._impl = _KVStorage(KV_URL, KV_TOKEN)
            self.backend = "vercel-kv"
            logger.info("Storage backend: Vercel KV (persistent)")
        else:
            self._impl = _MemStorage()
            self.backend = "in-memory"
            logger.warning("Storage backend: in-memory (data lost on cold start). "
                           "Set KV_REST_API_URL and KV_REST_API_TOKEN env vars for persistence.")

    def get_user(self, email: str) -> dict | None:
        return self._impl._get(f"user:{email}")

    def set_user(self, email: str, user: dict):
        self._impl._set(f"user:{email}", user)

    def delete_user(self, email: str):
        self._impl._del(f"user:{email}")

    def get_profile(self, email: str) -> dict | None:
        return self._impl._get(f"profile:{email}")

    def set_profile(self, email: str, profile: dict):
        self._impl._set(f"profile:{email}", profile)

    def delete_profile(self, email: str):
        self._impl._del(f"profile:{email}")


db = Storage()
