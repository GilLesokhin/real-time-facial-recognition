"""Seed the first Platform Admin

Someone has to be able to approve new accounts, and every sign-up starts Unassigned.
The email and password come from api/.env (PLATFORM_ADMIN_EMAIL, PLATFORM_ADMIN_PASSWORD),
so no password is ever written into the repo.

If that email already has an account (you signed up first), it's promoted instead,
and its password stays as it is.

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-11
"""

import uuid
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import context, op

from app.core.config import settings
from app.core.security import hash_password

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # The tests build their database from the migrations but create their own users.
    if context.config.attributes.get("skip_seed"):
        return

    email = settings.PLATFORM_ADMIN_EMAIL
    password = settings.PLATFORM_ADMIN_PASSWORD
    if not email or not password:
        raise RuntimeError("Set PLATFORM_ADMIN_EMAIL and PLATFORM_ADMIN_PASSWORD in api/.env, then run the migration again.")

    op.get_bind().execute(
        sa.text(
            """
            INSERT INTO users (id, name, email, password_hash, role)
            VALUES (:id, :name, :email, :password_hash, 'platform_admin')
            ON CONFLICT (email) DO UPDATE SET role = 'platform_admin'
            """
        ),
        {
            "id": uuid.uuid4(),
            "name": settings.PLATFORM_ADMIN_NAME,
            "email": email.strip().lower(),  # stored lowercase, like sign-up does
            "password_hash": hash_password(password),
        },
    )


def downgrade() -> None:
    # Deliberately does nothing: deleting or demoting an admin who may have done
    # real work is worse than leaving them. Remove them by hand if you need to.
    pass
