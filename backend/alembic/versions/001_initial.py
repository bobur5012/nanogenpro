"""Initial migration

Revision ID: 001
Revises: 
Create Date: 2026-01-26

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Users table
    op.create_table(
        'users',
        sa.Column('id', sa.BigInteger(), nullable=False),
        sa.Column('username', sa.String(255), nullable=True),
        sa.Column('first_name', sa.String(255), nullable=True),
        sa.Column('last_name', sa.String(255), nullable=True),
        sa.Column('language_code', sa.String(10), default='ru'),
        sa.Column('credits', sa.Integer(), default=10),
        sa.Column('referrer_id', sa.BigInteger(), nullable=True),
        sa.Column('referral_code', sa.String(32), nullable=True, unique=True),
        sa.Column('referral_earnings', sa.Integer(), default=0),
        sa.Column('referral_balance', sa.Integer(), default=0),
        sa.Column('saved_card', sa.String(20), nullable=True),
        sa.Column('total_generations', sa.Integer(), default=0),
        sa.Column('total_spent', sa.Integer(), default=0),
        sa.Column('is_banned', sa.Boolean(), default=False),
        sa.Column('is_premium', sa.Boolean(), default=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now()),
        sa.Column('last_active_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_users_id', 'users', ['id'])
    op.create_index('ix_users_referral_code', 'users', ['referral_code'], unique=True)

    # Generations table
    op.create_table(
        'generations',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.BigInteger(), nullable=False),
        sa.Column('model_id', sa.String(100), nullable=False),
        sa.Column('model_name', sa.String(100), nullable=False),
        sa.Column('generation_type', sa.String(20), nullable=False),
        sa.Column('prompt', sa.Text(), nullable=False),
        sa.Column('negative_prompt', sa.Text(), nullable=True),
        sa.Column('parameters', sa.Text(), nullable=True),
        sa.Column('aiml_task_id', sa.String(255), nullable=True),
        sa.Column('status', sa.String(20), default='pending'),
        sa.Column('result_url', sa.Text(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('credits_charged', sa.Integer(), default=0),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_generations_user_id', 'generations', ['user_id'])

    # Transactions table
    op.create_table(
        'transactions',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.BigInteger(), nullable=False),
        sa.Column('type', sa.String(20), nullable=False),
        sa.Column('amount', sa.Integer(), nullable=False),
        sa.Column('amount_uzs', sa.Integer(), nullable=True),
        sa.Column('payment_method', sa.String(50), nullable=True),
        sa.Column('payment_screenshot', sa.Text(), nullable=True),
        sa.Column('payment_status', sa.String(20), default='pending'),
        sa.Column('reference_id', sa.BigInteger(), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_transactions_user_id', 'transactions', ['user_id'])

    # Referrals table
    op.create_table(
        'referrals',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('referrer_id', sa.BigInteger(), nullable=False),
        sa.Column('referred_id', sa.BigInteger(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_referrals_referrer_id', 'referrals', ['referrer_id'])


def downgrade() -> None:
    op.drop_table('referrals')
    op.drop_table('transactions')
    op.drop_table('generations')
    op.drop_table('users')
