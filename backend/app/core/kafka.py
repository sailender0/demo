import json
import asyncio
from typing import Any
from confluent_kafka import Producer, Consumer, KafkaError
from app.config import get_settings

settings = get_settings()

_producer: Producer | None = None


def get_producer() -> Producer:
    global _producer
    if _producer is None:
        _producer = Producer({"bootstrap.servers": settings.kafka_bootstrap_servers})
    return _producer


async def publish(topic: str, key: str, payload: dict[str, Any]) -> None:
    producer = get_producer()
    producer.produce(
        topic,
        key=key.encode(),
        value=json.dumps(payload).encode(),
    )
    producer.poll(0)


def flush_producer() -> None:
    get_producer().flush(timeout=10)


def make_consumer(group_id: str | None = None) -> Consumer:
    return Consumer({
        "bootstrap.servers": settings.kafka_bootstrap_servers,
        "group.id": group_id or settings.kafka_consumer_group,
        "auto.offset.reset": "earliest",
        "enable.auto.commit": False,
    })
