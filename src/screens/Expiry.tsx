import { shortDate } from '../lib/date';
import { ddayLabel, expiryTone, qty, wonShort } from '../lib/format';
import { useStore, type ExpiryLot } from '../store';
import type { Screen } from '../types';
import { Icon } from '../components/Icon';
import { Badge, Empty, PageHead, Stepper } from '../components/ui';

const GROUPS: { key: string; title: string; hint: string; match: (d: number) => boolean }[] = [
  { key: 'now', title: '오늘까지 · 이미 지난 상품', hint: '지난 상품은 진열에서 빼 주세요', match: (d) => d <= 0 },
  { key: 'soon', title: '1~3일 남음', hint: '할인해서 먼저 파는 게 좋아요', match: (d) => d >= 1 && d <= 3 },
  { key: 'watch', title: '4~7일 남음', hint: '앞쪽에 진열해 주세요', match: (d) => d >= 4 && d <= 7 },
];

export function Expiry({ onNav }: { onNav: (s: Screen) => void }) {
  const { lots, discounted, toggleDiscount } = useStore();

  const risky = lots.filter((l) => l.daysLeft <= 7);
  const riskAmount = risky.reduce((s, l) => s + l.lossAmount, 0);
  const safeCount = lots.length - risky.length;

  return (
    <>
      <PageHead title="유통기한 관리" sub="기한이 빠른 순서로 보여드려요" />
      <Stepper current="expiry" onNav={onNav} />

      <section className={`summary ${riskAmount > 0 ? 'is-warn' : ''}`}>
        <div>
          <span className="summary-label">7일 안에 기한이 끝나는 상품</span>
          <b className="summary-value">{risky.length}건</b>
        </div>
        <div>
          <span className="summary-label">못 팔면 예상 손실</span>
          <b className="summary-value">{wonShort(riskAmount)}</b>
        </div>
      </section>

      {risky.length === 0 && <Empty title="기한이 임박한 상품이 없어요" sub="오늘은 걱정하지 않으셔도 돼요." />}

      {GROUPS.map((g) => {
        const items = lots.filter((l) => g.match(l.daysLeft));
        if (items.length === 0) return null;
        return (
          <section key={g.key}>
            <div className="group-head">
              <h2>
                {g.title} <span className="count-inline">{items.length}</span>
              </h2>
              <p className="muted">{g.hint}</p>
            </div>
            <ul className="card-list">
              {items.map((l) => (
                <LotRow key={l.batchId} lot={l} done={discounted.has(l.batchId)} onToggle={() => toggleDiscount(l.batchId)} />
              ))}
            </ul>
          </section>
        );
      })}

      <p className="muted center">기한이 8일 이상 남은 {safeCount}건은 괜찮아요.</p>

      <div className="next-bar">
        <button className="btn btn-primary btn-lg" onClick={() => onNav('recommend')}>
          다음: AI 발주 추천 <Icon name="arrow" size={18} />
        </button>
      </div>
    </>
  );
}

function LotRow({ lot, done, onToggle }: { lot: ExpiryLot; done: boolean; onToggle: () => void }) {
  const { product: p, daysLeft } = lot;
  const expired = daysLeft < 0;
  return (
    <li className="card item">
      <div className="item-main">
        <div className="item-title">
          <b>{p.name}</b>
          <Badge tone={expiryTone(daysLeft)}>{ddayLabel(daysLeft)}</Badge>
        </div>
        <p className="muted">
          {qty(lot.qty, p.unit)} · {shortDate(lot.expiry)}까지
        </p>
        <p className={lot.lossQty > 0 ? 'loss' : 'muted'}>
          {lot.lossQty > 0
            ? `${qty(lot.lossQty, p.unit)}은 못 팔 것 같아요 (${wonShort(lot.lossAmount)} 손실)`
            : '기한 안에 다 팔릴 것 같아요'}
        </p>
      </div>
      {daysLeft >= 0 && lot.lossQty > 0 && !expired && (
        <button className={`btn ${done ? 'btn-done' : 'btn-outline'}`} onClick={onToggle} aria-pressed={done}>
          {done ? (
            <>
              <Icon name="check" size={16} /> 할인 중
            </>
          ) : (
            '할인 판매'
          )}
        </button>
      )}
      {expired && <span className="pill-note">폐기 필요</span>}
    </li>
  );
}
