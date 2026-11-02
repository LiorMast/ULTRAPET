"""models — The SQLAlchemy models, one module per area of the schema.

Importing this package imports every model module, so all tables are registered on `db.metadata` (the app factory
and the schema test rely on that). Import classes from their module, e.g. `from app.database.models.catalog import Product`.
Modules: users, catalog, price_rules, orders, settings. Table and column meanings are in backend/app/database/create-tables.sql.
"""
from app.database.models import catalog, orders, price_rules, settings, users  # noqa: F401
