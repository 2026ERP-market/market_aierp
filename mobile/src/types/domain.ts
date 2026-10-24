// 프론트엔드 제안 타입입니다. 공식 서버 명세가 아닙니다.
export type StockStatus = 'normal' | 'low' | 'out' | 'expiring' | 'needs_check';
export type OrderStatus = 'draft' | 'pending' | 'approved' | 'ordered' | 'partial' | 'received' | 'cancelled';
export interface Store { id: string; name: string; timezone: string }
export interface User { id: string; name: string; role: string }
export interface InventoryBatch { id: string; expiresOn: string | null; quantity: number }
export interface InventoryMovement { id: string; at: string; label: string; quantity: number }
export interface InventoryRisk { status: StockStatus; reason: string }
export interface Product {
  id: string; name: string; barcode: string; category: string; unit: string;
  price: number; purchasePrice: number | null; quantity: number; safetyStock: number | null;
  supplier: string | null; recentSales: number | null; risk: InventoryRisk;
  batches: InventoryBatch[]; movements: InventoryMovement[];
}
export interface InventorySummary { products: Product[]; updatedAt: string }
export interface DashboardSummary {
  store: Store; date: string; updatedAt: string; revenue: number | null; changePercent: number | null;
  grossProfit: number | null; stockoutCount: number; expiringCount: number; pendingCount: number;
  briefing: string; todos: { label: string; target: 'inventory' | 'purchases' | 'agent' }[];
}
export interface SalesTrend { date: string; revenue: number; kind: 'actual' | 'forecast' }
export interface SalesSummary {
  start: string; end: string; revenue: number; changePercent: number | null; grossProfit: number | null;
  trend: SalesTrend[]; categories: { name: string; revenue: number }[];
  ranking: { productId: string; name: string; category: string; quantity: number; revenue: number; grossProfit: number | null }[];
  analysis: string; updatedAt: string | null;
}
export interface DateRange { start: string; end: string }
export interface ForecastResult { productId: string; expectedSales: number; period: string; reason: string }
export interface PurchaseOrderItem {
  productId: string; name: string; currentStock: number | null; expectedSales: number | null; leadDays: number | null;
  recommended: number | null; quantity: number; unit: string; unitCost: number | null; reason: string; warning: string | null;
}
export interface PurchaseOrder {
  id: string; supplier: string; status: OrderStatus; createdAt: string;
  items: PurchaseOrderItem[]; estimatedCost: number | null;
  receipts: { date: string | null; name: string; quantity: number }[];
  allowedActions: ('save' | 'approve')[];
}
export interface ProductInput { name: string; barcode: string; category: string; unit: string; price: number }
export interface StockCountInput { productId: string; counted: number; reason: string }
export type AgentAction = { label: string; target: 'inventory' | 'purchases' | 'sales'; productId?: string };
export interface AgentMessage {
  id: string; role: 'user' | 'assistant'; content: string;
  state: 'success' | 'data_insufficient' | 'forbidden' | 'not_found';
  cards?: { title: string; text: string; action: AgentAction }[];
}
