import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import type { DashboardSummary, InventorySummary, PurchaseOrder } from '../../types/domain';
import type { ReplenishmentPlan } from '../../services/replenishment';
import { isMock, replenishmentService, services } from '../../services';
import { useAction } from '../../hooks/useAction';
import { ConfirmDialog, ResourceState } from '../common/ui';
import { PosCatalog } from './PosCatalog';
import { PosOrderPanel } from './PosOrderPanel';
import { c } from './counterStyles';

interface Props {
  data?: { summary: DashboardSummary; plan: ReplenishmentPlan; inventory: InventorySummary; orders: PurchaseOrder[] };
  loading: boolean; error?: string; onRefresh: () => Promise<void>; onOpenOverview: () => void;
}

export function PosWorkspace({ data, loading, error, onRefresh, onOpenOverview }: Props) {
  const { width } = useWindowDimensions();
  const wide = width >= 950;
  const panelWidth = wide ? Math.min(400, Math.max(320, width * 0.3)) : width;
  const [selectedId, setSelectedId] = useState<string | null>();
  const [mobilePanel, setMobilePanel] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [confirmation, setConfirmation] = useState<'create' | 'clear' | 'overview'>();
  const [edits, setEdits] = useState<Record<string, string[]>>({});
  const action = useAction();
  const products = data?.inventory.products ?? [];
  const product = selectedId === null ? undefined : products.find(item => item.id === selectedId) ?? products[0];
  const recommendation = data?.plan.recommendations.find(item => item.productId === product?.id);
  const order = recommendation ? data?.orders.find(item => item.id === recommendation.draftId) : data?.orders.find(item => item.status !== 'cancelled' && item.items.some(line => line.productId === product?.id));
  const quantities = order ? edits[order.id] ?? order.items.map(item => String(item.quantity)) : [];
  const dirty = !!order && order.items.some((item, index) => quantities[index] !== String(item.quantity));
  const pending = isMock ? data?.orders.filter(item => item.allowedActions.includes('approve')).length : data?.orders.length;
  const hasUnsaved = data?.orders.some(item => edits[item.id] && item.items.some((line, index) => edits[item.id]?.[index] !== String(line.quantity)));
  function openOverview() { if (action.busy) return; if (hasUnsaved) setConfirmation('overview'); else onOpenOverview() }

  async function save() {
    if (!order || !isMock || !order.allowedActions.includes('save') || loading) return;
    await action.run(async () => {
      if (quantities.length !== order.items.length || quantities.some(value => !/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)))) throw new Error('수량은 0 이상의 안전한 정수로 입력해 주세요.');
      await services.purchases.save(order.id, quantities.map(Number));
      setEdits(current => { const next = { ...current }; delete next[order.id]; return next });
      await onRefresh();
    }, '샘플 초안을 저장했습니다. 실제 발주는 전송하지 않았습니다.');
  }
  async function createDraft() {
    if (!recommendation || !isMock || loading) return;
    setConfirmation(undefined);
    await action.run(async () => { await replenishmentService.createDraft(recommendation.id); await onRefresh() }, '샘플 초안을 만들었습니다. 승인하려면 발주서를 검토하세요.');
  }
  function clear() {
    setSelectedId(null);
    setConfirmation(undefined);
    if (order) setEdits(current => { const next = { ...current }; delete next[order.id]; return next });
  }
  function openOrders() { router.push({ pathname: '/purchases', params: { view: 'orders' } }) }
  const navigation = <View style={[c.mainTabs, !wide && { flexBasis: '100%' }]}><View style={c.mainTab}><Text accessibilityRole="header" style={[c.mainTabText, c.tabActive]}>발주하기</Text></View><View style={c.tabDivider} /><Pressable accessibilityRole="button" onPress={openOrders} style={c.mainTab}><Text style={c.mainTabText}>발주 현황</Text>{pending !== undefined && <View style={c.count}><Text style={c.countText}>{pending}</Text></View>}</Pressable></View>;
  return <SafeAreaView edges={['top', 'left', 'right']} style={c.root}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <View style={[c.bar, !wide && c.barMobile]}>
        <View style={c.barLeft}><Pressable accessibilityRole="button" accessibilityLabel="업무 메뉴 열기" onPress={() => setDrawer(true)} style={c.iconButton}><Text style={c.iconText}>☰</Text></Pressable><View style={c.pill}><Text style={c.pillText}>{isMock ? '샘플 ON' : 'API 모드'}</Text><View style={c.pillDot} /></View></View>
        {wide && navigation}
        <View style={[c.barRight, !wide && { marginLeft: 'auto' }]}>{wide && data && <Text style={c.time}>갱신 {new Date(data.plan.updatedAt).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit' })}</Text>}<Pressable accessibilityRole="button" accessibilityLabel="발주 승인 대기 확인" onPress={() => router.push({ pathname: '/purchases', params: { view: 'approval' } })} style={c.iconButton}><View style={{ alignItems: 'center' }}><View style={{ width: 17, height: 19, borderTopLeftRadius: 9, borderTopRightRadius: 9, backgroundColor: '#D9E0E5' }} /><View style={{ width: 23, height: 3, borderRadius: 2, backgroundColor: '#D9E0E5' }} /><View style={{ width: 5, height: 3, marginTop: 2, borderRadius: 2, backgroundColor: '#D9E0E5' }} /></View></Pressable><Pressable accessibilityRole="button" accessibilityLabel="설정 열기" onPress={() => router.push('/settings')} style={c.iconButton}><Text style={c.iconText}>⋮</Text></Pressable></View>
        {!wide && navigation}
      </View>
      <View style={c.source}><Text style={c.sourceText}>{isMock ? '샘플 데이터 · 실제 발주·입고·결제 없음' : '실제 API · 서버 조회 / 발주 변경 연동 준비 중'}</Text>{data && <Text style={c.sourceText}>{data.summary.store.name} · 부족/품절 {data.summary.stockoutCount} · 소비기한 주의 {data.summary.expiringCount}</Text>}</View>
      {(loading || error) && <View style={{ padding: 12 }}><ResourceState loading={loading} error={error} hasData={!!data} retry={onRefresh} /></View>}
      {!wide && <View style={c.mobileSwitch}>{[{ label: '상품 선택', value: false }, { label: '발주 패널', value: true }].map(tab => <Pressable key={tab.label} accessibilityRole="tab" accessibilityState={{ selected: mobilePanel === tab.value }} onPress={() => setMobilePanel(tab.value)} style={[c.mobileSwitchButton, mobilePanel === tab.value && c.mobileSwitchActive]}><Text style={c.mobileSwitchText}>{tab.label}</Text></Pressable>)}</View>}
      <View style={c.body}>
        {(wide || !mobilePanel) && <PosCatalog products={products} plan={data?.plan} selectedId={product?.id} width={wide ? width - panelWidth : width} onSelect={id => { setSelectedId(id); if (!wide) setMobilePanel(true) }} onRefresh={onRefresh} onOpenOverview={openOverview} />}
        {(wide || mobilePanel) && <View style={[c.panel, { width: panelWidth, flex: wide ? undefined : 1 }]}><PosOrderPanel product={product} order={order} recommendation={recommendation} quantities={quantities} dirty={dirty} busy={action.busy} loading={loading} message={action.message} failed={action.failed} onEdit={(index, value) => { if (order) setEdits(current => ({ ...current, [order.id]: quantities.map((quantity, position) => position === index ? value : quantity) })) }} onSave={save} onCreateDraft={() => setConfirmation('create')} onClear={() => dirty ? setConfirmation('clear') : clear()} /></View>}
      </View>
      <Modal visible={drawer} transparent animationType="fade" onRequestClose={() => setDrawer(false)}><View style={c.backdrop}><SafeAreaView style={c.drawer}><ScrollView><Text style={c.drawerTitle}>매장 업무</Text>{[
        { label: '발주 화면으로', run: () => setDrawer(false) }, { label: '업무 요약 보기', run: openOverview },
        { label: '재고 확인', run: () => router.push('/inventory') }, { label: '발주·입고 내역', run: openOrders },
        { label: 'AI 도우미', run: () => router.push('/agent') }, { label: '설정', run: () => router.push('/settings') },
      ].map(item => <Pressable key={item.label} accessibilityRole="button" onPress={() => { setDrawer(false); item.run() }} style={[c.drawerItem, { marginBottom: 10 }]}><Text style={c.drawerText}>{item.label}</Text></Pressable>)}<Text style={c.panelNote}>입고 등록과 실제 API 연결은 준비 중입니다. POS 결제 기능은 제공하지 않습니다.</Text></ScrollView></SafeAreaView><Pressable accessibilityRole="button" accessibilityLabel="업무 메뉴 닫기" onPress={() => setDrawer(false)} style={{ flex: 1 }} /></View></Modal>
      <ConfirmDialog visible={!!confirmation} title={confirmation === 'overview' ? '편집을 종료하고 요약을 볼까요?' : confirmation === 'clear' ? '편집한 수량을 지울까요?' : '샘플 발주 초안을 만들까요?'} text={confirmation === 'overview' ? '저장하지 않은 수량 입력은 사라집니다. 보존하려면 취소한 뒤 초안을 저장하세요.' : confirmation === 'clear' ? '저장하지 않은 수량 입력과 화면 선택만 지웁니다. 기존 발주서는 삭제되지 않습니다.' : `${product?.name ?? ''}의 AI 추천으로 샘플 초안을 만듭니다. 실제 발주 전송과 승인은 수행하지 않습니다.`} onCancel={() => setConfirmation(undefined)} onConfirm={confirmation === 'overview' ? onOpenOverview : confirmation === 'clear' ? clear : createDraft} busy={action.busy} confirmLabel={confirmation === 'overview' ? '업무 요약으로 이동' : confirmation === 'clear' ? '편집 지우기' : '샘플 초안 만들기'} />
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
