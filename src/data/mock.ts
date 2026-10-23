import type { Batch, Category, Product, Supplier } from '../types';
import { addDays, startOfToday, toISO } from '../lib/date';

// 데모 데이터: 소비기한은 "오늘로부터 N일 뒤"로 만들어서 언제 열어도 화면이 자연스럽다.
// 실제 연동 시에는 ERP API 응답으로 대체한다.
const today = startOfToday();

export const STORE = { name: '행복마트', owner: '김영숙' };

export const suppliers: Supplier[] = [
  { id: 's1', name: '푸르메 농산', leadTimeDays: 1, cutoff: '오후 5시', minOrderAmount: 50_000, phone: '02-555-0101' },
  { id: 's2', name: '한우리 축산', leadTimeDays: 1, cutoff: '오후 3시', minOrderAmount: 100_000, phone: '02-555-0102' },
  { id: 's3', name: '서울우유 대리점', leadTimeDays: 1, cutoff: '저녁 6시', minOrderAmount: 30_000, phone: '02-555-0103' },
  { id: 's4', name: '대한식품 도매', leadTimeDays: 2, cutoff: '오후 4시', minOrderAmount: 150_000, phone: '02-555-0104' },
  { id: 's5', name: '청량음료 유통', leadTimeDays: 3, cutoff: '오후 2시', minOrderAmount: 100_000, phone: '02-555-0105' },
];

let seq = 0;
const b = (qty: number, daysLeft: number): Batch => ({
  id: `b${++seq}`,
  qty,
  expiry: toISO(addDays(today, daysLeft)),
});

type Row = [
  id: string,
  name: string,
  category: Category,
  unit: string,
  packSize: number,
  batches: Batch[],
  safetyStock: number,
  costPrice: number,
  salePrice: number,
  avgDailySales: number,
  supplierId: string,
];

const rows: Row[] = [
  ['p01', '대파', '채소·과일', '단', 10, [b(6, 2), b(4, 4)], 8, 1800, 2500, 4, 's1'],
  ['p02', '양파 1.5kg', '채소·과일', '망', 10, [b(18, 14)], 10, 2400, 3500, 3, 's1'],
  ['p03', '사과 5입', '채소·과일', '봉', 6, [b(3, 5)], 6, 6500, 8900, 2.5, 's1'],
  ['p04', '방울토마토 500g', '채소·과일', '팩', 8, [b(5, 1), b(4, 3)], 6, 3200, 4500, 3, 's1'],
  ['p05', '시금치', '채소·과일', '단', 10, [b(2, 1)], 6, 1500, 2200, 3.5, 's1'],
  ['p06', '두부 300g', '채소·과일', '모', 10, [b(1, -1), b(5, 3), b(6, 7)], 8, 1100, 1800, 4, 's1'],
  ['p07', '삼겹살 600g', '정육·계란', '팩', 10, [b(7, 2), b(5, 4)], 8, 9800, 13900, 5, 's2'],
  ['p08', '계란 30구', '정육·계란', '판', 6, [b(14, 9)], 8, 6200, 7900, 4, 's2'],
  ['p09', '닭볶음탕용', '정육·계란', '팩', 8, [b(3, 2)], 5, 6400, 8900, 2, 's2'],
  ['p10', '우유 1L', '유제품', '개', 12, [b(10, 4), b(12, 9)], 12, 2100, 2800, 8, 's3'],
  ['p11', '요구르트 10입', '유제품', '팩', 6, [b(6, 12)], 4, 3800, 5200, 1.5, 's3'],
  ['p12', '슬라이스치즈', '유제품', '봉', 10, [b(4, 30)], 6, 3300, 4500, 1.2, 's3'],
  ['p13', '신라면 5입', '가공식품', '봉', 8, [b(20, 160)], 12, 3300, 4200, 2.5, 's4'],
  ['p14', '햇반 210g', '가공식품', '개', 24, [b(30, 180)], 20, 1150, 1600, 5, 's4'],
  ['p15', '참치캔 150g', '가공식품', '개', 24, [b(16, 540)], 24, 1450, 2000, 3, 's4'],
  ['p16', '진간장 840ml', '조미료', '병', 12, [b(9, 300)], 6, 3900, 5500, 0.8, 's4'],
  ['p17', '고추장 500g', '조미료', '개', 12, [b(3, 200)], 4, 3600, 5000, 0.6, 's4'],
  ['p18', '식용유 900ml', '조미료', '병', 12, [b(14, 400)], 6, 3800, 5200, 0.9, 's4'],
  ['p19', '새우깡 90g', '과자', '봉', 20, [b(22, 45)], 15, 880, 1300, 2, 's4'],
  ['p20', '초코파이 12입', '과자', '상자', 12, [b(2, 25)], 6, 2700, 3800, 0.9, 's4'],
  ['p21', '생수 2L 6입', '음료', '묶음', 6, [b(8, 365)], 10, 2600, 3600, 3, 's5'],
  ['p22', '콜라 1.5L', '음료', '병', 12, [b(18, 120)], 12, 1500, 2300, 3.5, 's5'],
  ['p23', '오렌지주스 1.5L', '음료', '개', 6, [b(3, 3), b(7, 6)], 5, 2800, 3900, 1.5, 's5'],
  ['p24', '보리차 티백', '음료', '상자', 10, [b(9, 200)], 4, 2100, 3000, 0.7, 's5'],
];

export const initialProducts: Product[] = rows.map(
  ([id, name, category, unit, packSize, batches, safetyStock, costPrice, salePrice, avgDailySales, supplierId]) => ({
    id,
    name,
    category,
    unit,
    packSize,
    batches,
    incoming: [],
    safetyStock,
    costPrice,
    salePrice,
    avgDailySales,
    supplierId,
  }),
);

export const CATEGORIES: Category[] = ['채소·과일', '정육·계란', '유제품', '가공식품', '조미료', '과자', '음료'];
