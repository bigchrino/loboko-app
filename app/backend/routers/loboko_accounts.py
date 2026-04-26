import json
import logging
from typing import List, Optional

from datetime import datetime, date

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.loboko_accounts import Loboko_accountsService

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/loboko_accounts", tags=["loboko_accounts"])


# ---------- Pydantic Schemas ----------
class Loboko_accountsData(BaseModel):
    """Entity data schema (for create/update)"""
    email: str
    password_hash: str
    role: str
    display_name: str
    atoms_user_id: str = None


class Loboko_accountsUpdateData(BaseModel):
    """Update entity data (partial updates allowed)"""
    email: Optional[str] = None
    password_hash: Optional[str] = None
    role: Optional[str] = None
    display_name: Optional[str] = None
    atoms_user_id: Optional[str] = None


class Loboko_accountsResponse(BaseModel):
    """Entity response schema"""
    id: int
    email: str
    password_hash: str
    role: str
    display_name: str
    atoms_user_id: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class Loboko_accountsListResponse(BaseModel):
    """List response schema"""
    items: List[Loboko_accountsResponse]
    total: int
    skip: int
    limit: int


class Loboko_accountsBatchCreateRequest(BaseModel):
    """Batch create request"""
    items: List[Loboko_accountsData]


class Loboko_accountsBatchUpdateItem(BaseModel):
    """Batch update item"""
    id: int
    updates: Loboko_accountsUpdateData


class Loboko_accountsBatchUpdateRequest(BaseModel):
    """Batch update request"""
    items: List[Loboko_accountsBatchUpdateItem]


class Loboko_accountsBatchDeleteRequest(BaseModel):
    """Batch delete request"""
    ids: List[int]


# ---------- Routes ----------
@router.get("", response_model=Loboko_accountsListResponse)
async def query_loboko_accountss(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    """Query loboko_accountss with filtering, sorting, and pagination"""
    logger.debug(f"Querying loboko_accountss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")
    
    service = Loboko_accountsService(db)
    try:
        # Parse query JSON if provided
        query_dict = None
        if query:
            try:
                query_dict = json.loads(query)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid query JSON format")
        
        result = await service.get_list(
            skip=skip, 
            limit=limit,
            query_dict=query_dict,
            sort=sort,
        )
        logger.debug(f"Found {result['total']} loboko_accountss")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying loboko_accountss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/all", response_model=Loboko_accountsListResponse)
async def query_loboko_accountss_all(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    # Query loboko_accountss with filtering, sorting, and pagination without user limitation
    logger.debug(f"Querying loboko_accountss: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = Loboko_accountsService(db)
    try:
        # Parse query JSON if provided
        query_dict = None
        if query:
            try:
                query_dict = json.loads(query)
            except json.JSONDecodeError:
                raise HTTPException(status_code=400, detail="Invalid query JSON format")

        result = await service.get_list(
            skip=skip,
            limit=limit,
            query_dict=query_dict,
            sort=sort
        )
        logger.debug(f"Found {result['total']} loboko_accountss")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying loboko_accountss: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{id}", response_model=Loboko_accountsResponse)
async def get_loboko_accounts(
    id: int,
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    """Get a single loboko_accounts by ID"""
    logger.debug(f"Fetching loboko_accounts with id: {id}, fields={fields}")
    
    service = Loboko_accountsService(db)
    try:
        result = await service.get_by_id(id)
        if not result:
            logger.warning(f"Loboko_accounts with id {id} not found")
            raise HTTPException(status_code=404, detail="Loboko_accounts not found")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching loboko_accounts {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("", response_model=Loboko_accountsResponse, status_code=201)
async def create_loboko_accounts(
    data: Loboko_accountsData,
    db: AsyncSession = Depends(get_db),
):
    """Create a new loboko_accounts"""
    logger.debug(f"Creating new loboko_accounts with data: {data}")
    
    service = Loboko_accountsService(db)
    try:
        result = await service.create(data.model_dump())
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create loboko_accounts")
        
        logger.info(f"Loboko_accounts created successfully with id: {result.id}")
        return result
    except ValueError as e:
        logger.error(f"Validation error creating loboko_accounts: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating loboko_accounts: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/batch", response_model=List[Loboko_accountsResponse], status_code=201)
async def create_loboko_accountss_batch(
    request: Loboko_accountsBatchCreateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Create multiple loboko_accountss in a single request"""
    logger.debug(f"Batch creating {len(request.items)} loboko_accountss")
    
    service = Loboko_accountsService(db)
    results = []
    
    try:
        for item_data in request.items:
            result = await service.create(item_data.model_dump())
            if result:
                results.append(result)
        
        logger.info(f"Batch created {len(results)} loboko_accountss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch create: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch create failed: {str(e)}")


@router.put("/batch", response_model=List[Loboko_accountsResponse])
async def update_loboko_accountss_batch(
    request: Loboko_accountsBatchUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    """Update multiple loboko_accountss in a single request"""
    logger.debug(f"Batch updating {len(request.items)} loboko_accountss")
    
    service = Loboko_accountsService(db)
    results = []
    
    try:
        for item in request.items:
            # Only include non-None values for partial updates
            update_dict = {k: v for k, v in item.updates.model_dump().items() if v is not None}
            result = await service.update(item.id, update_dict)
            if result:
                results.append(result)
        
        logger.info(f"Batch updated {len(results)} loboko_accountss successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch update: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch update failed: {str(e)}")


@router.put("/{id}", response_model=Loboko_accountsResponse)
async def update_loboko_accounts(
    id: int,
    data: Loboko_accountsUpdateData,
    db: AsyncSession = Depends(get_db),
):
    """Update an existing loboko_accounts"""
    logger.debug(f"Updating loboko_accounts {id} with data: {data}")

    service = Loboko_accountsService(db)
    try:
        # Only include non-None values for partial updates
        update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
        result = await service.update(id, update_dict)
        if not result:
            logger.warning(f"Loboko_accounts with id {id} not found for update")
            raise HTTPException(status_code=404, detail="Loboko_accounts not found")
        
        logger.info(f"Loboko_accounts {id} updated successfully")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error updating loboko_accounts {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating loboko_accounts {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/batch")
async def delete_loboko_accountss_batch(
    request: Loboko_accountsBatchDeleteRequest,
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple loboko_accountss by their IDs"""
    logger.debug(f"Batch deleting {len(request.ids)} loboko_accountss")
    
    service = Loboko_accountsService(db)
    deleted_count = 0
    
    try:
        for item_id in request.ids:
            success = await service.delete(item_id)
            if success:
                deleted_count += 1
        
        logger.info(f"Batch deleted {deleted_count} loboko_accountss successfully")
        return {"message": f"Successfully deleted {deleted_count} loboko_accountss", "deleted_count": deleted_count}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch delete: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch delete failed: {str(e)}")


@router.delete("/{id}")
async def delete_loboko_accounts(
    id: int,
    db: AsyncSession = Depends(get_db),
):
    """Delete a single loboko_accounts by ID"""
    logger.debug(f"Deleting loboko_accounts with id: {id}")
    
    service = Loboko_accountsService(db)
    try:
        success = await service.delete(id)
        if not success:
            logger.warning(f"Loboko_accounts with id {id} not found for deletion")
            raise HTTPException(status_code=404, detail="Loboko_accounts not found")
        
        logger.info(f"Loboko_accounts {id} deleted successfully")
        return {"message": "Loboko_accounts deleted successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting loboko_accounts {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")