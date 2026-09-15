"""add project to keyword planner jobs

Revision ID: 3d8e1f4a9c20
Revises: 2a7c9d4e6b10
Create Date: 2026-06-23 00:00:00.000000
"""

from alembic import op
import sqlalchemy as sa


revision = "3d8e1f4a9c20"
down_revision = "2a7c9d4e6b10"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("keyword_planner_jobs", sa.Column("project_id", sa.String(length=36), nullable=True))
    op.add_column("keyword_planner_jobs", sa.Column("project_name", sa.String(length=255), nullable=True))
    op.create_index(
        op.f("ix_keyword_planner_jobs_project_id"),
        "keyword_planner_jobs",
        ["project_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_keyword_planner_jobs_project_id"), table_name="keyword_planner_jobs")
    op.drop_column("keyword_planner_jobs", "project_name")
    op.drop_column("keyword_planner_jobs", "project_id")
