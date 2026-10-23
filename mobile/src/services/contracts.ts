import type { AgentMessage, DashboardSummary, DateRange, InventorySummary, Product, ProductInput, PurchaseOrder, SalesSummary, StockCountInput } from '../types/domain';
export interface DashboardService { get(signal?: AbortSignal): Promise<DashboardSummary> }
export interface SalesService { get(range: DateRange, signal?: AbortSignal): Promise<SalesSummary> }
export interface ProductService {
  list(signal?: AbortSignal): Promise<InventorySummary>;
  get(id: string, signal?: AbortSignal): Promise<Product>;
  save(input: ProductInput, id?: string): Promise<Product>;
}
export interface InventoryService { count(input: StockCountInput): Promise<void> }
export interface PurchaseOrderService {
  list(signal?: AbortSignal): Promise<PurchaseOrder[]>;
  get(id: string, signal?: AbortSignal): Promise<PurchaseOrder>;
  save(id: string, quantities: number[]): Promise<PurchaseOrder>;
  approve(id: string): Promise<PurchaseOrder>;
}
export interface AgentService { send(message: string, signal?: AbortSignal): Promise<AgentMessage> }
export interface Services {
  dashboard: DashboardService; sales: SalesService; products: ProductService;
  inventory: InventoryService; purchases: PurchaseOrderService; agent: AgentService;
}
