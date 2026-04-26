import logging
from typing import Optional, Dict, Any, List

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from models.loboko_accounts import Loboko_accounts

logger = logging.getLogger(__name__)


# ------------------ Service Layer ------------------
class Loboko_accountsService:
    """Service layer for Loboko_accounts operations"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def create(self, data: Dict[str, Any]) -> Optional[Loboko_accounts]:
        """Create a new loboko_accounts"""
        try:
            obj = Loboko_accounts(**data)
            self.db.add(obj)
            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Created loboko_accounts with id: {obj.id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error creating loboko_accounts: {str(e)}")
            raise

    async def get_by_id(self, obj_id: int) -> Optional[Loboko_accounts]:
        """Get loboko_accounts by ID"""
        try:
            query = select(Loboko_accounts).where(Loboko_accounts.id == obj_id)
            result = await self.db.execute(query)
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching loboko_accounts {obj_id}: {str(e)}")
            raise

    async def get_list(
        self, 
        skip: int = 0, 
        limit: int = 20, 
        query_dict: Optional[Dict[str, Any]] = None,
        sort: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get paginated list of loboko_accountss"""
        try:
            query = select(Loboko_accounts)
            count_query = select(func.count(Loboko_accounts.id))
            
            if query_dict:
                for field, value in query_dict.items():
                    if hasattr(Loboko_accounts, field):
                        query = query.where(getattr(Loboko_accounts, field) == value)
                        count_query = count_query.where(getattr(Loboko_accounts, field) == value)
            
            count_result = await self.db.execute(count_query)
            total = count_result.scalar()

            if sort:
                if sort.startswith('-'):
                    field_name = sort[1:]
                    if hasattr(Loboko_accounts, field_name):
                        query = query.order_by(getattr(Loboko_accounts, field_name).desc())
                else:
                    if hasattr(Loboko_accounts, sort):
                        query = query.order_by(getattr(Loboko_accounts, sort))
            else:
                query = query.order_by(Loboko_accounts.id.desc())

            result = await self.db.execute(query.offset(skip).limit(limit))
            items = result.scalars().all()

            return {
                "items": items,
                "total": total,
                "skip": skip,
                "limit": limit,
            }
        except Exception as e:
            logger.error(f"Error fetching loboko_accounts list: {str(e)}")
            raise

    async def update(self, obj_id: int, update_data: Dict[str, Any]) -> Optional[Loboko_accounts]:
        """Update loboko_accounts"""
        try:
            obj = await self.get_by_id(obj_id)
            if not obj:
                logger.warning(f"Loboko_accounts {obj_id} not found for update")
                return None
            for key, value in update_data.items():
                if hasattr(obj, key):
                    setattr(obj, key, value)

            await self.db.commit()
            await self.db.refresh(obj)
            logger.info(f"Updated loboko_accounts {obj_id}")
            return obj
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error updating loboko_accounts {obj_id}: {str(e)}")
            raise

    async def delete(self, obj_id: int) -> bool:
        """Delete loboko_accounts"""
        try:
            obj = await self.get_by_id(obj_id)
            if not obj:
                logger.warning(f"Loboko_accounts {obj_id} not found for deletion")
                return False
            await self.db.delete(obj)
            await self.db.commit()
            logger.info(f"Deleted loboko_accounts {obj_id}")
            return True
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Error deleting loboko_accounts {obj_id}: {str(e)}")
            raise

    async def get_by_field(self, field_name: str, field_value: Any) -> Optional[Loboko_accounts]:
        """Get loboko_accounts by any field"""
        try:
            if not hasattr(Loboko_accounts, field_name):
                raise ValueError(f"Field {field_name} does not exist on Loboko_accounts")
            result = await self.db.execute(
                select(Loboko_accounts).where(getattr(Loboko_accounts, field_name) == field_value)
            )
            return result.scalar_one_or_none()
        except Exception as e:
            logger.error(f"Error fetching loboko_accounts by {field_name}: {str(e)}")
            raise

    async def list_by_field(
        self, field_name: str, field_value: Any, skip: int = 0, limit: int = 20
    ) -> List[Loboko_accounts]:
        """Get list of loboko_accountss filtered by field"""
        try:
            if not hasattr(Loboko_accounts, field_name):
                raise ValueError(f"Field {field_name} does not exist on Loboko_accounts")
            result = await self.db.execute(
                select(Loboko_accounts)
                .where(getattr(Loboko_accounts, field_name) == field_value)
                .offset(skip)
                .limit(limit)
                .order_by(Loboko_accounts.id.desc())
            )
            return result.scalars().all()
        except Exception as e:
            logger.error(f"Error fetching loboko_accountss by {field_name}: {str(e)}")
            raise