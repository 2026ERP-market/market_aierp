import { shortDate, addDays, toISO } from '../lib/date';
import { qty, won } from '../lib/format';
import { useStore, type Rec } from '../store';
import type { Screen } from '../types';
import { Icon } from '../components/Icon';
import { Badge, Empty, PageHead, Stepper } from '../components/ui';

export function Recommend({ onNav }: { onNav: (s: Screen) => void }) {
  const { recs, today, orders } = useStore();

  const groups = [...new Set(recs.map((r) => r.supplier.id))].map((id) => {
    const items = recs.filter((r) => r.supplier.id === id);
    return { supplier: items[0].supplier, items };
  });
  const picked = recs.filter((r) => r.included);
  const total = picked.reduce((s, r) => s + r.amount, 0);

  return (
    <>
      <PageHead title="AI 발주 추천" sub="재고·소비기한·납기·판매 속도를 함께 보고 계산했어요" />
      <Stepper current="recommend" onNav={onNav} />

      {recs.length === 0 ? (
        <Empty
          title={orders.length > 0 ? '발주를 모두 마쳤어요' : '지금은 발주할 상품이 없어요'}
          sub="입고 예정 수량까지 반영해서 부족한 상품이 생기면 다시 알려드려요."
        >
          <button className="btn btn-primary" onClick={() => onNav('home')}>
            홈으로
          </button>
        </Empty>
      ) : (
        groups.map(({ supplier, items }) => {
          const sum = items.filter((r) => r.included).reduce((s, r) => s + r.amount, 0);
          const short = supplier.minOrderAmount - sum;
          return (
            <section key={supplier.id} className="supplier-block">
              <div className="supplier-head">
                <div>
                  <h2>{supplier.name}</h2>
                  <p className="muted">
                    <Icon name="truck" size={14} /> {shortDate(toISO(addDays(today, supplier.leadTimeDays)))} 도착 ·{' '}
                    {supplier.cutoff}까지 주문
                  </p>
                </div>
                <div className="supplier-sum">
                  <b>{won(sum)}</b>
                  {sum > 0 && short > 0 && <span className="warn-text">{won(short)} 더 필요</span>}
                </div>
              </div>
              <ul className="card-list">
                {items.map((r) => (
                  <RecRow key={r.product.id} rec={r} />
                ))}
              </ul>
            </section>
          );
        })
      )}

      {recs.length > 0 && (
        <div className="action-bar">
          <div className="action-sum">
            <span>선택 {picked.length}개</span>
            <b>{won(total)}</b>
          </div>
          <button className="btn btn-primary btn-lg" disabled={picked.length === 0} onClick={() => onNav('draft')}>
            발주안 확인 <Icon name="arrow" size={18} />
          </button>
        </div>
      )}
    </>
  );
}

function RecRow({ rec: r }: { rec: Rec }) {
  const { setPacks, toggleRec } = useStore();
  const p = r.product;
  const edited = r.packs !== r.recommendPacks;

  return (
    <li className={`card rec ${r.included ? '' : 'is-off'}`}>
      <div className="rec-top">
        <label className="check">
          <input type="checkbox" checked={r.included} onChange={() => toggleRec(p.id)} />
          <span className="check-box" aria-hidden="true">
            <Icon name="check" size={16} />
          </span>
          <span className="sr-only">{p.name} 발주에 포함</span>
        </label>
        <div className="rec-title">
          <div className="item-title">
            <b>{p.name}</b>
            {r.urgent && <Badge tone="danger">품절 임박</Badge>}
            {r.status === 'out' && !r.urgent && <Badge tone="danger">품절</Badge>}
          </div>
          <p className="muted">
            현재 {qty(r.stock, p.unit)} · 하루 약 {p.avgDailySales}
            {p.unit} 판매
          </p>
        </div>
      </div>

      <p className="why">
        <Icon name="sparkle" size={14} /> {r.reasons[0]}
        {r.reasons[1] && <span className="muted"> · {r.reasons[1]}</span>}
      </p>

      <div className="rec-bottom">
        <div className="stepper-qty" role="group" aria-label={`${p.name} 주문 수량`}>
          <button onClick={() => setPacks(p.id, r.packs - 1)} disabled={r.packs <= 1 || !r.included} aria-label="줄이기">
            <Icon name="minus" size={18} />
          </button>
          <div>
            <b>{qty(r.qty, p.unit)}</b>
            <small>
              {p.packSize}
              {p.unit}씩 {r.packs}묶음
            </small>
          </div>
          <button onClick={() => setPacks(p.id, r.packs + 1)} disabled={!r.included} aria-label="늘리기">
            <Icon name="plus" size={18} />
          </button>
        </div>
        <div className="rec-amount">
          <b>{won(r.amount)}</b>
          <small className="muted">단가 {won(p.costPrice)}</small>
          {edited && (
            <button className="link-btn small" onClick={() => setPacks(p.id, r.recommendPacks)}>
              AI 추천({qty(r.recommendQty, p.unit)})으로
            </button>
          )}
        </div>
      </div>
    </li>
  );
}
