"""add platform column to policy watch tables

Revision ID: e9f4a1c6d2b9
Revises: d7e3f9a2b5c8
Create Date: 2026-06-15 00:00:00.000000
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "e9f4a1c6d2b9"
down_revision = "d7e3f9a2b5c8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "policy_watch_snapshots",
        sa.Column("platform", sa.String(length=50), nullable=False, server_default="Google Ads"),
    )
    op.create_index(
        op.f("ix_policy_watch_snapshots_platform"), "policy_watch_snapshots", ["platform"], unique=False
    )
    op.add_column(
        "policy_change_events",
        sa.Column("platform", sa.String(length=50), nullable=False, server_default="Google Ads"),
    )
    op.create_index(
        op.f("ix_policy_change_events_platform"), "policy_change_events", ["platform"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_policy_change_events_platform"), table_name="policy_change_events")
    op.drop_column("policy_change_events", "platform")
    op.drop_index(op.f("ix_policy_watch_snapshots_platform"), table_name="policy_watch_snapshots")
    op.drop_column("policy_watch_snapshots", "platform")
