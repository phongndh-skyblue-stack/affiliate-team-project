"""add project search links

Revision ID: 2a7c9d4e6b10
Revises: 1f9a7c2d8e31
Create Date: 2026-06-16 00:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "2a7c9d4e6b10"
down_revision = "1f9a7c2d8e31"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("affiliate_links", sa.Column("name", sa.String(length=255), nullable=True))
    op.add_column("affiliate_links", sa.Column("search_query", sa.String(length=500), nullable=True))

    for table_name in (
        "manual_competitor_searches",
        "ad_transparency_searches",
        "google_ads_searches",
        "google_ads_search_schedules",
    ):
        op.add_column(table_name, sa.Column("project_id", sa.String(length=36), nullable=True))
        op.add_column(table_name, sa.Column("project_name", sa.String(length=255), nullable=True))
        op.create_index(op.f(f"ix_{table_name}_project_id"), table_name, ["project_id"], unique=False)


def downgrade() -> None:
    for table_name in (
        "google_ads_search_schedules",
        "google_ads_searches",
        "ad_transparency_searches",
        "manual_competitor_searches",
    ):
        op.drop_index(op.f(f"ix_{table_name}_project_id"), table_name=table_name)
        op.drop_column(table_name, "project_name")
        op.drop_column(table_name, "project_id")

    op.drop_column("affiliate_links", "search_query")
    op.drop_column("affiliate_links", "name")
