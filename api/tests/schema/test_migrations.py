"""Every migration can be undone, so a bad deploy can be rolled back."""

from alembic import command
from alembic.config import Config
from sqlalchemy import Engine, inspect

from tests.conftest import ALEMBIC_INI, get_test_database_url


def test_downgrade_removes_everything(engine: Engine):
    config = Config(ALEMBIC_INI)
    config.attributes["database_url"] = get_test_database_url()
    try:
        command.downgrade(config, "base")
        db = inspect(engine)
        assert db.get_table_names() == ["alembic_version"]
        assert db.get_enums() == []
    finally:
        command.upgrade(config, "head")  # the other tests need the tables back
