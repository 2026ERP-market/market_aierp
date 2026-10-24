import type { AgentMessage, DashboardSummary, InventorySummary, Product, PurchaseOrder, SalesSummary } from '../../types/domain';
import type { ReplenishmentPlan } from '../replenishment';
import { ServiceError } from '../errors';

type Row = Record<string, unknown>;
function invalid(): never { throw new ServiceError('invalid_response', '서버 응답 형식이 올바르지 않습니다. API 명세를 확인해 주세요.') }
export function object(value: unknown): Row { if (!value || typeof value !== 'object' || Array.isArray(value)) invalid(); return value as Row }
export function list(value: unknown): unknown[] { if (!Array.isArray(value)) invalid(); return value }
export function string(value: unknown): string { if (typeof value !== 'string') invalid(); return value }
export function numeric(value: unknown): number { if (typeof value !== 'number' || !Number.isFinite(value)) invalid(); return value }
function nonnegative(value: unknown): number { const n = numeric(value); if (n < 0) invalid(); return n }
function optionalNumber(value: unknown): number | null { return value === null || value === undefined ? null : numeric(value) }
function optionalString(value: unknown): string | null { return value === null || value === undefined ? null : string(value) }
function enumValue<T extends string>(value: unknown, values: readonly T[]): T { if (typeof value !== 'string' || !values.includes(value as T)) invalid(); return value as T }
export function date(value: unknown): string { const text = string(value); if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || !Number.isFinite(Date.parse(text)) || new Date(text).toISOString().slice(0, 10) !== text) invalid(); return text }
function instant(value: unknown): string {
  const text = string(value);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(text)) invalid();
  // inventory.updated_at and created_at currently use UTC, sometimes without a suffix.
  const utc = /(?:Z|[+-]\d{2}:\d{2})$/i.test(text) ? text : `${text}Z`;
  if (!Number.isFinite(Date.parse(utc))) invalid();
  return utc;
}

const stockReasons = { normal: '서버 판정: 정상 재고', low: '서버 판정: 안전재고 미만', out: '서버 판정: 품절', expiring: '서버 판정: 소비기한 임박' };
export function inventory(payload: unknown): InventorySummary {
  const row = object(payload);
  const products: Product[] = list(row.products).map(value => {
    const p = object(value); const status = enumValue(p.status, ['normal', 'low', 'out', 'expiring'] as const);
    return { id: string(p.id), name: string(p.name), barcode: optionalString(p.barcode) ?? '', category: string(p.category), unit: string(p.unit),
      price: nonnegative(p.price), purchasePrice: p.cost_price === null ? null : nonnegative(p.cost_price), quantity: numeric(p.total_qty), safetyStock: optionalNumber(p.safety_stock), supplier: optionalString(p.supplier_name), recentSales: null,
      risk: { status, reason: stockReasons[status] }, movements: [],
      batches: list(p.batches).map(value => { const b = object(value); return { id: string(b.batch_id), expiresOn: b.expiry_date === null ? null : date(b.expiry_date), quantity: numeric(b.qty) } }),
    };
  });
  return { products, updatedAt: instant(row.updated_at) };
}

export function dashboard(payload: unknown, stock: InventorySummary, warehouseId: string): DashboardSummary {
  const row = object(payload);
  return { store: { id: warehouseId, name: string(row.store_name), timezone: 'Asia/Seoul' }, date: date(row.date), updatedAt: stock.updatedAt,
    revenue: numeric(row.revenue), changePercent: optionalNumber(row.change_percent), grossProfit: null,
    stockoutCount: nonnegative(row.stockout_count), expiringCount: nonnegative(row.expiring_count), pendingCount: nonnegative(row.pending_order_count), briefing: string(row.briefing),
    todos: list(row.todos).map(value => { const todo = object(value); return { label: string(todo.label), target: enumValue(todo.target, ['inventory', 'purchases', 'agent'] as const) } }),
  };
}

export function plan(payload: unknown, inventoryPayload: unknown, stock: InventorySummary, briefing: string): ReplenishmentPlan {
  return { updatedAt: stock.updatedAt, briefing, budget: null,
    recommendations: list(payload).map(value => {
      const row = object(value); const productId = string(row.item_id); const product = stock.products.find(item => item.id === productId);
      const status = row.status === 'draft' ? 'pending' : row.status === 'approved' ? 'approved' : row.status === 'ordered' ? 'ordered' : row.status === 'rejected' ? 'rejected' : 'unknown';
      return { id: string(row.rec_id), productId, productName: string(row.item_name), supplier: string(row.supplier_name), unit: product?.unit ?? '단위 미제공', currentStock: numeric(row.current_stock), demand: nonnegative(row.forecast_demand), demandPeriod: '서버에서 예측 기간 미제공', quantity: nonnegative(row.recommended_qty), unitCost: product?.purchasePrice ?? null, leadDays: nonnegative(row.lead_time_days), reason: optionalString(row.reason) ?? '서버에서 추천 사유 미제공', warning: '서버 추천입니다. 실제 공급업체 발송 여부는 발주 내역과 별도로 확인하세요.', draftId: null, status, orderId: null, finalQuantity: null };
    }),
    inventory: list(object(inventoryPayload).products).map(value => {
      const row = object(value);
      const isOverstock = typeof row.overstock_risk === 'boolean' ? row.overstock_risk : null;
      return {
        productId: string(row.id),
        incomingQuantity: row.incoming_qty === undefined ? null : nonnegative(row.incoming_qty),
        salesPeriod: '상품별 판매 추세 미제공',
        dailySales: [],
        overstockRisk: isOverstock,
        riskReason: isOverstock ? '재고가 안전재고 대비 과다합니다.' : '과잉 위험 판정은 서버에서 아직 제공하지 않습니다.'
      };
    }),
  };
}

export function orders(payload: unknown, stock: InventorySummary): PurchaseOrder[] {
  return list(payload).map(value => {
    const row = object(value); const receivedDate = row.received_date === null ? null : date(row.received_date);
    const lines = list(row.lines).map(value => {
      const line = object(value); const productId = string(line.item_id); const product = stock.products.find(item => item.id === productId);
      return { productId, name: string(line.item_name) || product?.name || productId, quantity: nonnegative(line.order_qty), received: nonnegative(line.received_qty), unitCost: nonnegative(line.unit_cost), currentStock: product?.quantity ?? null, unit: product?.unit ?? '단위 미제공' };
    });
    return { id: string(row.po_id), supplier: string(row.supplier_name), status: enumValue(row.status, ['draft', 'ordered', 'partial', 'received', 'cancelled'] as const), createdAt: instant(row.created_at), estimatedCost: nonnegative(row.total_amount), allowedActions: [],
      items: lines.map(line => ({ productId: line.productId, name: line.name, currentStock: line.currentStock, expectedSales: null, leadDays: null, recommended: null, quantity: line.quantity, unit: line.unit, unitCost: line.unitCost, reason: '서버 발주 내역 · 품목별 예측/추천 근거는 이 응답에서 미제공', warning: null })),
      receipts: lines.filter(line => line.received > 0).map(line => ({ name: line.name, quantity: line.received, date: receivedDate })),
    };
  });
}

export function sales(payload: unknown): SalesSummary {
  const row = object(payload);
  return { start: date(row.start_date), end: date(row.end_date), revenue: numeric(row.total_revenue), changePercent: null, grossProfit: null, updatedAt: null, analysis: '서버 판매 집계입니다. 비교 지표·원가·갱신 시각은 이 API에서 제공하지 않습니다.',
    trend: list(row.trend).map(value => { const item = object(value); return { date: date(item.date), revenue: numeric(item.revenue), kind: enumValue(item.kind, ['actual', 'forecast'] as const) } }),
    categories: list(row.categories).map(value => { const item = object(value); return { name: string(item.name), revenue: numeric(item.revenue) } }),
    ranking: list(row.ranking).map(value => { const item = object(value); return { productId: string(item.product_id), name: string(item.name), category: string(item.category), quantity: numeric(item.quantity), revenue: numeric(item.revenue), grossProfit: null } }),
  };
}

export function agent(payload: unknown): AgentMessage {
  const row = object(payload);
  return { id: string(row.id), role: enumValue(row.role, ['assistant'] as const), content: string(row.content), state: enumValue(row.state, ['success', 'data_insufficient', 'not_found'] as const),
    cards: list(row.cards).map(value => { const card = object(value); const action = object(card.action); const productId = optionalString(action.product_id); if (productId && !/^[a-zA-Z0-9_-]{1,128}$/.test(productId)) invalid(); return { title: string(card.title), text: string(card.text), action: { label: string(action.label), target: enumValue(action.target, ['inventory', 'purchases', 'sales'] as const), ...(productId ? { productId } : {}) } } }),
  };
}
