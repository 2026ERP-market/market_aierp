export type Category = '채소·과일' | '정육·계란' | '유제품' | '가공식품' | '조미료' | '과자' | '음료';

/** 같은 상품이라도 입고 시점이 다르면 소비기한이 달라서 로트(batch)로 나눠 관리한다. */
export interface Batch {
  id: string;
  qty: number;
  expiry: string; // yyyy-mm-dd
}

export interface Incoming {
  qty: number;
  arrival: string; // yyyy-mm-dd
}

export interface Product {
  id: string;
  name: string;
  category: Category;
  unit: string; // 개, 봉, 단 …
  packSize: number; // 공급업체 최소 주문 단위(박스당 수량)
  batches: Batch[];
  incoming: Incoming[];
  safetyStock: number;
  costPrice: number; // 매입 단가
  salePrice: number;
  avgDailySales: number; // 하루 평균 판매량
  supplierId: string;
}

export interface Supplier {
  id: string;
  name: string;
  leadTimeDays: number; // 주문 후 납품까지 걸리는 일수
  cutoff: string; // 당일 주문 마감
  minOrderAmount: number;
  phone: string;
}

export interface PlacedOrder {
  id: string;
  supplierId: string;
  arrival: string;
  lines: { productId: string; name: string; unit: string; qty: number; unitCost: number }[];
  total: number;
}

export type Screen = 'home' | 'inventory' | 'expiry' | 'recommend' | 'draft';
