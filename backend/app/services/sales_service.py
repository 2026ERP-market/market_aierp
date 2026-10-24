from datetime import date, timedelta
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from app.models.sales import Sales
from app.models.master import Item
from app.models.inventory import InventoryBatch
from app.schemas.sales import SalesCreate, SalesSummaryResponse, SalesTrendPoint, CategoryShare, ProductRankingItem

class SalesService:
    @staticmethod
    async def record_sale(db: AsyncSession, req: SalesCreate) -> Sales:
        # 단가 및 총액 자동 계산
        item = await db.get(Item, req.item_id)
        if not item:
            raise ValueError(f"Item not found: {req.item_id}")

        unit_price = req.unit_price if req.unit_price > 0 else int(item.sale_price)
        amount = req.amount if req.amount is not None else int(unit_price * req.qty)

        # 1. 판매 트랜잭션 기록
        sale = Sales(
            sale_date=req.sale_date,
            order_id=req.order_id,
            item_id=req.item_id,
            warehouse_id=req.warehouse_id,
            customer_id=req.customer_id,
            channel=req.channel,
            qty=req.qty,
            unit_price=unit_price,
            amount=amount,
            is_return=req.is_return
        )
        db.add(sale)

        # 2. 실시간 재고 차감 (선입선출 FIFO)
        if not req.is_return:
            remaining_to_deduct = req.qty
            batch_stmt = (
                select(InventoryBatch)
                .where(
                    InventoryBatch.item_id == req.item_id,
                    InventoryBatch.warehouse_id == req.warehouse_id,
                    InventoryBatch.qty > 0
                )
                .order_by(InventoryBatch.expiry_date.asc())
            )
            res = await db.execute(batch_stmt)
            batches = res.scalars().all()

            for b in batches:
                current_qty = float(b.qty)
                if current_qty >= remaining_to_deduct:
                    b.qty = current_qty - remaining_to_deduct
                    remaining_to_deduct = 0
                    break
                else:
                    remaining_to_deduct -= current_qty
                    b.qty = 0

        await db.commit()
        return sale

    @staticmethod
    async def get_sales_summary(db: AsyncSession, days: int = 14) -> SalesSummaryResponse:
        end_date = date.today()
        start_date = end_date - timedelta(days=days)

        # 일별 트렌드
        trend_stmt = (
            select(
                Sales.sale_date,
                func.coalesce(func.sum(Sales.amount), 0).label("revenue")
            )
            .where(Sales.sale_date >= start_date, Sales.sale_date <= end_date, Sales.is_return == False)
            .group_by(Sales.sale_date)
            .order_by(Sales.sale_date.asc())
        )
        trend_res = await db.execute(trend_stmt)
        trend_data = [
            SalesTrendPoint(date=r[0].strftime("%Y-%m-%d"), revenue=int(r[1]), kind="actual")
            for r in trend_res.all()
        ]

        # 카테고리별 비중
        cat_stmt = (
            select(
                Item.category_l,
                func.coalesce(func.sum(Sales.amount), 0).label("revenue")
            )
            .join(Item, Sales.item_id == Item.item_id)
            .where(Sales.sale_date >= start_date, Sales.is_return == False)
            .group_by(Item.category_l)
            .order_by(func.sum(Sales.amount).desc())
        )
        cat_res = await db.execute(cat_stmt)
        cat_data = [CategoryShare(name=r[0], revenue=int(r[1])) for r in cat_res.all()]

        # 품목별 랭킹 Top 10
        rank_stmt = (
            select(
                Item.item_id,
                Item.item_name,
                Item.category_l,
                func.coalesce(func.sum(Sales.qty), 0).label("qty"),
                func.coalesce(func.sum(Sales.amount), 0).label("revenue")
            )
            .join(Item, Sales.item_id == Item.item_id)
            .where(Sales.sale_date >= start_date, Sales.is_return == False)
            .group_by(Item.item_id, Item.item_name, Item.category_l)
            .order_by(func.sum(Sales.amount).desc())
            .limit(10)
        )
        rank_res = await db.execute(rank_stmt)
        ranking_data = [
            ProductRankingItem(
                product_id=r[0],
                name=r[1],
                category=r[2],
                quantity=float(r[3]),
                revenue=int(r[4])
            )
            for r in rank_res.all()
        ]

        total_rev = sum(t.revenue for t in trend_data)
        total_q = sum(r.quantity for r in ranking_data)

        return SalesSummaryResponse(
            start_date=start_date.strftime("%Y-%m-%d"),
            end_date=end_date.strftime("%Y-%m-%d"),
            total_revenue=total_rev,
            total_qty=total_q,
            order_count=len(trend_data),
            trend=trend_data,
            categories=cat_data,
            ranking=ranking_data
        )
