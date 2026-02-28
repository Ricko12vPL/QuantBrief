import json
import time
import logging
from typing import Any, Callable, Awaitable

logger = logging.getLogger(__name__)


class InMemoryCache:
    """Simple in-memory cache with TTL, used as Redis fallback."""

    def __init__(self):
        self._store: dict[str, tuple[Any, float]] = {}

    async def get(self, key: str) -> Any | None:
        if key in self._store:
            value, expires_at = self._store[key]
            if time.time() < expires_at:
                return value
            del self._store[key]
        return None

    async def set(self, key: str, value: Any, ttl: int = 300):
        self._store[key] = (value, time.time() + ttl)

    async def delete(self, key: str):
        self._store.pop(key, None)


class Cache:
    """Cache with Redis backend and in-memory fallback."""

    def __init__(self, redis_url: str = ""):
        self._redis = None
        self._fallback = InMemoryCache()
        self._redis_url = redis_url

    async def _get_redis(self):
        if self._redis is None and self._redis_url:
            try:
                import redis.asyncio as aioredis
                self._redis = aioredis.from_url(self._redis_url)
                await self._redis.ping()
            except Exception:
                logger.warning("Redis unavailable, using in-memory cache")
                self._redis = None
        return self._redis

    async def get(self, key: str) -> Any | None:
        r = await self._get_redis()
        if r:
            try:
                val = await r.get(key)
                return json.loads(val) if val else None
            except Exception:
                pass
        return await self._fallback.get(key)

    async def set(self, key: str, value: Any, ttl: int = 300):
        r = await self._get_redis()
        if r:
            try:
                await r.set(key, json.dumps(value, default=str), ex=ttl)
                return
            except Exception:
                pass
        await self._fallback.set(key, value, ttl)

    async def get_or_fetch(
        self, key: str, fn: Callable[[], Awaitable[Any]], ttl: int = 300
    ) -> Any:
        cached = await self.get(key)
        if cached is not None:
            return cached
        result = await fn()
        await self.set(key, result, ttl)
        return result


_cache: Cache | None = None


def get_cache(redis_url: str = "") -> Cache:
    global _cache
    if _cache is None:
        _cache = Cache(redis_url)
    return _cache
