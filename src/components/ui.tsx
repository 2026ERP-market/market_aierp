import type { ReactNode } from 'react';
import type { Screen } from '../types';
import type { Tone } from '../lib/format';
import { Icon } from './Icon';

/** 색만으로 구분하지 않도록 항상 글자와 함께 보여주는 상태 뱃지 */
export function Badge({ tone, children }: { tone: Tone | 'info'; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

export function PageHead({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {action}
    </div>
  );
}

const STEPS: { screen: Screen; label: string }[] = [
  { screen: 'inventory', label: '재고 확인' },
  { screen: 'expiry', label: '유통기한' },
  { screen: 'recommend', label: 'AI 발주 추천' },
  { screen: 'draft', label: '발주안 확인' },
];

/** 재고 → 유통기한 → AI 추천 → 발주안 순서를 항상 보여줘서 지금 어디쯤인지 알 수 있게 한다. */
export function Stepper({ current, onNav }: { current: Screen; onNav: (s: Screen) => void }) {
  const idx = STEPS.findIndex((s) => s.screen === current);
  return (
    <ol className="stepper" aria-label="진행 단계">
      {STEPS.map((s, i) => (
        <li key={s.screen} className={i === idx ? 'is-current' : i < idx ? 'is-done' : ''}>
          <button onClick={() => onNav(s.screen)} aria-current={i === idx ? 'step' : undefined}>
            <span className="step-no">{i < idx ? <Icon name="check" size={14} /> : i + 1}</span>
            <span className="step-label">{s.label}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}

export function Empty({ title, sub, children }: { title: string; sub?: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {sub && <p>{sub}</p>}
      {children}
    </div>
  );
}

/** 안전재고 대비 현재고를 한눈에 보여주는 막대. 눈금이 안전재고 위치. */
export function StockBar({ value, safety }: { value: number; safety: number }) {
  const max = Math.max(safety * 2, value, 1);
  const tone = value <= 0 ? 'danger' : value < safety ? 'warn' : 'ok';
  return (
    <div className="stockbar" role="img" aria-label={`안전재고 ${safety} 대비 현재 ${value}`}>
      <div className={`stockbar-fill tone-${tone}`} style={{ width: `${Math.min(100, (value / max) * 100)}%` }} />
      <div className="stockbar-mark" style={{ left: `${(safety / max) * 100}%` }} />
    </div>
  );
}
