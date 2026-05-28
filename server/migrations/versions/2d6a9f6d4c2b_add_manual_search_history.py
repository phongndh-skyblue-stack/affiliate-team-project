"""add manual search history

Revision ID: 2d6a9f6d4c2b
Revises: 6ca679b9dd70
Create Date: 2026-05-28 19:25:00.000000
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "2d6a9f6d4c2b"
down_revision = "6ca679b9dd70"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "manual_competitor_searches",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=True),
        sa.Column("keyword", sa.String(length=255), nullable=False),
        sa.Column("google_url", sa.Text(), nullable=False),
        sa.Column("location", sa.String(length=100), nullable=False),
        sa.Column("hl", sa.String(length=10), nullable=False),
        sa.Column("gl", sa.String(length=10), nullable=False),
        sa.Column("num", sa.Integer(), nullable=False),
        sa.Column("no_cache", sa.Boolean(), nullable=False),
        sa.Column("total_ads_found", sa.Integer(), nullable=False),
        sa.Column("top_ads_count", sa.Integer(), nullable=False),
        sa.Column("bottom_ads_count", sa.Integer(), nullable=False),
        sa.Column("raw_data", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_manual_competitor_searches_keyword"),
        "manual_competitor_searches",
        ["keyword"],
        unique=False,
    )
    op.create_index(
        op.f("ix_manual_competitor_searches_user_id"),
        "manual_competitor_searches",
        ["user_id"],
        unique=False,
    )
    op.create_table(
        "manual_competitor_search_ads",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("search_id", sa.String(length=36), nullable=False),
        sa.Column("position", sa.String(length=50), nullable=False),
        sa.Column("advertiser", sa.Text(), nullable=False),
        sa.Column("title", sa.Text(), nullable=False),
        sa.Column("snippet", sa.Text(), nullable=False),
        sa.Column("link", sa.Text(), nullable=False),
        sa.Column("sitelinks", sa.JSON(), nullable=False),
        sa.Column("type", sa.String(length=50), nullable=False),
        sa.Column("raw_data", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["search_id"], ["manual_competitor_searches.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_manual_competitor_search_ads_search_id"),
        "manual_competitor_search_ads",
        ["search_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_manual_competitor_search_ads_search_id"), table_name="manual_competitor_search_ads")
    op.drop_table("manual_competitor_search_ads")
    op.drop_index(op.f("ix_manual_competitor_searches_user_id"), table_name="manual_competitor_searches")
    op.drop_index(op.f("ix_manual_competitor_searches_keyword"), table_name="manual_competitor_searches")
    op.drop_table("manual_competitor_searches")