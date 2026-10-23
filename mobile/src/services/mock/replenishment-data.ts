import type { InventoryPlanning, PurchaseRecommendation } from '../replenishment';

// 고정 데모 예측입니다. 수요 예측·최적화 엔진을 프론트엔드에서 실행하지 않습니다.
export const planningInventory: InventoryPlanning[] = [
  { productId: 'milk', incomingQuantity: 0, salesPeriod: '2026-10-21 ~ 2026-10-23', dailySales: [{ date: '10-21', quantity: 6 }, { date: '10-22', quantity: 8 }, { date: '10-23', quantity: 10 }], overstockRisk: false, riskReason: null },
  { productId: 'bread', incomingQuantity: 10, salesPeriod: '2026-10-21 ~ 2026-10-23', dailySales: [{ date: '10-21', quantity: 5 }, { date: '10-22', quantity: 6 }, { date: '10-23', quantity: 7 }], overstockRisk: false, riskReason: null },
  { productId: 'egg', incomingQuantity: 0, salesPeriod: '2026-10-21 ~ 2026-10-23', dailySales: [{ date: '10-21', quantity: 4 }, { date: '10-22', quantity: 3 }, { date: '10-23', quantity: 2 }], overstockRisk: false, riskReason: null },
  { productId: 'water', incomingQuantity: 0, salesPeriod: '2026-10-21 ~ 2026-10-23', dailySales: [{ date: '10-21', quantity: 14 }, { date: '10-22', quantity: 10 }, { date: '10-23', quantity: 6 }], overstockRisk: true, riskReason: '데모 분석: 최근 판매가 감소하고 있어 추가 발주를 신중히 검토하세요.' },
];
export const purchaseRecommendations: PurchaseRecommendation[] = [
  { id: 'rec-milk', productId: 'milk', productName: '신선한 아침 우유 1L', supplier: '데모 유통', unit: '개', currentStock: 8, demand: 36, demandPeriod: '2026-10-24 ~ 2026-10-26', quantity: 30, unitCost: 2100, leadDays: 1, reason: '주말 예상 수요 36개와 현재 재고 8개, 납기 1일을 고려한 고정 추천 예시입니다.', warning: '실제 예측 모델 결과가 아닙니다. 소비기한과 납기를 확인하세요.', draftId: 'DEMO-001' },
  { id: 'rec-bread', productId: 'bread', productName: '통밀 식빵', supplier: '데모 베이커리', unit: '개', currentStock: 0, demand: 18, demandPeriod: '2026-10-24 ~ 2026-10-26', quantity: 10, unitCost: 2500, leadDays: 1, reason: '현재 품절 상태와 입고 예정 10개를 고려한 추가 발주 검토 예시입니다.', warning: '기존 일부 입고 발주서를 먼저 확인한 뒤 추가 수량을 결정하세요.', draftId: null },
];
