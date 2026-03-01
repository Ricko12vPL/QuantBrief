"""Initial schema with users, briefs, portfolio, watchlist, schedules, usage_logs

Revision ID: 001
Revises:
Create Date: 2026-03-01
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("email", sa.String(320), unique=True, nullable=False),
        sa.Column("hashed_password", sa.String(256), nullable=False),
        sa.Column("display_name", sa.String(100), server_default=""),
        sa.Column("tier", sa.String(20), server_default="free"),
        sa.Column("language_preference", sa.String(5), server_default="en"),
        sa.Column("is_active", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    op.create_table(
        "briefs",
        sa.Column("id", sa.String(12), primary_key=True),
        sa.Column("user_id", sa.String(32), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("executive_summary", sa.Text(), server_default=""),
        sa.Column("data", sa.JSON(), nullable=False),
        sa.Column("language", sa.String(5), server_default="en"),
        sa.Column("watchlist_tickers", sa.JSON(), nullable=True),
        sa.Column("overall_sentiment", sa.String(20), server_default="neutral"),
        sa.Column("confidence_score", sa.Float(), server_default=sa.text("0.5")),
        sa.Column("audio_url", sa.String(500), server_default=""),
        sa.Column("generated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_briefs_user_generated", "briefs", ["user_id", "generated_at"])

    op.create_table(
        "portfolio_positions",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("user_id", sa.String(32), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ticker", sa.String(10), nullable=False),
        sa.Column("shares", sa.Float(), nullable=False),
        sa.Column("avg_price", sa.Float(), nullable=False),
        sa.Column("company_name", sa.String(200), server_default=""),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index(
        "ix_portfolio_user_ticker", "portfolio_positions",
        ["user_id", "ticker"], unique=True,
    )

    op.create_table(
        "watchlist_items",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("user_id", sa.String(32), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("ticker", sa.String(10), nullable=False),
        sa.Column("company_name", sa.String(200), server_default=""),
        sa.Column("notes", sa.Text(), server_default=""),
        sa.Column("added_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index(
        "ix_watchlist_user_ticker", "watchlist_items",
        ["user_id", "ticker"], unique=True,
    )

    op.create_table(
        "schedules",
        sa.Column("id", sa.String(12), primary_key=True),
        sa.Column("user_id", sa.String(32), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(100), server_default="Unnamed Schedule"),
        sa.Column("ticker_source", sa.String(20), server_default="watchlist"),
        sa.Column("tickers", sa.JSON(), nullable=True),
        sa.Column("frequency", sa.String(20), server_default="daily"),
        sa.Column("hour", sa.Integer(), server_default=sa.text("9")),
        sa.Column("minute", sa.Integer(), server_default=sa.text("0")),
        sa.Column("day_of_week", sa.Integer(), server_default=sa.text("0")),
        sa.Column("language", sa.String(5), server_default="en"),
        sa.Column("generate_audio", sa.Boolean(), server_default=sa.text("true")),
        sa.Column("paused", sa.Boolean(), server_default=sa.text("false")),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column("last_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("next_run_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_brief_id", sa.String(12), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_schedules_user_id", "schedules", ["user_id"])

    op.create_table(
        "usage_logs",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("user_id", sa.String(32), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("action", sa.String(50), nullable=False),
        sa.Column("metadata", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index(
        "ix_usage_user_action_date", "usage_logs",
        ["user_id", "action", "created_at"],
    )


def downgrade() -> None:
    op.drop_table("usage_logs")
    op.drop_table("schedules")
    op.drop_table("watchlist_items")
    op.drop_table("portfolio_positions")
    op.drop_table("briefs")
    op.drop_table("users")
