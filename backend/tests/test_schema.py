"""test_schema.py — The SQL files and the models describe the same database (CLAUDE.md working rule 5).

create-tables.sql is the source of truth: the models must match the database it builds (tables, columns, types,
nullability, keys, unique constraints, indexes and CHECK names); drop-tables.sql must remove every table in a working
order (no CASCADE); and every table and column in create-tables.sql must be explained by a comment.
"""
import re

from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import CheckConstraint, text

from app.db import db
from app.seed import CREATE_TABLES_SQL, DROP_TABLES_SQL, run_sql_file


def public_tables() -> set[str]:
    """Lists the tables in the database's public schema.

    Returns:
        The table names.
    """
    rows = db.session.execute(text("SELECT tablename FROM pg_tables WHERE schemaname = 'public'"))
    return {name for (name,) in rows}


def test_models_match_create_tables_sql(database):
    with db.engine.connect() as connection:
        context = MigrationContext.configure(connection, opts={"compare_type": True})
        assert compare_metadata(context, db.metadata) == []


def test_check_constraint_names_match(database):
    rows = database.execute(
        text(
            "SELECT conrelid::regclass::text, conname FROM pg_constraint "
            "WHERE contype = 'c' AND connamespace = 'public'::regnamespace"
        )
    )
    in_models = {
        (table.name, constraint.name)
        for table in db.metadata.tables.values()
        for constraint in table.constraints
        if isinstance(constraint, CheckConstraint)
    }
    assert set(rows) == in_models


def test_drop_tables_sql_drops_everything_and_create_tables_sql_rebuilds(database):
    database.commit()  # end this session's transaction, so it holds no locks on the tables being dropped
    run_sql_file(DROP_TABLES_SQL)
    assert public_tables() == set()
    database.commit()
    run_sql_file(CREATE_TABLES_SQL)
    assert public_tables() == set(db.metadata.tables)


def test_drop_tables_sql_works_twice_on_an_empty_database(database):
    database.commit()
    run_sql_file(DROP_TABLES_SQL)
    run_sql_file(DROP_TABLES_SQL)
    run_sql_file(CREATE_TABLES_SQL)
    assert public_tables() == set(db.metadata.tables)


def test_every_table_and_column_is_explained():
    script = CREATE_TABLES_SQL.read_text(encoding="utf-8")
    tables = re.findall(r"^CREATE TABLE (\w+) \(\n(.*?)\n\);", script, flags=re.MULTILINE | re.DOTALL)
    assert {name for name, _ in tables} == set(db.metadata.tables)
    for name, body in tables:
        assert f"-- {name} — " in script, f"table {name} has no explanation"
        for line in body.splitlines():
            assert "--" in line, f"{name}: no comment on `{line.strip()}`"
