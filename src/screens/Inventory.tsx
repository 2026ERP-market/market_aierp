import { useEffect, useMemo, useState } from 'react';
import { CATEGORIES } from '../data/mock';
import { daysUntil, shortDate } from '../lib/date';
import { ddayLabel, expiryTone, num, qty, won, wonShort } from '../lib/format';
import type { Analysis } from '../lib/recommend';
import { useStore } from '../store';
import type { Category, Screen } from '../types';
import { Icon } from '../components/Icon';
import { Badge, Empty, PageHead, StockBar, Stepper } from '../components/ui';

type Filter = 'all' | 'low';

interface Props {
  initialFilter?: string;
  onNav: (s: Screen) => void;
}

const STATUS_LABEL = { out: '품절', low: '부족', ok: '적정' } as const;
const STATUS_TONE = { out: 'danger', low: 'warn', ok: 'ok' } as const;

export function Inventory({ initialFilter, onNav }: Props) {
  const { analyses, today } = useStore();
  const [filter, setFilter] = useState<Filter>(initialFilter === 'low' ? 'low' : 'all');
  const [category, setCategory] = useState<Category | '전체'>('전체');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const rows = useMemo(() => {
    const order = { out: 0, low: 1, ok: 2 };
    return analyses
      .filter((a) => filter === 'all' || a.status !== 'ok')
      .filter((a) => category === '전체' || a.product.category === category)
      .filter((a) => a.product.name.includes(query.trim()))
      .sort((a, b) => order[a.status] - order[b.status] || a.product.name.localeCompare(b.product.name, 'ko'));
  }, [analyses, filter, category, query]);

  const lowCount = analyses.filter((a) => a.status !== 'ok').length;
  const selected = analyses.find((a) => a.product.id === openId);

  return (
    <>
      <PageHead title="재고 확인" sub={`전체 ${analyses.length}종 · 부족한 상품 ${lowCount}종`} />
      <Stepper current="inventory" onNav={onNav} />

      <div className="toolbar">
        <label className="search">
          <Icon name="search" size={18} />
          <input
            type="search"
            placeholder="상품 이름 검색"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="seg" role="group" aria-label="재고 상태">
          <button className={filter === 'all' ? 'is-on' : ''} onClick={() => setFilter('all')}>
            전체
          </button>
          <button className={filter === 'low' ? 'is-on' : ''} onClick={() => setFilter('low')}>
            부족한 것만 {lowCount}
          </button>
        </div>
      </div>
      <div className="chips" role="group" aria-label="분류">
        {(['전체', ...CATEGORIES] as const).map((c) => (
          <button key={c} className={`chip ${category === c ? 'is-on' : ''}`} onClick={() => setCategory(c)}>
            {c}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <Empty title="조건에 맞는 상품이 없어요" sub="검색어나 분류를 바꿔 보세요." />
      ) : (
        <ul className="card-list">
          {rows.map((a) => (
            <li key={a.product.id}>
              <button className="card item" onClick={() => setOpenId(a.product.id)}>
                <div className="item-main">
                  <div className="item-title">
                    <b>{a.product.name}</b>
                    <Badge tone={STATUS_TONE[a.status]}>{STATUS_LABEL[a.status]}</Badge>
                  </div>
                  <StockBar value={a.sellable} safety={a.product.safetyStock} />
                  <p className="muted">
                    안전재고 {qty(a.product.safetyStock, a.product.unit)}
                    {a.stockDays !== null && ` · 약 ${a.stockDays}일치`}
                    {a.incomingQty > 0 && ` · 입고 예정 ${qty(a.incomingQty, a.product.unit)}`}
                  </p>
                </div>
                <div className="item-side">
                  <span className="big-num">
                    {num(a.stock)}
                    <small>{a.product.unit}</small>
                  </span>
                  <span className="muted">{wonShort(a.stock * a.product.costPrice)}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="next-bar">
        <button className="btn btn-primary btn-lg" onClick={() => onNav('expiry')}>
          다음: 유통기한 확인 <Icon name="arrow" size={18} />
        </button>
      </div>

      {selected && <ProductSheet a={selected} today={today} onClose={() => setOpenId(null)} />}
    </>
  );
}

function ProductSheet({ a, today, onClose }: { a: Analysis; today: Date; onClose: () => void }) {
  const { product: p, supplier } = a;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const lots = [...p.batches].sort((x, y) => x.expiry.localeCompare(y.expiry));
  const margin = Math.round(((p.salePrice - p.costPrice) / p.salePrice) * 100);

  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={`${p.name} 상세`} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head">
          <div>
            <small className="muted">{p.category}</small>
            <h2>{p.name}</h2>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="닫기">
            <Icon name="close" />
          </button>
        </div>

        <div className="kv">
          <div>
            <span>현재고</span>
            <b>{qty(a.stock, p.unit)}</b>
          </div>
          <div>
            <span>안전재고</span>
            <b>{qty(p.safetyStock, p.unit)}</b>
          </div>
          <div>
            <span>하루 판매</span>
            <b>약 {p.avgDailySales}{p.unit}</b>
          </div>
          <div>
            <span>매입 단가</span>
            <b>{won(p.costPrice)}</b>
          </div>
          <div>
            <span>판매가</span>
            <b>{won(p.salePrice)}</b>
          </div>
          <div>
            <span>마진</span>
            <b>{margin}%</b>
          </div>
        </div>

        <h3>소비기한별 수량</h3>
        <ul className="lot-list">
          {lots.map((b) => {
            const d = daysUntil(b.expiry, today);
            return (
              <li key={b.id}>
                <span>{qty(b.qty, p.unit)}</span>
                <span className="muted">{shortDate(b.expiry)}</span>
                <Badge tone={expiryTone(d)}>{ddayLabel(d)}</Badge>
              </li>
            );
          })}
        </ul>

        <h3>공급업체</h3>
        <p className="supplier-line">
          <Icon name="truck" size={18} />
          <span>
            <b>{supplier.name}</b> · 주문 후 {supplier.leadTimeDays}일 뒤 도착 · {supplier.cutoff}까지 주문
          </span>
        </p>
        <p className="muted">
          {qty(p.packSize, p.unit)}씩 주문 · 최소 주문 {won(supplier.minOrderAmount)} · {supplier.phone}
        </p>
      </div>
    </div>
  );
}
