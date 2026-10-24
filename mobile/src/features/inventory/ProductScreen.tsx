import { useState } from 'react';
import { Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Badge, Button, Card, Field, Notice, ResourceState, Screen } from '../../components/common/ui';
import { useResource } from '../../hooks/useResource';
import { useAction } from '../../hooks/useAction';
import { isMock, replenishmentService, services } from '../../services';
import { RecommendationCard, SalesQuantityTrend } from '../../components/cards/ReplenishmentCards';
import { money, number, stockLabel, timestamp } from '../../utils/format';
import { ui } from '../../theme';
export default function ProductScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const query = useResource(async signal => {
    const [product, plan] = await Promise.all([services.products.get(id, signal), replenishmentService.get(signal)]);
    return { product, planning: plan.inventory.find(item => item.productId === id), recommendations: plan.recommendations.filter(item => item.productId === id) };
  }, id);
  const product = query.data?.product; const planning = query.data?.planning;
  const [counted, setCounted] = useState(''); const [reason, setReason] = useState(''); const action = useAction();
  async function count() {
    const ok = await action.run(async () => {
      if (!/^\d+$/.test(counted)) throw new Error('실사 수량은 0 이상의 정수로 입력해 주세요.');
      await services.inventory.count({ productId: id, counted: Number(counted), reason });
    }, isMock ? '데모 실사 기록 접수 예시입니다. 현재 재고에는 반영하지 않았어요.' : '실사 기록을 접수했어요.');
    if (ok) { setCounted(''); setReason(''); void query.reload() }
  }
  return <Screen title="상품 상세" loading={query.loading} onRefresh={query.reload}>
    <ResourceState {...query} hasData={!!product} retry={query.reload} />
    {product && <><Card title={product.name}><Badge label={stockLabel[product.risk.status]} tone={product.risk.status === 'normal' ? 'success' : 'warning'} /><Text style={ui.body}>바코드 {product.barcode || "미제공"}</Text><Text style={ui.muted}>{product.category} · 공급업체 {product.supplier ?? '미제공'}</Text><Text style={ui.heading}>현재 재고 {number(product.quantity)}{product.unit}</Text><Text style={ui.body}>판매가 {money(product.price)} · 최근 매입가 {money(product.purchasePrice)}</Text><Text style={ui.muted}>안전재고 {product.safetyStock ?? '미제공'} · 최근 판매량 {product.recentSales ?? '미제공'}</Text><Button title="상품 정보 수정" secondary onPress={() => router.push({ pathname: '/products/edit', params: { id } })} /></Card>
      <Card title="입고 묶음별 소비기한">{product.batches.length ? product.batches.map(b => <View key={b.id} style={ui.between}><Text style={ui.body}>{b.expiresOn ?? '소비기한 미제공'}</Text><Text style={ui.heading}>{number(b.quantity)}{product.unit}</Text></View>) : <Text style={ui.muted}>입고 묶음 정보가 없어요.</Text>}</Card>
      <Card title="최근 입출고 이력">{product.movements.length ? product.movements.map(m => <View key={m.id} style={{ gap: 4 }}><Text style={ui.body}>{m.label} · {m.quantity > 0 ? '+' : ''}{m.quantity}{product.unit}</Text><Text style={ui.muted}>{timestamp(m.at)}</Text></View>) : <Text style={ui.muted}>기록된 입출고가 없어요.</Text>}</Card>
      <Card title="입고 예정과 보충 판단"><Text style={ui.heading}>입고 예정 {planning?.incomingQuantity == null ? '미제공' : `${number(planning.incomingQuantity)}${product.unit}`}</Text><Text style={ui.muted}>현재 재고와 별도로 표시합니다. 실제 입고 확인 전에는 수량을 더하지 않아요.</Text>{planning?.overstockRisk && <Notice>{planning.riskReason ?? '과잉 재고 위험을 확인해 주세요.'}</Notice>}</Card>
      <SalesQuantityTrend planning={planning} unit={product.unit} />
      <Card title="✦ 재고 위험 분석"><Text style={ui.body}>{product.risk.reason}</Text></Card>
      {query.data?.recommendations.map(recommendation => <RecommendationCard key={recommendation.id} recommendation={recommendation} onChanged={query.reload} />)}
      <Card title="재고 실사 기록"><Notice>{isMock ? '입력한 실사 수량은 현재 재고를 직접 덮어쓰지 않습니다.' : '실사 수량으로 서버 재고가 조정됩니다(대표 로트 기준).'}</Notice><Field label={`실사 수량 (${product.unit})`} value={counted} onChangeText={setCounted} keyboardType="number-pad" /><Field label="실사 사유" value={reason} onChangeText={setReason} multiline />{action.message && <Notice error={action.failed}>{action.message}</Notice>}<Button title={action.busy ? '접수 중…' : isMock ? '데모 실사 접수' : '실사 접수'} disabled={action.busy || !counted || !reason.trim()} onPress={count} /></Card>
    </>}
  </Screen>;
}
