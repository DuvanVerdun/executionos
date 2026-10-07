"""Add account-scoped session submission IDs for safe retries."""
from alembic import op
import sqlalchemy as sa

revision = 'b42a8c91d305'
down_revision = '713b3efed33c'
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table('sessions') as batch_op:
        batch_op.add_column(sa.Column('submission_id', sa.String(36), nullable=True))
        batch_op.create_unique_constraint('uq_sessions_user_submission', ['user_id', 'submission_id'])


def downgrade() -> None:
    with op.batch_alter_table('sessions') as batch_op:
        batch_op.drop_constraint('uq_sessions_user_submission', type_='unique')
        batch_op.drop_column('submission_id')
