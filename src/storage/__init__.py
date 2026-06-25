"""Storage layer (the diagram's 'Data Storage Layer').

A thin SQLAlchemy persistence layer that targets PostgreSQL when a DATABASE_URL
is configured, and transparently falls back to a local SQLite file so the
project runs with zero infrastructure. See db.py.
"""
