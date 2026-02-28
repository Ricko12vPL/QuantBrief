import asyncio
import time


class RateLimiter:
    """Token-bucket rate limiter for API calls."""

    def __init__(self, max_requests: int, time_window: float):
        self._max_requests = max_requests
        self._time_window = time_window
        self._timestamps: list[float] = []
        self._lock = asyncio.Lock()

    async def acquire(self):
        while True:
            async with self._lock:
                now = time.monotonic()
                self._timestamps = [
                    t for t in self._timestamps if now - t < self._time_window
                ]
                if len(self._timestamps) < self._max_requests:
                    self._timestamps.append(time.monotonic())
                    return
                sleep_time = self._time_window - (now - self._timestamps[0])

            if sleep_time > 0:
                await asyncio.sleep(sleep_time)

    async def __aenter__(self):
        await self.acquire()
        return self

    async def __aexit__(self, *args):
        pass


# Pre-configured limiters
SEC_LIMITER = RateLimiter(max_requests=10, time_window=1.0)
ALPHA_VANTAGE_LIMITER = RateLimiter(max_requests=5, time_window=60.0)
FINNHUB_LIMITER = RateLimiter(max_requests=60, time_window=60.0)
FRED_LIMITER = RateLimiter(max_requests=120, time_window=60.0)
