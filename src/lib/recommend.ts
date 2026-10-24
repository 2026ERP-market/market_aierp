import type { Category, Product, Supplier } from '../types';
import { daysUntil } from './date';
import { SERVICE_LEVEL, expectedDemand, peakWeekdays, safetyStock } from './forecast';

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
  forecastDemand: number; // 발주 커버 기간(리드타임+커버일) 예측 수요 합
  safety: number; // 수학적 안전재고 = z·σ·√L
  serviceLevel: number; // 안전재고 산출에 쓴 서비스수준
  horizonDays: number; // 예측 커버 기간
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

  // 고정 상수 대신 학습된 요일 계수로 기간 수요를 예측하고, 안전재고는 서비스수준으로 산출한다.
  // 발주주기 '총수요'를 쓰므로(일별이 아니라) 무작위잡음이 상쇄돼 발주량 정확도가 높다.
  // SystemEver 연동 시 expectedDemand 4번째 인자로 행사·가격 신호(DemandSignal)를 넘기면
  // 포아송 잡음 바닥 아래로 정확도가 더 내려간다. (데모는 외부신호 없이 기본 1.0)
  const horizonDays = lead + COVER_DAYS[p.category];
  const forecastDemand = expectedDemand(p.avgDailySales, today, horizonDays);
  const safety = safetyStock(p.avgDailySales, lead, SERVICE_LEVEL);
  const target = forecastDemand + safety;
  const need = Math.ceil(target - usable - incomingQty);
  const recommendPacks = need > 0 ? Math.ceil(need / p.packSize) : 0;
  const lossQty = stock - usable;
  const peaks = peakWeekdays(today, horizonDays);

  const reasons: string[] = [];
  if (recommendPacks > 0) {
    if (sellable <= 0) reasons.push('재고가 없어요');
    else if (urgent) reasons.push(`납품 전에 떨어질 수 있어요 (재고 약 ${stockDays}일치)`);
    reasons.push(
      `${horizonDays}일 예측수요 ${Math.round(forecastDemand)}${p.unit} + 안전재고 ${Math.ceil(safety)}${p.unit}(서비스수준 ${Math.round(SERVICE_LEVEL * 100)}%)`,
    );
    if (peaks.length > 0) reasons.push(`${peaks.join('·')}요일 수요 증가를 반영했어요`);
    if (lossQty > 0 && sellable > 0)
      reasons.push(`기한 내 못 팔 ${lossQty}${p.unit}을 빼고 계산했어요`);
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
    forecastDemand,
    safety,
    serviceLevel: SERVICE_LEVEL,
    horizonDays,
    recommendPacks,
    recommendQty: recommendPacks * p.packSize,
    reasons,
  };
}
