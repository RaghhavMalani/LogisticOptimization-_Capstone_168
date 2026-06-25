"""Streaming layer (the diagram's Kafka real-time path).

A small abstraction (`bus.py`) lets the same producer/consumer code run against
a real Kafka broker OR an in-process queue, so the real-time pipeline is
demonstrable with or without infrastructure:

    producer.py  -- replays daily port records onto the bus (topic).
    consumer.py  -- consumes records, maintains a rolling window, and re-runs
                    experts -> HSMM -> forecast -> decision as new data arrives.
"""
