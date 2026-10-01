import logging
import threading
import time
from datetime import datetime, timezone
from math import isfinite

import requests

WORLD_BANK_URL = "https://api.worldbank.org/v2/country/ZAF/indicator/FP.CPI.TOTL.ZG"
CACHE_TTL_SECONDS = 24 * 60 * 60
REQUEST_TIMEOUT = (5, 15)

logger = logging.getLogger(__name__)
_cache = {"data": None, "fetched_at": 0.0}
_lock = threading.Lock()


class InflationUnavailable(Exception):
    """Raised when no usable inflation observation can be returned."""


def clear_cache():
    with _lock:
        _cache["data"] = None
        _cache["fetched_at"] = 0.0


def _parse(payload):
    records = payload[1]
    valid = [r for r in records if r.get("value") is not None]
    latest = max(valid, key=lambda r: int(r["date"]))
    rate = float(latest["value"])
    if not isfinite(rate) or rate <= -100:
        raise ValueError("Unusable inflation rate")
    return {
        "country": "South Africa",
        "observation_year": str(latest["date"]),
        "annual_inflation_percent": rate,
        "source": "World Bank WDI / IMF IFS",
        "retrieved_at": datetime.now(timezone.utc).isoformat(),
    }


def _fetch():
    response = requests.get(
        WORLD_BANK_URL,
        params={"format": "json", "mrnev": 1},
        timeout=REQUEST_TIMEOUT,
    )
    response.raise_for_status()
    return _parse(response.json())


def get_inflation(now=time.time):
    with _lock:
        data, fetched_at = _cache["data"], _cache["fetched_at"]
    if data is not None and now() - fetched_at < CACHE_TTL_SECONDS:
        return {**data, "data_status": "cached"}

    try:
        fresh = _fetch()
    except (requests.RequestException, ValueError, TypeError,
            KeyError, IndexError, AttributeError) as exc:
        logger.warning("World Bank fetch failed: %s", type(exc).__name__)
        if data is not None:
            return {**data, "data_status": "stale_cache"}
        raise InflationUnavailable("Inflation data unavailable.") from exc

    with _lock:
        _cache["data"] = fresh
        _cache["fetched_at"] = now()
    return {**fresh, "data_status": "live"}