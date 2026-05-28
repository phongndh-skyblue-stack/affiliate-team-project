"""drop legacy ads column from manual competitor searches

Revision ID: 8b9d2a1c4f77
Revises: 2d6a9f6d4c2b
Create Date: 2026-05-28 20:35:00.000000
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "8b9d2a1c4f77"
down_revision = "2d6a9f6d4c2b"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("manual_competitor_searches")}

    if "ads" in columns:
        with op.batch_alter_table("manual_competitor_searches") as batch_op:
            batch_op.drop_column("ads")


def downgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    columns = {column["name"] for column in inspector.get_columns("manual_competitor_searches")}

    if "ads" not in columns:
        with op.batch_alter_table("manual_competitor_searches") as batch_op:
            batch_op.add_column(sa.Column("ads", sa.JSON(), nullable=False, server_default="[]"))
