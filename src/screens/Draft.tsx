import { useState } from 'react';
import { shortDate, addDays, toISO } from '../lib/date';
import { qty, won } from '../lib/format';
import { useStore } from '../store';
import type { PlacedOrder, Screen } from '../types';
import { Icon } from '../components/Icon';
import { Badge, Empty, PageHead, Stepper } from '../components/ui';

export function Draft({ onNav }: { onNav: (s: Screen) => void }) {
  const { recs, today, placeOrders } = useStore();
  const [done, setDone] = useState<PlacedOrder[] | null>(null);

  if (done) return <Done orders={done} onNav={onNav} />;

  const picked = recs.filter((r) => r.included);
  const groups = [...new Set(picked.map((r) => r.supplier.id))].map((id) => {
    const items = picked.filter((r) => r.supplier.id === id);
    const total = items.reduce((s, r) => s + r.amount, 0);
    const supplier = items[0].supplier;
    return { supplier, items, total, ready: total >= supplier.minOrderAmount };
  });
  const sendable = groups.filter((g) => g.ready);
  const grand = sendable.reduce((s, g) => s + g.total, 0);

  if (groups.length === 0) {
    return (
      <>
        <PageHead title="발주안 확인" />
        <Stepper current="draft" onNav={onNav} />
        <Empty title="확인할 발주안이 없어요" sub="AI 발주 추천에서 상품을 선택해 주세요.">
          <button className="btn btn-primary" onClick={() => onNav('recommend')}>
            추천으로 돌아가기
          </button>
        </Empty>
      </>
    );
  }

  return (
    <>
      <PageHead title="발주안 확인" sub="업체별로 나눠서 보내요. 내용을 확인하고 확정해 주세요." />
      <Stepper current="draft" onNav={onNav} />

      {groups.map(({ supplier, items, total, ready }) => (
        <section key={supplier.id} className={`card draft ${ready ? '' : 'is-hold'}`}>
          <div className="draft-head">
            <div>
              <h2>{supplier.name}</h2>
              <p className="muted">
                <Icon name="truck" size={14} /> {shortDate(toISO(addDays(today, supplier.leadTimeDays)))} 도착 예정
              </p>
            </div>
            {ready ? <Badge tone="ok">발주 가능</Badge> : <Badge tone="warn">보류</Badge>}
          </div>

          <table className="draft-table">
            <thead>
              <tr>
                <th scope="col">상품</th>
                <th scope="col" className="r">
                  수량
                </th>
                <th scope="col" className="r">
                  금액
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((r) => (
                <tr key={r.product.id}>
                  <td>
                    {r.product.name}
                    <small>단가 {won(r.product.costPrice)}</small>
                  </td>
                  <td className="r">{qty(r.qty, r.product.unit)}</td>
                  <td className="r">{won(r.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row" colSpan={2}>
                  합계
                </th>
                <td className="r">{won(total)}</td>
              </tr>
            </tfoot>
          </table>

          {!ready && (
            <p className="hold-note" role="status">
              최소 주문 금액({won(supplier.minOrderAmount)})까지 {won(supplier.minOrderAmount - total)} 부족해서 이번에는
              보내지 않아요. 수량을 늘리면 보낼 수 있어요.
              <button className="link-btn" onClick={() => onNav('recommend')}>
                수량 조정하기
              </button>
            </p>
          )}
        </section>
      ))}

      <div className="action-bar">
        <div className="action-sum">
          <span>{sendable.length}개 업체에 발주</span>
          <b>{won(grand)}</b>
        </div>
        <div className="action-btns">
          <button className="btn btn-outline btn-lg" onClick={() => onNav('recommend')}>
            <Icon name="back" size={18} /> 수정
          </button>
          <button
            className="btn btn-primary btn-lg"
            disabled={sendable.length === 0}
            onClick={() => setDone(placeOrders(sendable.map((g) => g.supplier.id)))}
          >
            발주 확정
          </button>
        </div>
      </div>
    </>
  );
}

function Done({ orders, onNav }: { orders: PlacedOrder[]; onNav: (s: Screen) => void }) {
  const { supplierById } = useStore();
  const total = orders.reduce((s, o) => s + o.total, 0);
  return (
    <div className="done">
      <span className="done-mark">
        <Icon name="check" size={34} />
      </span>
      <h1>발주를 접수했어요</h1>
      <p className="muted">
        {orders.length}개 업체 · {won(total)}
      </p>
      <ul className="card-list left">
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
      <p className="muted">입고 예정으로 반영돼서, 다음 AI 추천부터는 중복 없이 계산돼요.</p>
      <div className="done-btns">
        <button className="btn btn-primary btn-lg" onClick={() => onNav('home')}>
          홈으로
        </button>
        <button className="btn btn-outline btn-lg" onClick={() => onNav('recommend')}>
          남은 추천 보기
        </button>
      </div>
    </div>
  );
}
