import { useState } from 'react';
import { Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Badge, Button, Card, ConfirmDialog, Field, Notice, ResourceState, Screen } from '../../components/common/ui';
import { useAction } from '../../hooks/useAction';
import { useResource } from '../../hooks/useResource';
import { isMock, replenishmentService, services } from '../../services';
import { BudgetCard } from '../../components/cards/ReplenishmentCards';
import { estimatedCost } from '../../utils/replenishment';
import { money, number, orderLabel } from '../../utils/format';
import { ui } from '../../theme';
export default function OrderScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const query = useResource(async signal => {
    const [order, plan] = await Promise.all([services.purchases.get(id, signal), replenishmentService.get(signal)]);
    return { order, budget: plan.budget };
  }, id);
  const order = query.data?.order; const [draft, setDraft] = useState<{ id: string; quantities: string[] }>(); const [confirm, setConfirm] = useState(false); const action = useAction();
  const [recv, setRecv] = useState<{ id: string; qty: string[]; expiry: string }>();
  const quantities = draft?.id === id ? draft.quantities : order?.items.map(i => String(i.quantity)) ?? [];
  const dirty = !!order && order.items.some((item, i) => String(item.quantity) !== quantities[i]);
  const draftCost = order ? estimatedCost(order.items.map((item, index) => ({ unitCost: item.unitCost, quantity: /^\d+$/.test(quantities[index] ?? '') ? Number(quantities[index]) : NaN }))) : null;
  async function save() {
    const ok = await action.run(async () => {
      if (quantities.some(q => !/^\d+$/.test(q))) throw new Error('모든 수량은 0 이상의 정수로 입력해 주세요.');
      await services.purchases.save(id, quantities.map(Number));
    }, '데모 초안을 저장했어요. 아직 발주 승인은 하지 않았습니다.');
    if (ok) { await query.reload(); setDraft(undefined) }
  }
  async function approve() {
    const ok = await action.run(() => services.purchases.approve(id), '데모 승인이 완료됐어요. 실제 주문 전송이나 재고 증가는 수행하지 않았습니다.');
    setConfirm(false); if (ok) void query.reload();
  }
  const recvQty = recv?.id === id ? recv.qty : order?.items.map(i => String(i.quantity)) ?? [];
  const recvExpiry = recv?.id === id ? recv.expiry : '';
  async function receive() {
    if (!order) return;
    const ok = await action.run(async () => {
      if (recvQty.some(q => !/^\d+$/.test(q))) throw new Error('입고 수량은 0 이상의 정수로 입력해 주세요.');
      if (recvExpiry.trim() && !/^\d{4}-\d{2}-\d{2}$/.test(recvExpiry.trim())) throw new Error('소비기한은 YYYY-MM-DD 형식으로 입력해 주세요.');
      await services.purchases.receive(id, order.items.map((_, i) => ({ receivedQty: Number(recvQty[i]), expiry: recvExpiry.trim() || null })));
    }, '입고를 등록했어요. 재고에 반영됩니다.');
    if (ok) { setRecv(undefined); void query.reload() }
  }
  return <Screen title="발주서 검토" loading={query.loading} onRefresh={action.busy || dirty ? undefined : query.reload}>
    <ResourceState {...query} hasData={!!order} retry={query.reload} />
    {order && <><Card title={order.supplier}><View style={ui.between}><Badge label={orderLabel[order.status]} /><Text style={ui.muted}>{order.id}</Text></View><Text style={ui.heading}>저장된 예상 매입액 {money(order.estimatedCost)}</Text><Notice>추천 수량을 확인해도 실제 발주가 확정되지 않습니다. 승인과 입고는 각각 다른 단계예요.</Notice></Card>
      {order.items.map((item, index) => <Card key={item.productId} title={item.name}><Text style={ui.body}>현재 재고 {number(item.currentStock)}{item.unit} · 예상 판매 {number(item.expectedSales)}{item.unit}</Text><Text style={ui.muted}>공급 납기 {number(item.leadDays)}일 · 단위 매입가 {money(item.unitCost)}</Text><Badge label={`AI 추천 ${number(item.recommended)}${item.unit}`} /><Text style={ui.body}>{item.reason}</Text>{item.warning && <Notice>{item.warning}</Notice>}<Field label={`초안 수량 (${item.unit})`} value={quantities[index] ?? ''} keyboardType="number-pad" editable={!action.busy && order.allowedActions.includes('save') && isMock} onChangeText={value => setDraft({ id, quantities: quantities.map((q, i) => i === index ? value : q) })} /></Card>)}
      <BudgetCard budget={query.data?.budget ?? null} estimatedCost={draftCost} label={dirty ? '수정안 예상 금액 · 미저장' : '현재 발주서 예상 금액'} />
      <Card title="초안 저장과 승인">{action.message && <Notice error={action.failed}>{action.message}</Notice>}{dirty && <Notice>수량을 변경했어요. 초안을 저장한 뒤 승인할 수 있습니다.</Notice>}<Button title={action.busy ? '처리 중…' : '초안 저장'} disabled={action.busy || query.loading || !isMock || !order.allowedActions.includes('save') || !dirty} onPress={save} /><Button title="저장된 초안 승인" disabled={action.busy || query.loading || dirty || !isMock || !order.allowedActions.includes('approve')} onPress={() => setConfirm(true)} /><Text style={ui.muted}>가능한 작업은 서비스가 반환한 allowedActions를 따릅니다. 실제 API의 상태·권한 규칙은 협의가 필요합니다.</Text></Card>
      <Card title="실제 입고 내역">{order.receipts.length ? order.receipts.map((receipt, index) => <Text key={index} style={ui.body}>{receipt.date ?? "날짜 미제공"} · {receipt.name} · {receipt.quantity}개</Text>) : <Text style={ui.muted}>확인된 입고 내역이 없어요. 승인만으로 재고를 늘리지 않습니다.</Text>}</Card>
      {order.status === 'ordered' ? <Card title="입고 등록">
        <Notice>입고 수량과 소비기한을 확인하고 등록하면 로트 재고로 반영됩니다.</Notice>
        {order.items.map((item, i) => <Field key={item.productId} label={`${item.name} 입고 수량 (${item.unit})`} value={recvQty[i] ?? ''} keyboardType="number-pad" editable={!action.busy} onChangeText={value => setRecv({ id, qty: recvQty.map((q, idx) => idx === i ? value : q), expiry: recvExpiry })} />)}
        <Field label="소비기한 (YYYY-MM-DD · 선택)" value={recvExpiry} onChangeText={value => setRecv({ id, qty: recvQty, expiry: value })} />
        <Button title={action.busy ? '등록 중…' : '입고 등록'} disabled={action.busy} onPress={receive} />
      </Card> : <Notice>이미 입고되었거나 입고할 수 없는 발주서입니다.</Notice>}
      <ConfirmDialog visible={confirm} title="데모 초안을 승인할까요?" text={`${order.supplier}\n예상 매입액 ${money(order.estimatedCost)}\n샘플 상태만 변경됩니다. 실제 발주·입고는 수행하지 않아요.`} busy={action.busy} onCancel={() => setConfirm(false)} onConfirm={approve} />
    </>}
  </Screen>;
}
