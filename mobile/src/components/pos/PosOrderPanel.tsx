import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import type { Product, PurchaseOrder } from '../../types/domain';
import type { PurchaseRecommendation } from '../../services/replenishment';
import { money, number, orderLabel } from '../../utils/format';
import { estimatedCost } from '../../utils/replenishment';
import { isMock } from '../../services';
import { c, counter } from './counterStyles';

interface Props {
  product?: Product;
  order?: PurchaseOrder;
  recommendation?: PurchaseRecommendation;
  quantities: string[];
  dirty: boolean;
  busy: boolean;
  loading: boolean;
  message?: string;
  failed: boolean;
  onEdit: (index: number, value: string) => void;
  onSave: () => void;
  onCreateDraft: () => void;
  onClear: () => void;
}

export function PosOrderPanel({ product, order, recommendation, quantities, dirty, busy, loading, message, failed, onEdit, onSave, onCreateDraft, onClear }: Props) {
  const editable = !!order?.allowedActions.includes('save') && isMock && !busy && !loading;
  const disabled = !product || busy || loading || (dirty && !editable) || (!order && !recommendation);
  const amount = order ? estimatedCost(order.items.map((item, index) => ({ unitCost: item.unitCost, quantity: /^\d+$/.test(quantities[index] ?? '') ? Number(quantities[index]) : NaN }))) : recommendation ? estimatedCost([{ unitCost: recommendation.unitCost, quantity: recommendation.quantity }]) : null;
  function review() { if (order) router.push({ pathname: '/purchase-orders/[id]', params: { id: order.id } }) }
  return <>
    <View style={c.panelTabs}>
      <View style={[c.panelTab, c.panelTabActive]}><Text style={[c.panelTabText, { color: counter.ink }]}>{order ? '발주 초안' : 'AI 추천'}</Text></View>
      <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/purchases', params: { view: 'orders' } })} style={c.panelTab}><Text style={c.panelTabText}>입고 내역</Text></Pressable>
      <View style={{ flex: 1 }} />
      <Pressable accessibilityRole="button" accessibilityLabel="상품 선택 해제" disabled={busy} onPress={onClear} style={c.iconButton}><Text style={{ color: '#98A1AA', fontSize: 25 }}>×</Text></Pressable>
    </View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={c.panelContent}>
      {!product ? <View style={c.empty}><Text style={c.emptyTitle}>검토할 상품을 선택해 주세요</Text><Text style={c.emptyText}>왼쪽 상품을 누르면 재고와 연결된 발주서를 확인할 수 있어요.</Text></View> : <>
        <View style={c.panelSummary}><Text style={c.panelTitle}>{order?.supplier ?? product.supplier ?? '공급업체 미제공'}</Text><Text style={c.panelNote}>{order ? `${order.id} · ${orderLabel[order.status]}` : '추천을 검토한 뒤 초안을 작성하세요'}</Text></View>
        {order ? order.items.map((item, index) => {
          const value = quantities[index] ?? '';
          const valid = /^\d+$/.test(value) && Number.isSafeInteger(Number(value));
          const subtotal = valid && item.unitCost !== null ? estimatedCost([{ quantity: Number(value), unitCost: item.unitCost }]) : null;
          return <View key={item.productId} style={[c.line, index === 0 && c.lineActive]}>
            <View style={c.between}>
              <View style={c.stepper}>
                <Pressable accessibilityRole="button" accessibilityLabel={`${item.name} 수량 줄이기`} disabled={!editable || !valid || Number(value) === 0} onPress={() => onEdit(index, String(Number(value) - 1))} style={[c.step, (!editable || !valid || Number(value) === 0) && { opacity: 0.35 }]}><Text style={c.stepText}>−</Text></Pressable>
                <TextInput accessibilityLabel={`${item.name} 발주 수량`} value={value} onChangeText={text => onEdit(index, text)} keyboardType="number-pad" editable={editable} style={c.quantity} />
                <Pressable accessibilityRole="button" accessibilityLabel={`${item.name} 수량 늘리기`} disabled={!editable || !valid || Number(value) >= Number.MAX_SAFE_INTEGER} onPress={() => onEdit(index, String(Number(value) + 1))} style={[c.step, (!editable || !valid) && { opacity: 0.35 }]}><Text style={c.stepText}>+</Text></Pressable>
              </View>
              <Text style={c.panelNote}>{item.unit}</Text>
            </View>
            <View style={c.between}><Text style={c.lineName}>{item.name}</Text><Text style={c.lineAmount}>{money(subtotal)}</Text></View>
            <Text style={c.panelNote}>매입가 {money(item.unitCost)} · 현재 재고 {number(item.currentStock)}{item.unit}</Text>
            <Text style={c.panelNote}>{item.reason}</Text>
            {item.warning && <Text style={c.panelNote}>{item.warning}</Text>}
          </View>;
        }) : <View style={[c.line, c.lineActive]}>
          <Text style={c.panelTitle}>{product.name}</Text>
          <Text style={c.panelNote}>현재 재고 {number(product.quantity)}{product.unit} · 매입가 {money(product.purchasePrice)}</Text>
          <Text style={c.panelNote}>{product.risk.reason}</Text>
          {recommendation ? <><Text style={c.lineName}>AI 추천 {number(recommendation.quantity)}{recommendation.unit}</Text><Text style={c.panelNote}>예상 수요 {recommendation.demand}{recommendation.unit} · 납기 {recommendation.leadDays}일</Text><Text style={c.panelNote}>{recommendation.reason}</Text></> : <Text style={c.panelNote}>이 상품의 발주 추천은 아직 제공되지 않았어요.</Text>}
        </View>}
        <View style={{ padding: 18, gap: 12 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="선택 상품 재고 상세" onPress={() => router.push({ pathname: '/products/[id]', params: { id: product.id } })} style={c.utilityLink}><Text style={[c.utilityText, { color: '#4D87CF' }]}>재고·소비기한 상세 보기 →</Text></Pressable>
          <Text style={c.panelNote}>{dirty ? '수정한 수량은 아직 저장되지 않았어요. 초안을 저장한 뒤 승인할 수 있습니다.' : '발주 확정은 상세 화면에서 별도로 승인합니다. 실제 입고 전에는 재고를 늘리지 않아요.'}</Text>
        </View>
      </>}
      {message && <View accessibilityRole={failed ? 'alert' : undefined} style={c.message}><Text style={[c.messageText, failed && c.error]}>{message}</Text></View>}
    </ScrollView>
    <View style={c.panelFooter}>
      <Text style={c.panelNote}>{dirty ? '수정안 예상 금액 · 미저장' : '예상 발주 금액'}{amount === null ? ' · 단가/수량 확인 필요' : ''}</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="발주서 상세 검토" disabled={!order || dirty || busy || loading} onPress={review} style={[c.subtleButton, (!order || dirty || busy || loading) && { opacity: 0.4 }]}><Text style={c.subtleText}>상세</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={order ? dirty ? '수정한 초안 저장' : '발주서 검토' : '초안 만들기'} accessibilityState={{ disabled }} disabled={disabled} onPress={order ? dirty ? onSave : review : onCreateDraft} style={[c.primary, disabled && { opacity: 0.4 }]}>
          <Text style={c.primaryLabel}>{busy ? '처리 중…' : order ? dirty ? '초안 저장' : '발주서 검토' : (isMock ? '초안 만들기' : '발주서 발행')}</Text><Text style={c.primaryValue}>{money(amount)}</Text>
        </Pressable>
      </View>
    </View>
  </>;
}
