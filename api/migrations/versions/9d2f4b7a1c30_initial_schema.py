"""initial schema

Revision ID: 9d2f4b7a1c30
Revises:
Create Date: 2026-11-17 12:00:00.000000

Written by hand: autogenerate doesn't create the vector extension and is
unreliable with expression and partial indexes. `uv run alembic check` confirms
it matches the models.
"""

from collections.abc import Sequence

import pgvector.sqlalchemy
import sqlalchemy as sa
from alembic import op

revision: str = "9d2f4b7a1c30"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS vector")

    op.create_table(
        "buildings",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("address", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_buildings")),
    )
    op.create_index(
        "uq_buildings_active_name",
        "buildings",
        [sa.text("lower(name)")],
        unique=True,
        postgresql_where=sa.text("is_active"),
    )

    op.create_table(
        "users",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=False),
        sa.Column(
            "role",
            sa.Enum("unassigned", "building_admin", "platform_admin", name="user_role"),
            server_default="unassigned",
            nullable=False,
        ),
        sa.Column("building_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_users")),
        sa.ForeignKeyConstraint(
            ["building_id"], ["buildings.id"], name=op.f("fk_users_building_id_buildings"), ondelete="RESTRICT"
        ),
        sa.CheckConstraint(
            "(role = 'building_admin' AND building_id IS NOT NULL) OR (role <> 'building_admin' AND building_id IS NULL)",
            name=op.f("ck_users_building_admin_has_building"),
        ),
    )
    op.create_index("uq_users_email", "users", [sa.text("lower(email)")], unique=True)
    op.create_index(op.f("ix_users_building_id"), "users", ["building_id"])

    op.create_table(
        "terminals",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("building_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_terminals")),
        sa.ForeignKeyConstraint(
            ["building_id"], ["buildings.id"], name=op.f("fk_terminals_building_id_buildings"), ondelete="RESTRICT"
        ),
        sa.UniqueConstraint("id", "building_id", name=op.f("uq_terminals_id_building_id")),
    )
    op.create_index(op.f("ix_terminals_building_id"), "terminals", ["building_id"])
    op.create_index(
        "uq_terminals_active_name",
        "terminals",
        ["building_id", sa.text("lower(name)")],
        unique=True,
        postgresql_where=sa.text("is_active"),
    )

    op.create_table(
        "people",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("building_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("apartment", sa.String(length=255), nullable=False),
        sa.Column("photo", sa.LargeBinary(), nullable=False),
        sa.Column("embedding", pgvector.sqlalchemy.Vector(dim=128), nullable=False),
        sa.Column("is_active", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_people")),
        sa.ForeignKeyConstraint(
            ["building_id"], ["buildings.id"], name=op.f("fk_people_building_id_buildings"), ondelete="RESTRICT"
        ),
        sa.UniqueConstraint("id", "building_id", name=op.f("uq_people_id_building_id")),
    )
    op.create_index(op.f("ix_people_building_id"), "people", ["building_id"])

    op.create_table(
        "access_events",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("building_id", sa.Uuid(), nullable=False),
        sa.Column("terminal_id", sa.Uuid(), nullable=False),
        sa.Column("person_id", sa.Uuid(), nullable=True),
        sa.Column("result", sa.Enum("granted", "denied", name="access_result"), nullable=False),
        sa.Column("score", sa.Float(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_access_events")),
        sa.ForeignKeyConstraint(
            ["building_id"], ["buildings.id"], name=op.f("fk_access_events_building_id_buildings"), ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(
            ["terminal_id", "building_id"],
            ["terminals.id", "terminals.building_id"],
            name=op.f("fk_access_events_terminal_id_building_id_terminals"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["person_id", "building_id"],
            ["people.id", "people.building_id"],
            name=op.f("fk_access_events_person_id_building_id_people"),
            ondelete="RESTRICT",
        ),
        sa.CheckConstraint(
            "(result = 'granted' AND person_id IS NOT NULL) OR (result = 'denied' AND person_id IS NULL)",
            name=op.f("ck_access_events_include_person_id_only_when_granted"),
        ),
    )
    op.create_index("ix_access_events_building_newest", "access_events", ["building_id", sa.text("created_at DESC")])


def downgrade() -> None:
    op.drop_table("access_events")
    sa.Enum(name="access_result").drop(op.get_bind(), checkfirst=True)
    op.drop_table("people")
    op.drop_table("terminals")
    op.drop_table("users")
    sa.Enum(name="user_role").drop(op.get_bind(), checkfirst=True)
    op.drop_table("buildings")
    op.execute("DROP EXTENSION IF EXISTS vector")
