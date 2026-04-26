import json
import logging
from typing import List, Optional

from datetime import datetime, date

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from services.likes import LikesService
from dependencies.auth import get_current_user
from schemas.auth import UserResponse

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/entities/likes", tags=["likes"])


# ---------- Pydantic Schemas ----------
class LikesData(BaseModel):
    """Entity data schema (for create/update)"""
    post_id: int


class LikesUpdateData(BaseModel):
    """Update entity data (partial updates allowed)"""
    post_id: Optional[int] = None


class LikesResponse(BaseModel):
    """Entity response schema"""
    id: int
    user_id: str
    post_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class LikesListResponse(BaseModel):
    """List response schema"""
    items: List[LikesResponse]
    total: int
    skip: int
    limit: int


class LikesBatchCreateRequest(BaseModel):
    """Batch create request"""
    items: List[LikesData]


class LikesBatchUpdateItem(BaseModel):
    """Batch update item"""
    id: int
    updates: LikesUpdateData


class LikesBatchUpdateRequest(BaseModel):
    """Batch update request"""
    items: List[LikesBatchUpdateItem]


class LikesBatchDeleteRequest(BaseModel):
    """Batch delete request"""
    ids: List[int]


# ---------- Routes ----------
@router.get("", response_model=LikesListResponse)
async def query_likess(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Query likess with filtering, sorting, and pagination (user can only see their own records)"""
    logger.debug(f"Querying likess: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")
    
    service = LikesService(db)
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
            user_id=str(current_user.id),
        )
        logger.debug(f"Found {result['total']} likess")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying likess: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/all", response_model=LikesListResponse)
async def query_likess_all(
    query: str = Query(None, description="Query conditions (JSON string)"),
    sort: str = Query(None, description="Sort field (prefix with '-' for descending)"),
    skip: int = Query(0, ge=0, description="Number of records to skip"),
    limit: int = Query(20, ge=1, le=2000, description="Max number of records to return"),
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    db: AsyncSession = Depends(get_db),
):
    # Query likess with filtering, sorting, and pagination without user limitation
    logger.debug(f"Querying likess: query={query}, sort={sort}, skip={skip}, limit={limit}, fields={fields}")

    service = LikesService(db)
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
        logger.debug(f"Found {result['total']} likess")
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error querying likess: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.get("/{id}", response_model=LikesResponse)
async def get_likes(
    id: int,
    fields: str = Query(None, description="Comma-separated list of fields to return"),
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get a single likes by ID (user can only see their own records)"""
    logger.debug(f"Fetching likes with id: {id}, fields={fields}")
    
    service = LikesService(db)
    try:
        result = await service.get_by_id(id, user_id=str(current_user.id))
        if not result:
            logger.warning(f"Likes with id {id} not found")
            raise HTTPException(status_code=404, detail="Likes not found")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching likes {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("", response_model=LikesResponse, status_code=201)
async def create_likes(
    data: LikesData,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create a new likes"""
    logger.debug(f"Creating new likes with data: {data}")
    
    service = LikesService(db)
    try:
        result = await service.create(data.model_dump(), user_id=str(current_user.id))
        if not result:
            raise HTTPException(status_code=400, detail="Failed to create likes")
        
        logger.info(f"Likes created successfully with id: {result.id}")
        return result
    except ValueError as e:
        logger.error(f"Validation error creating likes: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating likes: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.post("/batch", response_model=List[LikesResponse], status_code=201)
async def create_likess_batch(
    request: LikesBatchCreateRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Create multiple likess in a single request"""
    logger.debug(f"Batch creating {len(request.items)} likess")
    
    service = LikesService(db)
    results = []
    
    try:
        for item_data in request.items:
            result = await service.create(item_data.model_dump(), user_id=str(current_user.id))
            if result:
                results.append(result)
        
        logger.info(f"Batch created {len(results)} likess successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch create: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch create failed: {str(e)}")


@router.put("/batch", response_model=List[LikesResponse])
async def update_likess_batch(
    request: LikesBatchUpdateRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update multiple likess in a single request (requires ownership)"""
    logger.debug(f"Batch updating {len(request.items)} likess")
    
    service = LikesService(db)
    results = []
    
    try:
        for item in request.items:
            # Only include non-None values for partial updates
            update_dict = {k: v for k, v in item.updates.model_dump().items() if v is not None}
            result = await service.update(item.id, update_dict, user_id=str(current_user.id))
            if result:
                results.append(result)
        
        logger.info(f"Batch updated {len(results)} likess successfully")
        return results
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch update: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch update failed: {str(e)}")


@router.put("/{id}", response_model=LikesResponse)
async def update_likes(
    id: int,
    data: LikesUpdateData,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Update an existing likes (requires ownership)"""
    logger.debug(f"Updating likes {id} with data: {data}")

    service = LikesService(db)
    try:
        # Only include non-None values for partial updates
        update_dict = {k: v for k, v in data.model_dump().items() if v is not None}
        result = await service.update(id, update_dict, user_id=str(current_user.id))
        if not result:
            logger.warning(f"Likes with id {id} not found for update")
            raise HTTPException(status_code=404, detail="Likes not found")
        
        logger.info(f"Likes {id} updated successfully")
        return result
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error updating likes {id}: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error updating likes {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@router.delete("/batch")
async def delete_likess_batch(
    request: LikesBatchDeleteRequest,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete multiple likess by their IDs (requires ownership)"""
    logger.debug(f"Batch deleting {len(request.ids)} likess")
    
    service = LikesService(db)
    deleted_count = 0
    
    try:
        for item_id in request.ids:
            success = await service.delete(item_id, user_id=str(current_user.id))
            if success:
                deleted_count += 1
        
        logger.info(f"Batch deleted {deleted_count} likess successfully")
        return {"message": f"Successfully deleted {deleted_count} likess", "deleted_count": deleted_count}
    except Exception as e:
        await db.rollback()
        logger.error(f"Error in batch delete: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Batch delete failed: {str(e)}")


@router.delete("/{id}")
async def delete_likes(
    id: int,
    current_user: UserResponse = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Delete a single likes by ID (requires ownership)"""
    logger.debug(f"Deleting likes with id: {id}")
    
    service = LikesService(db)
    try:
        success = await service.delete(id, user_id=str(current_user.id))
        if not success:
            logger.warning(f"Likes with id {id} not found for deletion")
            raise HTTPException(status_code=404, detail="Likes not found")
        
        logger.info(f"Likes {id} deleted successfully")
        return {"message": "Likes deleted successfully", "id": id}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting likes {id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")