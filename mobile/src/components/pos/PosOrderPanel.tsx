import { Pressable, ScrollView, Text, View } from 'react-native';
import { router } from 'expo-router';
import type { Product, PurchaseOrder } from '../../types/domain';
import type { PurchaseRecommendation } from '../../services/replenishment';
import { Button } from '../common/ui';
import { RecommendationDecisionForm } from '../cards/RecommendationDecisionForm';
import { money, number, orderLabel } from '../../utils/format';
import { c, counter } from './counterStyles';

interface Props {
  product?: Product; order?: PurchaseOrder; recommendation?: PurchaseRecommendation;
  loading: boolean; onChanged: () => Promise<void>; onClear: () => void;
}
export function PosOrderPanel({ product, order, recommendation, loading, onChanged, onClear }: Props) {
  return <>
    <View style={c.panelTabs}>
      <View style={[c.panelTab, c.panelTabActive]}><Text style={[c.panelTabText, { color: counter.ink }]}>AI 스마트 발주</Text></View>
      <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/purchases', params: { view: 'orders' } })} style={c.panelTab}><Text style={c.panelTabText}>발주 내역</Text></Pressable>
      <View style={{ flex: 1 }} /><Pressable accessibilityRole="button" accessibilityLabel="상품 선택 해제" onPress={onClear} style={c.iconButton}><Text style={{ color: '#98A1AA', fontSize: 25 }}>×</Text></Pressable>
    </View>
    {product && recommendation ? <RecommendationDecisionForm recommendation={recommendation} loading={loading} onChanged={onChanged} panel /> : <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={c.panelContent}>
      {!product ? <View style={c.empty}><Text style={c.emptyTitle}>검토할 상품을 선택해 주세요</Text><Text style={c.emptyText}>상품을 선택하면 AI 추천 수량을 수정하고 발주 여부를 결정할 수 있어요.</Text></View> : <View style={{ padding: 18, gap: 16 }}>
        <Text accessibilityRole="header" style={c.panelTitle}>{product.name}</Text>
        <Text style={c.panelNote}>현재 재고 {number(product.quantity)}{product.unit} · 매입가 {money(product.purchasePrice)}</Text>
        <Text style={c.panelNote}>{product.risk.reason}</Text>
        <Text style={c.panelNote}>현재 이 상품에 대한 AI 발주 추천이 없습니다.</Text>
        {order && <><Text style={c.panelNote}>기존 발주 {order.id} · {orderLabel[order.status]}</Text><Button title="기존 발주 내역 확인" secondary onPress={() => router.push({ pathname: '/purchase-orders/[id]', params: { id: order.id } })} /></>}
        <Button title="상품 재고 상세" secondary onPress={() => router.push({ pathname: '/products/[id]', params: { id: product.id } })} />
      </View>}
    </ScrollView>}
  </>;
}
