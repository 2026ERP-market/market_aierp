import type { Product, PurchaseOrder } from '../../types/domain';
export const DEMO_DATE = '2026-10-24';
export const DEMO_TIME = '2026-10-24T10:30:00+09:00';
export function seedProducts(): Product[] {
  return [
    { id: 'milk', name: '신선한 아침 우유 1L', barcode: '8800000000011', category: '유제품', unit: '개', price: 2900, purchasePrice: 2100, quantity: 8, safetyStock: 20, supplier: '데모 유통', recentSales: 24, risk: { status: 'low', reason: '데모 분석: 주말 판매에 비해 재고가 적습니다.' }, batches: [{ id: 'batch-milk', expiresOn: '2026-10-27', quantity: 8 }], movements: [{ id: 'mv1', at: DEMO_TIME, label: '판매 출고', quantity: -4 }] },
    { id: 'egg', name: '동물복지 유정란 10구', barcode: '8800000000028', category: '신선식품', unit: '팩', price: 6500, purchasePrice: null, quantity: 12, safetyStock: 8, supplier: '데모 농장', recentSales: 9, risk: { status: 'expiring', reason: '데모 입고 묶음의 소비기한이 임박했습니다.' }, batches: [{ id: 'batch-egg', expiresOn: '2026-10-25', quantity: 12 }], movements: [] },
    { id: 'bread', name: '통밀 식빵', barcode: '8800000000035', category: '가공식품', unit: '개', price: 3800, purchasePrice: 2500, quantity: 0, safetyStock: 10, supplier: '데모 베이커리', recentSales: 18, risk: { status: 'out', reason: '현재 샘플 재고가 없습니다.' }, batches: [], movements: [] },
    { id: 'water', name: '맑은 샘물 2L', barcode: '8800000000042', category: '음료', unit: '병', price: 1000, purchasePrice: 600, quantity: 60, safetyStock: 24, supplier: '데모 유통', recentSales: 30, risk: { status: 'normal', reason: '샘플 재고가 안전재고 이상입니다.' }, batches: [{ id: 'batch-water', expiresOn: '2027-03-01', quantity: 60 }], movements: [] },
  ];
}
export function seedOrders(): PurchaseOrder[] {
  return [{ id: 'DEMO-001', supplier: '데모 유통', status: 'draft', createdAt: DEMO_TIME, estimatedCost: 63000, allowedActions: ['save', 'approve'], receipts: [], items: [{ productId: 'milk', name: '신선한 아침 우유 1L', currentStock: 8, expectedSales: 36, leadDays: 1, recommended: 30, quantity: 30, unit: '개', unitCost: 2100, reason: '데모 예측: 주말 예상 판매 36개와 납기 1일을 고려한 예시입니다.', warning: 'AI 추천은 실제 발주가 아닙니다. 수량과 납기를 확인하세요.' }] },
    { id: 'DEMO-002', supplier: '데모 베이커리', status: 'partial', createdAt: DEMO_TIME, estimatedCost: 50000, allowedActions: [], items: [{ productId: 'bread', name: '통밀 식빵', currentStock: 0, expectedSales: 18, leadDays: 1, recommended: 20, quantity: 20, unit: '개', unitCost: 2500, reason: '데모 발주 내역', warning: null }], receipts: [{ date: DEMO_DATE, name: '통밀 식빵', quantity: 10 }] }];
}
