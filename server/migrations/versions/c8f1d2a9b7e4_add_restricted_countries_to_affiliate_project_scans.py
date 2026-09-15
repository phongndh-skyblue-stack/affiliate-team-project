"""add restricted countries to affiliate project scans

Revision ID: c8f1d2a9b7e4
Revises: b46f0d8a8c22
Create Date: 2026-06-05 12:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "c8f1d2a9b7e4"
down_revision = "b46f0d8a8c22"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "affiliate_link_project_data_scans",
        sa.Column("restricted_countries", sa.JSON(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("affiliate_link_project_data_scans", "restricted_countries")
