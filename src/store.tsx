import { createContext, useCallback, useContext, useMemo, useState, useEffect, type ReactNode } from 'react';
import type { PlacedOrder, Product, Supplier, Category } from './types';
import { initialProducts, suppliers } from './data/mock';
import { addDays, daysUntil, startOfToday, toISO } from './lib/date';
import { analyze, type Analysis } from './lib/recommend';

export interface Rec extends Analysis {
  packs: number; // 사용자가 조정한 박스 수
  qty: number;
  included: boolean;
  amount: number;
}

export interface ExpiryLot {
  batchId: string;
  product: Product;
  qty: number;
  expiry: string;
  daysLeft: number;
  lossQty: number; // 기한 안에 못 팔 것으로 예상되는 수량
  lossAmount: number; // 그 수량의 매입 원가
}

interface Edit {
  packs?: number;
  off?: boolean;
}

interface Store {
  today: Date;
  products: Product[];
  supplierById: Record<string, Supplier>;
  analyses: Analysis[];
  recs: Rec[];
  lots: ExpiryLot[];
  orders: PlacedOrder[];
  discounted: Set<string>;
  isLiveApi: boolean;
  setPacks: (productId: string, packs: number) => void;
  toggleRec: (productId: string) => void;
  toggleDiscount: (batchId: string) => void;
  placeOrders: (supplierIds: string[]) => PlacedOrder[];
}

const Ctx = createContext<Store | null>(null);

const mapCategory = (cat: string): Category => {
  if (cat.includes('채소') || cat.includes('과일') || cat.includes('신선')) return '채소·과일';
  if (cat.includes('축산') || cat.includes('정육') || cat.includes('계란')) return '정육·계란';
  if (cat.includes('유제품') || cat.includes('유가공')) return '유제품';
  if (cat.includes('조미료') || cat.includes('장류')) return '조미료';
  if (cat.includes('과자') || cat.includes('스낵')) return '과자';
  if (cat.includes('음료') || cat.includes('생수')) return '음료';
  return '가공식품';
};

export function StoreProvider({ children }: { children: ReactNode }) {
  const [today] = useState(startOfToday);
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [orders, setOrders] = useState<PlacedOrder[]>([]);
  const [discounted, setDiscounted] = useState<Set<string>>(new Set());
  const [isLiveApi, setIsLiveApi] = useState(false);

  const supplierById = useMemo(() => Object.fromEntries(suppliers.map((s) => [s.id, s])), []);

  // FastAPI 백엔드로부터 실시간 재고 및 상품 데이터 연동
  useEffect(() => {
    fetch('/api/v1/inventory/current')
      .then((res) => {
        if (!res.ok) throw new Error('API server offline');
        return res.json();
      })
      .then((data) => {
        if (data && Array.isArray(data.products) && data.products.length > 0) {
          const liveProducts: Product[] = data.products.map((p: any) => ({
            id: p.id,
            name: p.name,
            category: mapCategory(p.category),
            unit: p.unit,
            packSize: p.pack_size || 1,
            batches: (p.batches || []).map((b: any) => ({
              id: b.batch_id,
              qty: b.qty,
              expiry: b.expiry_date,
            })),
            incoming: p.incoming_qty > 0 ? [{ qty: p.incoming_qty, arrival: toISO(addDays(today, 2)) }] : [],
            safetyStock: p.safety_stock,
            costPrice: p.cost_price,
            salePrice: p.price,
            avgDailySales: p.safety_stock * 0.45,
            supplierId: p.supplier_id || 's1',
          }));
          setProducts(liveProducts);
          setIsLiveApi(true);
        }
      })
      .catch(() => {
        // 백엔드 미구동 시 mock 데이터 자동 유지
        setIsLiveApi(false);
      });
  }, [today]);

  const analyses = useMemo(
    () => products.map((p) => analyze(p, supplierById[p.supplierId] || suppliers[0], today)),
    [products, supplierById, today],
  );

  const recs = useMemo<Rec[]>(
    () =>
      analyses
        .filter((a) => a.recommendPacks > 0)
        .map((a) => {
          const e = edits[a.product.id];
          const packs = e?.packs ?? a.recommendPacks;
          const qty = packs * a.product.packSize;
          return { ...a, packs, qty, included: !e?.off, amount: qty * a.product.costPrice };
        })
        .sort((x, y) => Number(y.urgent) - Number(x.urgent) || x.supplier.id.localeCompare(y.supplier.id)),
    [analyses, edits],
  );

  const lots = useMemo<ExpiryLot[]>(
    () =>
      products
        .flatMap((p) => {
          let sold = 0;
          return p.batches
            .map((b) => ({ b, daysLeft: daysUntil(b.expiry, today) }))
            .sort((x, y) => x.daysLeft - y.daysLeft)
            .map(({ b, daysLeft }) => {
              const capacity = p.avgDailySales * (daysLeft >= 0 ? daysLeft + 1 : 0) - sold;
              const sellQty = Math.min(b.qty, Math.max(0, Math.floor(capacity)));
              sold += sellQty;
              const lossQty = b.qty - sellQty;
              return {
                batchId: b.id,
                product: p,
                qty: b.qty,
                expiry: b.expiry,
                daysLeft,
                lossQty,
                lossAmount: lossQty * p.costPrice,
              };
            });
        })
        .sort((a, b) => a.daysLeft - b.daysLeft),
    [products, today],
  );

  const setPacks = useCallback((productId: string, packs: number) => {
    setEdits((prev) => ({ ...prev, [productId]: { ...prev[productId], packs: Math.max(1, packs) } }));
  }, []);

  const toggleRec = useCallback((productId: string) => {
    setEdits((prev) => ({ ...prev, [productId]: { ...prev[productId], off: !prev[productId]?.off } }));
  }, []);

  const toggleDiscount = useCallback((batchId: string) => {
    setDiscounted((prev) => {
      const next = new Set(prev);
      if (!next.delete(batchId)) next.add(batchId);
      return next;
    });
  }, []);

  const placeOrders = useCallback(
    (supplierIds: string[]) => {
      const placed: PlacedOrder[] = supplierIds.map((sid, i) => {
        const targetSupplier = supplierById[sid] || suppliers[0];
        const mine = recs.filter((r) => r.included && r.supplier.id === sid);
        return {
          id: `PO-${toISO(today).replaceAll('-', '')}-${orders.length + i + 1}`,
          supplierId: sid,
          arrival: toISO(addDays(today, targetSupplier.leadTimeDays)),
          lines: mine.map((r) => ({
            productId: r.product.id,
            name: r.product.name,
            unit: r.product.unit,
            qty: r.qty,
            unitCost: r.product.costPrice,
          })),
          total: mine.reduce((s, r) => s + r.amount, 0),
        };
      });
      const byProduct = new Map(placed.flatMap((o) => o.lines.map((l) => [l.productId, { qty: l.qty, arrival: o.arrival }])));
      setProducts((prev) =>
        prev.map((p) => {
          const hit = byProduct.get(p.id);
          return hit ? { ...p, incoming: [...p.incoming, hit] } : p;
        }),
      );
      setEdits((prev) => {
        const next = { ...prev };
        for (const id of byProduct.keys()) delete next[id];
        return next;
      });
      setOrders((prev) => [...prev, ...placed]);
      return placed;
    },
    [recs, orders.length, supplierById, today],
  );

  const value: Store = {
    today,
    products,
    supplierById,
    analyses,
    recs,
    lots,
    orders,
    discounted,
    isLiveApi,
    setPacks,
    toggleRec,
    toggleDiscount,
    placeOrders,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error('StoreProvider가 필요합니다');
  return v;
}
