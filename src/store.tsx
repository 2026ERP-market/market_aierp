import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { PlacedOrder, Product, Supplier } from './types';
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
  setPacks: (productId: string, packs: number) => void;
  toggleRec: (productId: string) => void;
  toggleDiscount: (batchId: string) => void;
  placeOrders: (supplierIds: string[]) => PlacedOrder[];
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [today] = useState(startOfToday);
  const [products, setProducts] = useState(initialProducts);
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [orders, setOrders] = useState<PlacedOrder[]>([]);
  const [discounted, setDiscounted] = useState<Set<string>>(new Set());

  const supplierById = useMemo(() => Object.fromEntries(suppliers.map((s) => [s.id, s])), []);

  const analyses = useMemo(
    () => products.map((p) => analyze(p, supplierById[p.supplierId], today)),
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
          // 기한이 빠른 로트부터 팔린다고 보고, 기한 안에 못 팔 것으로 예상되는 수량을 로트별로 계산
          let sold = 0;
          return p.batches
            .map((b) => ({ b, daysLeft: daysUntil(b.expiry, today) }))
            .sort((x, y) => x.daysLeft - y.daysLeft)
            .map(({ b, daysLeft }) => {
              // 소비기한 당일까지 판매 가능 (이미 지난 것은 0일)
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

  /** 발주 확정: 입고 예정으로 반영하면 다음 추천 계산에서 자동으로 빠진다. (순환형 발주) */
  const placeOrders = useCallback(
    (supplierIds: string[]) => {
      const placed: PlacedOrder[] = supplierIds.map((sid, i) => {
        const mine = recs.filter((r) => r.included && r.supplier.id === sid);
        return {
          id: `PO-${toISO(today).replaceAll('-', '')}-${orders.length + i + 1}`,
          supplierId: sid,
          arrival: toISO(addDays(today, supplierById[sid].leadTimeDays)),
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
