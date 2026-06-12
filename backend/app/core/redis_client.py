import redis.asyncio as aioredis
from app.config import get_settings

settings = get_settings()

_redis: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = await aioredis.from_url(settings.redis_url, decode_responses=True)
    return _redis


async def acquire_lock(name: str, timeout: int = 30) -> bool:
    r = await get_redis()
    return await r.set(f"lock:{name}", "1", ex=timeout, nx=True)


async def release_lock(name: str) -> None:
    r = await get_redis()
    await r.delete(f"lock:{name}")


async def is_duplicate_webhook(delivery_id: str, ttl_seconds: int = 86400) -> bool:
    r = await get_redis()
    key = f"webhook:dedup:{delivery_id}"
    result = await r.set(key, "1", ex=ttl_seconds, nx=True)
    return result is None  # None means key already existed → duplicate


async def get_rate_budget(tenant_id: str, integration: str, budget_type: str) -> int:
    r = await get_redis()
    key = f"rate:{tenant_id}:{integration}:{budget_type}"
    val = await r.get(key)
    return int(val) if val else 0


async def consume_rate_budget(tenant_id: str, integration: str, budget_type: str, amount: int = 1) -> bool:
    r = await get_redis()
    key = f"rate:{tenant_id}:{integration}:{budget_type}"
    result = await r.decrby(key, amount)
    return result >= 0
