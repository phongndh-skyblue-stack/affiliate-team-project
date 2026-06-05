"""add google ads saved competitors

Revision ID: b46f0d8a8c22
Revises: 9bb3c7e8d4a1
Create Date: 2026-06-05 00:00:00.000000
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "b46f0d8a8c22"
down_revision = "9bb3c7e8d4a1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "google_ads_saved_competitors",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("keyword", sa.String(length=255), nullable=False),
        sa.Column("keyword_key", sa.String(length=255), nullable=False),
        sa.Column("advertiser_name", sa.Text(), nullable=False),
        sa.Column("advertiser_key", sa.String(length=255), nullable=False),
        sa.Column("advertiser_domain", sa.Text(), nullable=True),
        sa.Column("advertiser_location", sa.Text(), nullable=True),
        sa.Column("title", sa.Text(), nullable=True),
        sa.Column("snippet", sa.Text(), nullable=True),
        sa.Column("display_url", sa.Text(), nullable=True),
        sa.Column("target_url", sa.Text(), nullable=True),
        sa.Column("position", sa.Integer(), nullable=True),
        sa.Column("confidence", sa.Float(), nullable=False),
        sa.Column("landing_page", sa.JSON(), nullable=True),
        sa.Column("source_search_id", sa.String(length=36), nullable=True),
        sa.Column("source_ad_id", sa.String(length=36), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["source_ad_id"], ["google_ads_search_ads.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["source_search_id"], ["google_ads_searches.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "keyword_key", "advertiser_key", name="uq_google_ads_saved_competitor"),
    )
    op.create_index(op.f("ix_google_ads_saved_competitors_advertiser_key"), "google_ads_saved_competitors", ["advertiser_key"], unique=False)
    op.create_index(op.f("ix_google_ads_saved_competitors_keyword"), "google_ads_saved_competitors", ["keyword"], unique=False)
    op.create_index(op.f("ix_google_ads_saved_competitors_keyword_key"), "google_ads_saved_competitors", ["keyword_key"], unique=False)
    op.create_index(op.f("ix_google_ads_saved_competitors_source_ad_id"), "google_ads_saved_competitors", ["source_ad_id"], unique=False)
    op.create_index(op.f("ix_google_ads_saved_competitors_source_search_id"), "google_ads_saved_competitors", ["source_search_id"], unique=False)
    op.create_index(op.f("ix_google_ads_saved_competitors_user_id"), "google_ads_saved_competitors", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_google_ads_saved_competitors_user_id"), table_name="google_ads_saved_competitors")
    op.drop_index(op.f("ix_google_ads_saved_competitors_source_search_id"), table_name="google_ads_saved_competitors")
    op.drop_index(op.f("ix_google_ads_saved_competitors_source_ad_id"), table_name="google_ads_saved_competitors")
    op.drop_index(op.f("ix_google_ads_saved_competitors_keyword_key"), table_name="google_ads_saved_competitors")
    op.drop_index(op.f("ix_google_ads_saved_competitors_keyword"), table_name="google_ads_saved_competitors")
    op.drop_index(op.f("ix_google_ads_saved_competitors_advertiser_key"), table_name="google_ads_saved_competitors")
    op.drop_table("google_ads_saved_competitors")
