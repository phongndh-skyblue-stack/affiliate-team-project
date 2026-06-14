"""add ads strategy skill tables

Revision ID: 1f9a7c2d8e31
Revises: c8f1d2a9b7e4
Create Date: 2026-06-13 00:00:00.000000
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "1f9a7c2d8e31"
down_revision = "c8f1d2a9b7e4"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ads_strategy_api_keys",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("display_name", sa.String(length=120), nullable=False),
        sa.Column("provider", sa.String(length=40), nullable=False),
        sa.Column("model_name", sa.String(length=80), nullable=False),
        sa.Column("encrypted_api_key", sa.Text(), nullable=False),
        sa.Column("api_key_last4", sa.String(length=8), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("last_error", sa.Text(), nullable=True),
        sa.Column("last_used_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_ads_strategy_api_keys_user_id"), "ads_strategy_api_keys", ["user_id"], unique=False)

    op.create_table(
        "ads_strategy_prompts",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("name", sa.String(length=160), nullable=False),
        sa.Column("prompt_template", sa.Text(), nullable=False),
        sa.Column("input_fields", sa.JSON(), nullable=False),
        sa.Column("is_default", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_ads_strategy_prompts_user_id"), "ads_strategy_prompts", ["user_id"], unique=False)

    op.create_table(
        "ads_strategy_results",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("prompt_id", sa.String(length=36), nullable=True),
        sa.Column("api_key_id", sa.String(length=36), nullable=True),
        sa.Column("title", sa.String(length=255), nullable=False),
        sa.Column("website_url", sa.Text(), nullable=False),
        sa.Column("market", sa.String(length=120), nullable=False),
        sa.Column("budget", sa.String(length=120), nullable=False),
        sa.Column("notes", sa.Text(), nullable=False),
        sa.Column("model_name", sa.String(length=80), nullable=False),
        sa.Column("prompt_text", sa.Text(), nullable=False),
        sa.Column("response_text", sa.Text(), nullable=False),
        sa.Column("raw_response", sa.JSON(), nullable=True),
        sa.Column("input_values", sa.JSON(), nullable=False),
        sa.Column("prompt_tokens", sa.Integer(), nullable=True),
        sa.Column("response_tokens", sa.Integer(), nullable=True),
        sa.Column("total_tokens", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["api_key_id"], ["ads_strategy_api_keys.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["prompt_id"], ["ads_strategy_prompts.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(op.f("ix_ads_strategy_results_api_key_id"), "ads_strategy_results", ["api_key_id"], unique=False)
    op.create_index(op.f("ix_ads_strategy_results_prompt_id"), "ads_strategy_results", ["prompt_id"], unique=False)
    op.create_index(op.f("ix_ads_strategy_results_user_id"), "ads_strategy_results", ["user_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_ads_strategy_results_user_id"), table_name="ads_strategy_results")
    op.drop_index(op.f("ix_ads_strategy_results_prompt_id"), table_name="ads_strategy_results")
    op.drop_index(op.f("ix_ads_strategy_results_api_key_id"), table_name="ads_strategy_results")
    op.drop_table("ads_strategy_results")
    op.drop_index(op.f("ix_ads_strategy_prompts_user_id"), table_name="ads_strategy_prompts")
    op.drop_table("ads_strategy_prompts")
    op.drop_index(op.f("ix_ads_strategy_api_keys_user_id"), table_name="ads_strategy_api_keys")
    op.drop_table("ads_strategy_api_keys")
