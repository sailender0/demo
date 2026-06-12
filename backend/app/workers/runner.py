"""
Worker entrypoint — runs Kafka consumer + scheduled background tasks in parallel.
"""
import asyncio
import logging
from app.workers.kafka_consumer import run_consumer
from app.workers.sync_worker import token_refresh_loop, reconciliation_loop

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")


async def main():
    await asyncio.gather(
        run_consumer(),
        token_refresh_loop(),
        reconciliation_loop(),
    )


if __name__ == "__main__":
    asyncio.run(main())
