"""Add Payment and Withdrawal models, update User

Revision ID: 002_payment_withdrawal
Revises: 001_initial
Create Date: 2026-01-26

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '002_payment_withdrawal'
down_revision = '001_initial'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ========== CREATE PAYMENTS TABLE ==========
    op.create_table(
        'payments',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.BigInteger(), nullable=False),
        sa.Column('credits', sa.Integer(), nullable=False),
        sa.Column('amount_uzs', sa.Integer(), nullable=False),
        sa.Column('screenshot_url', sa.Text(), nullable=True),
        sa.Column('screenshot_data', sa.Text(), nullable=True),
        sa.Column('status', sa.Enum('pending', 'approved', 'rejected', name='paymentstatus'), nullable=True),
        sa.Column('admin_id', sa.BigInteger(), nullable=True),
        sa.Column('admin_message', sa.Text(), nullable=True),
        sa.Column('processed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('telegram_message_id', sa.BigInteger(), nullable=True),
        sa.Column('referrer_id', sa.BigInteger(), nullable=True),
        sa.Column('referral_commission', sa.Integer(), default=0),
        sa.Column('idempotency_key', sa.String(64), unique=True, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_payments_user_id', 'payments', ['user_id'], unique=False)
    op.create_index('ix_payments_status', 'payments', ['status'], unique=False)

    # ========== CREATE WITHDRAWALS TABLE ==========
    op.create_table(
        'withdrawals',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.BigInteger(), nullable=False),
        sa.Column('amount_uzs', sa.Integer(), nullable=False),
        sa.Column('card_number', sa.String(20), nullable=False),
        sa.Column('card_type', sa.Enum('uzcard', 'humo', name='cardtype'), nullable=False),
        sa.Column('card_holder', sa.String(100), nullable=True),
        sa.Column('status', sa.Enum('pending', 'frozen', 'approved', 'rejected', name='withdrawalstatus'), nullable=True),
        sa.Column('admin_id', sa.BigInteger(), nullable=True),
        sa.Column('admin_message', sa.Text(), nullable=True),
        sa.Column('processed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('telegram_message_id', sa.BigInteger(), nullable=True),
        sa.Column('idempotency_key', sa.String(64), unique=True, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_withdrawals_user_id', 'withdrawals', ['user_id'], unique=False)
    op.create_index('ix_withdrawals_status', 'withdrawals', ['status'], unique=False)

    # ========== UPDATE USERS TABLE ==========
    # New referral fields
    op.add_column('users', sa.Column('referral_total_earned', sa.Integer(), default=0))
    op.add_column('users', sa.Column('referral_withdrawn', sa.Integer(), default=0))
    op.add_column('users', sa.Column('referrals_count', sa.Integer(), default=0))
    op.add_column('users', sa.Column('referrals_active', sa.Integer(), default=0))
    
    # Payment card fields
    op.add_column('users', sa.Column('saved_card_number', sa.String(20), nullable=True))
    op.add_column('users', sa.Column('saved_card_type', sa.String(10), nullable=True))
    
    # Stats
    op.add_column('users', sa.Column('total_spent_uzs', sa.Integer(), default=0))
    op.add_column('users', sa.Column('total_spent_credits', sa.Integer(), default=0))
    
    # Status
    op.add_column('users', sa.Column('is_admin', sa.Boolean(), default=False))
    
    # Timestamps
    op.add_column('users', sa.Column('first_payment_at', sa.DateTime(timezone=True), nullable=True))

    # Rename old columns if they exist (handle migration from old schema)
    # Try to rename referral_earnings -> referral_total_earned if exists
    try:
        op.execute("UPDATE users SET referral_total_earned = COALESCE(referral_earnings, 0) WHERE referral_total_earned IS NULL")
    except:
        pass


def downgrade() -> None:
    # Drop new columns from users
    op.drop_column('users', 'first_payment_at')
    op.drop_column('users', 'is_admin')
    op.drop_column('users', 'total_spent_credits')
    op.drop_column('users', 'total_spent_uzs')
    op.drop_column('users', 'saved_card_type')
    op.drop_column('users', 'saved_card_number')
    op.drop_column('users', 'referrals_active')
    op.drop_column('users', 'referrals_count')
    op.drop_column('users', 'referral_withdrawn')
    op.drop_column('users', 'referral_total_earned')
    
    # Drop tables
    op.drop_index('ix_withdrawals_status', table_name='withdrawals')
    op.drop_index('ix_withdrawals_user_id', table_name='withdrawals')
    op.drop_table('withdrawals')
    
    op.drop_index('ix_payments_status', table_name='payments')
    op.drop_index('ix_payments_user_id', table_name='payments')
    op.drop_table('payments')
    
    # Drop enums
    op.execute('DROP TYPE IF EXISTS withdrawalstatus')
    op.execute('DROP TYPE IF EXISTS cardtype')
    op.execute('DROP TYPE IF EXISTS paymentstatus')
