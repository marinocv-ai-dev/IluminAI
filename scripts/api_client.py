# -*- coding: utf-8 -*-
"""
Cliente API con caché en disco y limitación de tasa (rate limiting).
Hacknation Reto 5
"""
import hashlib
import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

CACHE_DIR = Path("data/.cache")
CACHE_DIR.mkdir(parents=True, exist_ok=True)

UA = {
    "User-Agent": "AtlasRareDiseasesHackathon/1.0 (mailto:hackathon@rare-diseases-atlas.org)",
    "Accept": "application/json"
}


def _cache_path(url: str, post_data: str | None = None) -> Path:
    key = url if post_data is None else f"{url}__POST__{post_data}"
    h = hashlib.sha256(key.encode("utf-8")).hexdigest()
    return CACHE_DIR / f"{h}.json"


def fetch_json(url: str, post_data: dict | None = None, delay: float = 0.4) -> dict:
    post_str = json.dumps(post_data, sort_keys=True) if post_data else None
    cp = _cache_path(url, post_str)
    if cp.exists():
        try:
            return json.loads(cp.read_text(encoding="utf-8"))
        except Exception:
            pass

    headers = dict(UA)
    if post_str:
        headers["Content-Type"] = "application/json"
        req = urllib.request.Request(url, data=post_str.encode("utf-8"), headers=headers)
    else:
        req = urllib.request.Request(url, headers=headers)

    max_retries = 5
    for attempt in range(max_retries):
        try:
            time.sleep(delay)
            with urllib.request.urlopen(req, timeout=20) as r:
                data = json.load(r)
                cp.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
                return data
        except urllib.error.HTTPError as e:
            if e.code == 429:
                wait_time = 2.0 * (attempt + 1)
                time.sleep(wait_time)
                continue
            raise
        except Exception as e:
            if attempt == max_retries - 1:
                raise
            time.sleep(1.5)
    raise RuntimeError(f"Failed to fetch {url} after {max_retries} retries")


def fetch_text(url: str, delay: float = 0.4) -> str:
    cp = _cache_path(url)
    txt_path = cp.with_suffix(".txt")
    if txt_path.exists():
        return txt_path.read_text(encoding="utf-8")

    req = urllib.request.Request(url, headers={"User-Agent": UA["User-Agent"]})
    max_retries = 5
    for attempt in range(max_retries):
        try:
            time.sleep(delay)
            with urllib.request.urlopen(req, timeout=20) as r:
                text = r.read().decode("utf-8", errors="replace")
                txt_path.write_text(text, encoding="utf-8")
                return text
        except urllib.error.HTTPError as e:
            if e.code == 429:
                time.sleep(2.0 * (attempt + 1))
                continue
            raise
        except Exception:
            if attempt == max_retries - 1:
                raise
            time.sleep(1.5)
    raise RuntimeError(f"Failed to fetch {url} after {max_retries} retries")
