"""add brand keyword scans

Revision ID: d2b7c9a1e5f0
Revises: c8f1d2a9b7e4
Create Date: 2026-06-13 10:45:00.000000
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "d2b7c9a1e5f0"
down_revision = "c8f1d2a9b7e4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "affiliate_link_brand_keyword_scans",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("affiliate_link_id", sa.String(length=36), nullable=False),
        sa.Column("country", sa.Integer(), nullable=False),
        sa.Column("duration", sa.String(length=16), nullable=False),
        sa.Column("traffic_source", sa.String(length=16), nullable=False),
        sa.Column("total_keywords", sa.Integer(), nullable=False),
        sa.Column("total_clicks", sa.Integer(), nullable=False),
        sa.Column("top_keyword", sa.String(length=255), nullable=True),
        sa.Column("keywords", sa.JSON(), nullable=True),
        sa.Column("raw_data", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["affiliate_link_id"], ["affiliate_links.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_affiliate_link_brand_keyword_scans_affiliate_link_id"),
        "affiliate_link_brand_keyword_scans",
        ["affiliate_link_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        op.f("ix_affiliate_link_brand_keyword_scans_affiliate_link_id"),
        table_name="affiliate_link_brand_keyword_scans",
    )
    op.drop_table("affiliate_link_brand_keyword_scans")
