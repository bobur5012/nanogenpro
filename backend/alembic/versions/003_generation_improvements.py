"""
Add idempotency and cancellation support to generations

Revision ID: 003
Revises: 002
Create Date: 2026-01-26 21:30:00
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers
revision = '003'
down_revision = '002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Add fields for:
    - Idempotency protection
    - Cancellation support
    - Better status tracking
    """
    
    # Add idempotency_key for duplicate protection
    op.add_column('generations', sa.Column('idempotency_key', sa.String(64), nullable=True))
    op.create_index('ix_generations_idempotency', 'generations', ['user_id', 'idempotency_key'], unique=False)
    
    # Add CANCELLED status support (enum update handled by SQLAlchemy)
    # SQLAlchemy will automatically handle enum migration
    
    # Add timeout tracking
    op.add_column('generations', sa.Column('timeout_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    """Reverse the changes"""
    op.drop_index('ix_generations_idempotency', 'generations')
    op.drop_column('generations', 'idempotency_key')
    op.drop_column('generations', 'timeout_at')
