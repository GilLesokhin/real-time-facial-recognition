"""terminal key hash

Revision ID: b81e3c5d2a40
Revises: 9d2f4b7a1c30
Create Date: 2026-11-18 12:00:00.000000
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "b81e3c5d2a40"
down_revision: str | None = "9d2f4b7a1c30"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("terminals", sa.Column("key_hash", sa.String(length=64), nullable=True))


def downgrade() -> None:
    op.drop_column("terminals", "key_hash")
