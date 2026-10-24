import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Badge, Button, Card, Field, Notice } from '../common/ui';
import { useAction } from '../../hooks/useAction';
import { isMock, recommendationDecisions } from '../../services';
import type { PurchaseRecommendation } from '../../services/replenishment';
import { orderQuantity } from '../../services/recommendationDecisions';
import { money, number } from '../../utils/format';
import { ui } from '../../theme';

interface Props { recommendation: PurchaseRecommendation; onChanged?: () => void | Promise<void>; loading?: boolean; panel?: boolean }
const labels = { pending: '검토 대기', approved: '기존 승인 처리됨', ordered: '발주 완료', rejected: '발주 안 함', unknown: '서버 상태 확인 필요' };
export function RecommendationDecisionForm({ recommendation: rec, onChanged, loading = false, panel = false }: Props) {
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [outcomes, setOutcomes] = useState<Record<string, { status: 'ordered' | 'rejected'; orderId?: string; quantity?: number }>>({});
  const [activeId, setActiveId] = useState('');
  const [refreshWarning, setRefreshWarning] = useState('');
  const action = useAction();
  const outcome = outcomes[rec.id];
  const status = outcome?.status ?? rec.status ?? 'unknown';
  const value = quantities[rec.id] ?? String(rec.quantity);
  const valid = /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value));
  const terminal = status !== 'pending';
  const busy = action.busy || loading;
  const amount = valid && rec.unitCost !== null && Number.isSafeInteger(Number(value) * rec.unitCost) ? Number(value) * rec.unitCost : null;
  async function refresh() {
    try { await onChanged?.() } catch { setRefreshWarning('처리는 완료됐지만 목록 갱신에 실패했습니다. 새로고침해 주세요.') }
  }
  async function place() {
    if (busy || terminal || !recommendationDecisions.capabilities.placeOrder) return;
    setActiveId(rec.id); setRefreshWarning('');
    let orderId: string | undefined; let quantity: number | undefined;
    const ok = await action.run(async () => {
      quantity = orderQuantity(value);
      const result = await recommendationDecisions.placeOrder({ recommendationId: rec.id, productId: rec.productId, aiRecommendedQuantity: rec.quantity, quantity });
      orderId = result.order.id;
    }, isMock ? '샘플 발주 완료 · 실제 주문 전송이나 현재 재고 증가는 없습니다.' : '발주 완료 · 발주 내역에서 확인하세요. 현재 재고는 입고 시 반영됩니다.');
    if (ok) { setOutcomes(old => ({ ...old, [rec.id]: { status: 'ordered', orderId, quantity } })); await refresh() }
  }
  async function reject() {
    if (busy || terminal || !recommendationDecisions.capabilities.reject) return;
    setActiveId(rec.id); setRefreshWarning('');
    const ok = await action.run(() => recommendationDecisions.reject({ recommendationId: rec.id, productId: rec.productId }), isMock ? '샘플 추천을 발주 안 함으로 처리했습니다.' : '서버에서 발주 안 함 처리를 확인했습니다.');
    if (ok) { setOutcomes(old => ({ ...old, [rec.id]: { status: 'rejected' } })); await refresh() }
  }
  const orderId = outcome?.orderId ?? rec.orderId;
  const content = <>
    {panel && <Text accessibilityRole="header" style={ui.heading}>{rec.productName}</Text>}
    <View style={ui.between}><Badge label={labels[status]} tone={status === 'ordered' ? 'success' : status === 'rejected' ? 'neutral' : 'warning'} /><Text style={ui.muted}>{isMock ? '샘플 데이터' : '실제 API 응답'}</Text></View>
    <Text style={ui.body}>현재 재고 {number(rec.currentStock)}{rec.unit}</Text>
    <Text style={ui.heading}>{isMock || status === 'pending' ? 'AI 추천 발주 수량' : '서버 추천 기록 수량'} {number(rec.quantity)}{rec.unit}</Text>
    <Text style={ui.body}>{rec.reason}</Text>
    <Text style={ui.muted}>{rec.supplier} · 매입가 {money(rec.unitCost)} · 납기 {rec.leadDays}일</Text>
    {rec.warning && <Text style={ui.muted}>{rec.warning}</Text>}
    <Field label={`${rec.productName} 발주 수량`} value={value} onChangeText={text => setQuantities(old => ({ ...old, [rec.id]: text }))} keyboardType="number-pad" editable={!busy && !terminal} />
    {!valid && !terminal && <Notice error>발주 수량은 1 이상의 정수로 입력해 주세요.</Notice>}
    <Text style={ui.body}>입력 수량 예상 금액 {money(amount)}</Text>
    {status === 'ordered' && <Text style={ui.body}>최종 발주 수량 {outcome?.quantity ?? rec.finalQuantity ?? '서버 미제공'}{rec.unit}</Text>}
    {!isMock && (status === 'approved' || status === 'ordered') && <Text style={ui.muted}>현재 서버는 원래 AI 수량과 최종 수량의 별도 기록을 제공하지 않습니다.</Text>}
    {!terminal && !recommendationDecisions.capabilities.placeOrder && <Notice>{recommendationDecisions.capabilities.placeOrderUnavailableReason ?? '상품별 발주 연동 준비 중입니다. 발주 요청은 전송하지 않습니다.'}</Notice>}
    {activeId === rec.id && action.message && <Notice error={action.failed}>{action.message}</Notice>}
    {refreshWarning && activeId === rec.id && <Notice error>{refreshWarning}</Notice>}
    <Button title="상품 재고 상세" secondary disabled={busy} onPress={() => router.push({ pathname: '/products/[id]', params: { id: rec.productId } })} />
    {!terminal && <Text style={ui.muted}>발주하기를 누르면 입력한 최종 수량으로 결정합니다. 별도의 초안 작성 단계와 자동 발주는 없습니다.</Text>}
  </>;
  const actions = <>
    {!terminal && <View style={{ flexDirection: 'row', gap: 8 }}>
      <View style={{ flex: 1 }}><Button title="발주 안 함" secondary disabled={busy || !recommendationDecisions.capabilities.reject} onPress={reject} /></View>
      <View style={{ flex: 1 }}><Button title={action.busy && activeId === rec.id ? '처리 중…' : '발주하기'} disabled={busy || !valid || !recommendationDecisions.capabilities.placeOrder} onPress={place} /></View>
    </View>}
    {status === 'ordered' && <Button title="발주 내역 확인" secondary onPress={() => orderId ? router.push({ pathname: '/purchase-orders/[id]', params: { id: orderId } }) : router.push({ pathname: '/purchases', params: { view: 'orders' } })} />}
  </>;
  return panel ? <View style={{ flex: 1 }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 18, gap: 14 }}>{content}</ScrollView>{(!terminal || status === 'ordered') && <View style={{ padding: 14, borderTopWidth: 1, borderTopColor: '#E4EAF0' }}>{actions}</View>}</View> : <Card title={rec.productName}>{content}{actions}</Card>;
}
