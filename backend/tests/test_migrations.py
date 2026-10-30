from __future__ import annotations
from pathlib import Path

from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from flask_migrate import upgrade # type: ignore

from extensions import db
from helpers import make_test_app

MIGRATIONS = Path(__file__).resolve().parent.parent / "migrations"


def test_migrations_build_the_same_tables_as_the_models():
    app = make_test_app()

    with app.app_context():
        upgrade(directory=str(MIGRATIONS))

        with db.engine.connect() as connection:
            differences = compare_metadata(MigrationContext.configure(connection), db.metadata)  # type: ignore[reportUnknownMemberType]

    assert differences == []
