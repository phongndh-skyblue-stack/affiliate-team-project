"""add daily search ads schedules

Revision ID: 9bb3c7e8d4a1
Revises: 75144f9f02c8
Create Date: 2026-06-04 00:00:00.000000
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "9bb3c7e8d4a1"
down_revision = "75144f9f02c8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "google_ads_search_schedules",
        sa.Column("schedule_mode", sa.String(length=20), nullable=False, server_default="once"),
    )
    op.add_column("google_ads_search_schedules", sa.Column("daily_time", sa.String(length=5), nullable=True))
    op.add_column(
        "google_ads_search_schedules",
        sa.Column("notify_telegram_on_change", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index(
        op.f("ix_google_ads_search_schedules_schedule_mode"),
        "google_ads_search_schedules",
        ["schedule_mode"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_google_ads_search_schedules_schedule_mode"), table_name="google_ads_search_schedules")
    op.drop_column("google_ads_search_schedules", "notify_telegram_on_change")
    op.drop_column("google_ads_search_schedules", "daily_time")
    op.drop_column("google_ads_search_schedules", "schedule_mode")
