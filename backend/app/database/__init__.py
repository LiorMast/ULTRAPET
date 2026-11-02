"""database — Everything about the PostgreSQL database: the schema, the models and the dev data commands.

- create-tables.sql / drop-tables.sql: the schema, written by hand and explained table by table (source of truth).
- db.py: the Flask-SQLAlchemy `db` object and the declarative base.
- models/: the SQLAlchemy models, one module per area, mirroring the SQL.
- seed.py: `flask reset-db --yes` and `flask seed`.
"""
