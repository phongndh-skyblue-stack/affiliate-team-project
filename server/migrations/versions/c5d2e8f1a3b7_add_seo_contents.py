"""add seo contents

Revision ID: c5d2e8f1a3b7
Revises: b46f0d8a8c22
Create Date: 2026-06-12 00:00:00.000000
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "c5d2e8f1a3b7"
down_revision = "b46f0d8a8c22"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "seo_contents",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("project_name", sa.String(length=255), nullable=True),
        sa.Column("final_url", sa.Text(), nullable=True),
        sa.Column("display_path", sa.String(length=255), nullable=True),
        sa.Column("seo_title", sa.Text(), nullable=True),
        sa.Column("meta_description", sa.Text(), nullable=True),
        sa.Column("headlines", sa.JSON(), nullable=False),
        sa.Column("descriptions", sa.JSON(), nullable=False),
        sa.Column("keywords", sa.JSON(), nullable=False),
        sa.Column("body_content", sa.Text(), nullable=True),
        sa.Column("user_persona", sa.Text(), nullable=True),
        sa.Column("seo_score", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_seo_contents_project_name"), "seo_contents", ["project_name"], unique=False)
    op.create_index(op.f("ix_seo_contents_user_id"), "seo_contents", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_seo_contents_user_id"), table_name="seo_contents")
    op.drop_index(op.f("ix_seo_contents_project_name"), table_name="seo_contents")
    op.drop_table("seo_contents")
