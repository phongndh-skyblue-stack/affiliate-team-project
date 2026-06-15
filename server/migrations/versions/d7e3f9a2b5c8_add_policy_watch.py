"""add policy watch tables

Revision ID: d7e3f9a2b5c8
Revises: c5d2e8f1a3b7
Create Date: 2026-06-12 00:00:00.000000
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "d7e3f9a2b5c8"
down_revision = "c5d2e8f1a3b7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "policy_watch_snapshots",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("source_url", sa.String(length=500), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=True),
        sa.Column("content_hash", sa.String(length=64), nullable=False),
        sa.Column("content_text", sa.Text(), nullable=False),
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("changed_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_policy_watch_snapshots_source_url"),
        "policy_watch_snapshots",
        ["source_url"],
        unique=True,
    )

    op.create_table(
        "policy_change_events",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("source_url", sa.String(length=500), nullable=False),
        sa.Column("title", sa.String(length=500), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("diff_excerpt", sa.Text(), nullable=True),
        sa.Column("detected_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_policy_change_events_source_url"),
        "policy_change_events",
        ["source_url"],
        unique=False,
    )
    op.create_index(
        op.f("ix_policy_change_events_detected_at"),
        "policy_change_events",
        ["detected_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_policy_change_events_detected_at"), table_name="policy_change_events")
    op.drop_index(op.f("ix_policy_change_events_source_url"), table_name="policy_change_events")
    op.drop_table("policy_change_events")
    op.drop_index(op.f("ix_policy_watch_snapshots_source_url"), table_name="policy_watch_snapshots")
    op.drop_table("policy_watch_snapshots")
