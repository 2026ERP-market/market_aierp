from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.master import Item
from app.schemas.master import ItemResponse, ItemCreate, ItemUpdate

router = APIRouter(prefix="/items", tags=["Items"])

@router.get("", response_model=list[ItemResponse])
async def list_items(
    category: str | None = None,
    keyword: str | None = None,
    db: AsyncSession = Depends(get_db)
):
    """품목 목록 조회 (카테고리 및 검색어 필터 지원)"""
    stmt = select(Item)
    if category:
        stmt = stmt.where(Item.category_l == category)
    if keyword:
        stmt = stmt.where(Item.item_name.ilike(f"%{keyword}%"))
    stmt = stmt.order_by(Item.item_name.asc())
    
    result = await db.execute(stmt)
    return result.scalars().all()

@router.post("", response_model=ItemResponse)
async def create_item(
    item_in: ItemCreate,
    db: AsyncSession = Depends(get_db)
):
    """신규 품목 마스터 등록"""
    existing = await db.get(Item, item_in.item_id)
    if existing:
        raise HTTPException(status_code=400, detail="Item already exists")
    
    item = Item(**item_in.model_dump())
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item

@router.get("/{item_id}", response_model=ItemResponse)
async def get_item(
    item_id: str,
    db: AsyncSession = Depends(get_db)
):
    """단일 품목 상세 조회"""
    item = await db.get(Item, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item

@router.put("/{item_id}", response_model=ItemResponse)
async def update_item(
    item_id: str,
    item_in: ItemUpdate,
    db: AsyncSession = Depends(get_db)
):
    """품목 마스터 수정 (보낸 필드만 반영)"""
    item = await db.get(Item, item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    for field, value in item_in.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    await db.commit()
    await db.refresh(item)
    return item
