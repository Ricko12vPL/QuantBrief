from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import UsageLogRow


async def log_usage(db: AsyncSession, user_id: str, action: str, metadata: dict | None = None) -> None:
    row = UsageLogRow(user_id=user_id, action=action, metadata_=metadata)
    db.add(row)
