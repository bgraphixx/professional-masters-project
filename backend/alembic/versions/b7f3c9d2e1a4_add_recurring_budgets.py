"""add recurring budget support

Revision ID: b7f3c9d2e1a4
Revises: a1c2d3e4f5g6
Create Date: 2026-08-24 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'b7f3c9d2e1a4'
down_revision: Union[str, None] = 'a1c2d3e4f5g6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('budgets', sa.Column('is_recurring', sa.Boolean(), server_default=sa.text('false'), nullable=False))
    op.add_column('budgets', sa.Column('series_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.create_index(op.f('ix_budgets_series_id'), 'budgets', ['series_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_budgets_series_id'), table_name='budgets')
    op.drop_column('budgets', 'series_id')
    op.drop_column('budgets', 'is_recurring')
