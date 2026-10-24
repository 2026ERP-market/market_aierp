import { STORE } from '../data/mock';
import { todayLabel, shortDate } from '../lib/date';
import { num, won, wonShort } from '../lib/format';
import { useStore } from '../store';
import type { Screen } from '../types';
import { Icon } from '../components/Icon';

interface Props {
  onNav: (s: Screen, filter?: string) => void;
}

export function Home({ onNav }: Props) {
  const { today, products, analyses, recs, lots, orders, supplierById } = useStore();

  const lowCount = analyses.filter((a) => a.status !== 'ok').length;
  const urgentLots = lots.filter((l) => l.daysLeft <= 3);
  const riskAmount = lots.filter((l) => l.daysLeft <= 7).reduce((s, l) => s + l.lossAmount, 0);
  const stockValue = products.reduce(
    (s, p) => s + p.batches.reduce((q, b) => q + b.qty, 0) * p.costPrice,
    0,
  );
  const recTotal = recs.filter((r) => r.included).reduce((s, r) => s + r.amount, 0);
  const urgentRecs = recs.filter((r) => r.urgent).length;

  return (
    <>
      <div className="hello">
        <p>{todayLabel(today)}</p>
        <h1>{STORE.owner} 사장님, 안녕하세요</h1>
      </div>

      {/* 오늘 가장 중요한 일 한 가지를 크게 보여준다 */}
      <section className="hero">
        {recs.length > 0 ? (
          <>
            <div>
              <span className="hero-tag">
                <Icon name="sparkle" size={16} /> AI 발주 추천
              </span>
              <h2>
                오늘 발주할 상품이 <b>{recs.length}개</b> 있어요
              </h2>
              <p>
                예상 금액 <b>{won(recTotal)}</b>
                {urgentRecs > 0 && <> · 곧 떨어질 상품 {urgentRecs}개 포함</>}
              </p>
            </div>
            <button className="btn btn-light btn-lg" onClick={() => onNav('recommend')}>
              추천 보기 <Icon name="arrow" size={18} />
            </button>
          </>
        ) : (
          <div>
            <span className="hero-tag">
              <Icon name="check" size={16} /> 모두 적정
            </span>
            <h2>오늘은 발주할 상품이 없어요</h2>
            <p>입고 예정까지 반영해 계산했어요.</p>
          </div>
        )}
      </section>

      <div className="grid-3">
        <button className="stat" onClick={() => onNav('inventory', 'low')}>
          <span className="stat-label">재고 부족</span>
          <span className="stat-value">
            {lowCount}
            <small>개 상품</small>
          </span>
          <span className="stat-sub">안전재고보다 적은 상품</span>
        </button>
        <button className="stat" onClick={() => onNav('expiry')}>
          <span className="stat-label">유통기한 3일 이내</span>
          <span className="stat-value tone-danger">
            {urgentLots.length}
            <small>건</small>
          </span>
          <span className="stat-sub">
            {riskAmount > 0 ? `못 팔면 ${wonShort(riskAmount)} 손실 예상` : '손실 걱정 없어요'}
          </span>
        </button>
        <button className="stat" onClick={() => onNav('inventory')}>
          <span className="stat-label">현재 재고 금액</span>
          <span className="stat-value">{wonShort(stockValue)}</span>
          <span className="stat-sub">상품 {num(products.length)}종 (매입가 기준)</span>
        </button>
      </div>

      <h2 className="section-title">오늘 순서대로 해보세요</h2>
      <ol className="flow">
        <li>
          <button onClick={() => onNav('inventory')}>
            <span className="flow-no">1</span>
            <span className="flow-text">
              <b>재고 확인</b>
              <small>부족한 상품이 있는지 봐요</small>
            </span>
            <Icon name="arrow" size={18} />
          </button>
        </li>
        <li>
          <button onClick={() => onNav('expiry')}>
            <span className="flow-no">2</span>
            <span className="flow-text">
              <b>유통기한 확인</b>
              <small>임박한 상품을 먼저 팔아요</small>
            </span>
            <Icon name="arrow" size={18} />
          </button>
        </li>
        <li>
          <button onClick={() => onNav('recommend')}>
            <span className="flow-no">3</span>
            <span className="flow-text">
              <b>AI 발주 추천 · 발주안 확인</b>
              <small>추천 수량을 보고 발주해요</small>
            </span>
            <Icon name="arrow" size={18} />
          </button>
        </li>
      </ol>

      {orders.length > 0 && (
        <>
          <h2 className="section-title">입고 예정</h2>
          <ul className="card-list">
            {orders.map((o) => (
              <li key={o.id} className="card row-between">
                <div>
                  <b>{supplierById[o.supplierId].name}</b>
                  <p className="muted">
                    {shortDate(o.arrival)} 도착 · {o.lines.length}개 상품
                  </p>
                </div>
                <span className="amount">{won(o.total)}</span>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
