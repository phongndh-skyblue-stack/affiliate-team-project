"""add keyword candidate projects

Revision ID: 4d2c8f1a9e70
Revises: 3d8e1f4a9c20
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "4d2c8f1a9e70"
down_revision: Union[str, None] = "3d8e1f4a9c20"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "keyword_candidate_projects",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("affiliate_project_id", sa.String(length=36), nullable=True),
        sa.Column("source_job_id", sa.String(length=36), nullable=True),
        sa.Column("source_ads_id", sa.String(length=50), nullable=True),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("tags", sa.JSON(), nullable=True),
        sa.Column("language_id", sa.Integer(), nullable=False),
        sa.Column("location_ids", sa.JSON(), nullable=True),
        sa.Column("website_url", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["affiliate_project_id"], ["affiliate_links.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["source_job_id"], ["keyword_planner_jobs.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_keyword_candidate_projects_user_id", "keyword_candidate_projects", ["user_id"])
    op.create_index("ix_keyword_candidate_projects_status", "keyword_candidate_projects", ["status"])
    op.create_index("ix_keyword_candidate_projects_affiliate_project_id", "keyword_candidate_projects", ["affiliate_project_id"])
    op.create_index("ix_keyword_candidate_projects_source_job_id", "keyword_candidate_projects", ["source_job_id"])
    op.create_index("ix_keyword_candidate_projects_source_ads_id", "keyword_candidate_projects", ["source_ads_id"])

    op.create_table(
        "keyword_candidate_items",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("candidate_id", sa.String(length=36), nullable=False),
        sa.Column("source_result_id", sa.String(length=36), nullable=True),
        sa.Column("keyword", sa.Text(), nullable=False),
        sa.Column("normalized_keyword", sa.String(length=500), nullable=False),
        sa.Column("avg_monthly_searches", sa.Integer(), nullable=False),
        sa.Column("competition", sa.String(length=50), nullable=False),
        sa.Column("competition_index", sa.Integer(), nullable=True),
        sa.Column("low_top_page_bid", sa.Float(), nullable=True),
        sa.Column("high_top_page_bid", sa.Float(), nullable=True),
        sa.Column("monthly_searches", sa.JSON(), nullable=True),
        sa.Column("inferred_intent", sa.String(length=30), nullable=False),
        sa.Column("manual_intent", sa.String(length=30), nullable=True),
        sa.Column("opportunity_score", sa.Integer(), nullable=False),
        sa.Column("opportunity_tier", sa.String(length=20), nullable=False),
        sa.Column("score_explanation", sa.Text(), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("tags", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["candidate_id"], ["keyword_candidate_projects.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["source_result_id"], ["keyword_planner_results.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("candidate_id", "normalized_keyword", name="uq_candidate_keyword"),
    )
    op.create_index("ix_keyword_candidate_items_candidate_id", "keyword_candidate_items", ["candidate_id"])


def downgrade() -> None:
    op.drop_index("ix_keyword_candidate_items_candidate_id", table_name="keyword_candidate_items")
    op.drop_table("keyword_candidate_items")
    op.drop_index("ix_keyword_candidate_projects_source_ads_id", table_name="keyword_candidate_projects")
    op.drop_index("ix_keyword_candidate_projects_source_job_id", table_name="keyword_candidate_projects")
    op.drop_index("ix_keyword_candidate_projects_affiliate_project_id", table_name="keyword_candidate_projects")
    op.drop_index("ix_keyword_candidate_projects_status", table_name="keyword_candidate_projects")
    op.drop_index("ix_keyword_candidate_projects_user_id", table_name="keyword_candidate_projects")
    op.drop_table("keyword_candidate_projects")
