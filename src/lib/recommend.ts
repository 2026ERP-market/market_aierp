import type { Category, Product, Supplier } from '../types';
import { daysUntil } from './date';

export type StockStatus = 'out' | 'low' | 'ok';

export interface Analysis {
  product: Product;
  supplier: Supplier;
  stock: number; // 창고에 있는 전체 수량
  sellable: number; // 소비기한이 지나지 않은 수량
  usable: number; // 소비기한 안에 실제로 팔릴 것으로 예상되는 수량
  lossQty: number; // 못 팔고 버리게 될 것으로 예상되는 수량 (이미 지난 것 포함)
  incomingQty: number;
  stockDays: number | null; // 지금 재고로 버티는 일수 (판매 없는 상품은 null)
  status: StockStatus;
  urgent: boolean; // 납품 전에 품절될 수 있는 상태
  recommendPacks: number;
  recommendQty: number;
  reasons: string[];
}

/** 신선식품일수록 한 번에 많이 사면 못 팔고 버리게 되므로, 카테고리별로 커버할 일수를 다르게 잡는다. */
const COVER_DAYS: Record<Category, number> = {
  '채소·과일': 3,
  '정육·계란': 4,
  유제품: 5,
  가공식품: 10,
  조미료: 14,
  과자: 10,
  음료: 10,
};

export function analyze(p: Product, supplier: Supplier, today: Date): Analysis {
  const lots = p.batches
    .map((b) => ({ qty: b.qty, left: daysUntil(b.expiry, today) }))
    .sort((a, b) => a.left - b.left);

  // 소비기한이 빠른 것부터(FIFO) 팔린다고 보고, 기한 안에 팔 수 있는 양을 계산한다.
  let sold = 0;
  for (const lot of lots) {
    const capacity = p.avgDailySales * (lot.left >= 0 ? lot.left + 1 : 0) - sold;
    sold += Math.min(lot.qty, Math.max(0, capacity));
  }

  const stock = lots.reduce((s, l) => s + l.qty, 0);
  const sellable = lots.filter((l) => l.left >= 0).reduce((s, l) => s + l.qty, 0);
  const usable = Math.floor(sold);
  const incomingQty = p.incoming.reduce((s, i) => s + i.qty, 0);
  const stockDays = p.avgDailySales > 0 ? Math.floor(usable / p.avgDailySales) : null;

  const status: StockStatus = sellable <= 0 ? 'out' : sellable < p.safetyStock ? 'low' : 'ok';
  const lead = supplier.leadTimeDays;
  const urgent = incomingQty === 0 && stockDays !== null && stockDays < lead;

  const target = p.avgDailySales * (lead + COVER_DAYS[p.category]) + p.safetyStock;
  const need = Math.ceil(target - usable - incomingQty);
  const recommendPacks = need > 0 ? Math.ceil(need / p.packSize) : 0;
  const lossQty = stock - usable;

  const reasons: string[] = [];
  if (recommendPacks > 0) {
    if (sellable <= 0) reasons.push('재고가 없어요');
    else if (urgent) reasons.push(`납품 전에 떨어질 수 있어요 (재고 약 ${stockDays}일치)`);
    if (status === 'low' && sellable > 0) reasons.push(`안전재고(${p.safetyStock}${p.unit})보다 적어요`);
    if (lossQty > 0 && sellable > 0)
      reasons.push(`기한 내 못 팔 ${lossQty}${p.unit}을 빼고 계산했어요`);
    if (reasons.length === 0) reasons.push(`앞으로 ${lead + COVER_DAYS[p.category]}일 판매량에 비해 부족해요`);
  }

  return {
    product: p,
    supplier,
    stock,
    sellable,
    usable,
    lossQty,
    incomingQty,
    stockDays,
    status,
    urgent,
    recommendPacks,
    recommendQty: recommendPacks * p.packSize,
    reasons,
  };
}
