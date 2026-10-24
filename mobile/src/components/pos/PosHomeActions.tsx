import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { pos } from '../../theme/pos';
import { number } from '../../utils/format';

type Symbol = 'ai' | 'barcode' | 'receiving' | 'expiry';

function TaskSymbol({ name, color }: { name: Symbol; color: string }) {
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.symbol, { borderColor: color }]}>
    {name === 'barcode' ? <View style={styles.barcode}>{[2, 4, 2, 3, 2, 4, 2].map((width, index) => <View key={index} style={{ width, height: 22, backgroundColor: color }} />)}</View>
      : <Text style={[styles.symbolText, { color }]}>{name === 'ai' ? 'AI' : name === 'receiving' ? '↓' : 'D'}</Text>}
  </View>;
}

export function PosHomeActions({ recommendationCount }: { recommendationCount?: number }) {
  const compact = useWindowDimensions().width < 360;
  const tasks = [
    { label: 'AI 발주 추천', hint: recommendationCount === undefined ? '추천 수량과 근거 확인' : `${number(recommendationCount)}개 상품 검토`, symbol: 'ai' as const, color: pos.blue, background: pos.blueSoft, onPress: () => router.push({ pathname: '/purchases', params: { view: 'recommendations' } }) },
    { label: '재고 확인', hint: '바코드로 조회', symbol: 'barcode' as const, color: pos.green, background: pos.greenSoft, onPress: () => router.push({ pathname: '/inventory', params: { status: 'all' } }) },
    { label: '상품 입고', hint: '입고 내역 조회\n등록 준비 중', symbol: 'receiving' as const, color: pos.teal, background: pos.tealSoft, onPress: () => router.push({ pathname: '/purchases', params: { view: 'orders' } }) },
    { label: '소비기한 관리', hint: '기한별 재고 확인', symbol: 'expiry' as const, color: pos.amber, background: pos.amberSoft, onPress: () => router.push({ pathname: '/inventory', params: { status: 'expiring' } }) },
  ];
  return <View style={styles.grid}>{tasks.map(task => <Pressable key={task.label} accessibilityRole="button" accessibilityLabel={task.label} accessibilityHint={task.hint} onPress={task.onPress} style={({ pressed }) => [styles.task, { backgroundColor: task.background, borderColor: task.color, opacity: pressed ? 0.72 : 1 }]}>
    <View style={styles.taskTop}><TaskSymbol name={task.symbol} color={task.color} /><Text style={[styles.arrow, { color: task.color }]}>↗</Text></View>
    <Text style={[styles.taskLabel, { color: pos.ink }, compact && { fontSize: 16, lineHeight: 24 }]}>{task.label}</Text>
    <Text style={[styles.taskHint, { color: task.color }]}>{task.hint}</Text>
  </Pressable>)}</View>;
}

export function PosWorkQueue({ pending, stockout, expiring }: { pending: number; stockout: number; expiring: number }) {
  const compact = useWindowDimensions().width < 360;
  const items = [
    { label: '승인 대기', count: pending, unit: '건', color: pos.blue, background: pos.blueSoft, onPress: () => router.push({ pathname: '/purchases', params: { view: 'approval' } }) },
    { label: '품절·부족', count: stockout, unit: '개', color: pos.red, background: pos.redSoft, onPress: () => router.push({ pathname: '/inventory', params: { status: 'risk' } }) },
    { label: '소비기한 위험', count: expiring, unit: '개', color: pos.amber, background: pos.amberSoft, onPress: () => router.push({ pathname: '/inventory', params: { status: 'expiring' } }) },
  ];
  return <View style={styles.queue}>{items.map(item => <Pressable key={item.label} accessibilityRole="button" accessibilityLabel={`${item.label} ${number(item.count)}${item.unit} 확인`} onPress={item.onPress} style={({ pressed }) => [styles.queueItem, { backgroundColor: item.background, opacity: pressed ? 0.72 : 1 }]}>
    <Text style={[styles.queueLabel, { color: item.color }]}>{compact && item.label === '소비기한 위험' ? '기한 위험' : item.label}</Text>
    <Text style={[styles.queueCount, { color: item.color }]}>{number(item.count)}<Text style={styles.queueUnit}>{item.unit}</Text></Text>
  </Pressable>)}</View>;
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: pos.gap, alignItems: 'stretch' },
  task: { flexBasis: '47%', flexGrow: 1, minWidth: 0, minHeight: 148, borderWidth: 1, borderRadius: pos.radius, padding: 16, gap: 8 },
  taskTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  taskLabel: { fontSize: 19, lineHeight: 27, fontWeight: '800', flexShrink: 1 },
  taskHint: { fontSize: 13, lineHeight: 20, fontWeight: '500', flexShrink: 1 },
  symbol: { width: 42, height: 38, borderWidth: 1.5, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  symbolText: { fontSize: 22, lineHeight: 29, fontWeight: '800' },
  barcode: { flexDirection: 'row', gap: 2 },
  arrow: { fontSize: 22, fontWeight: '600' },
  queue: { flexDirection: 'row', gap: 8, alignItems: 'stretch' },
  queueItem: { flex: 1, minWidth: 0, minHeight: 82, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 12, gap: 8, justifyContent: 'space-between' },
  queueLabel: { fontSize: 12, lineHeight: 18, fontWeight: '700' },
  queueCount: { fontSize: 26, lineHeight: 30, fontWeight: '800', fontVariant: ['tabular-nums'] },
  queueUnit: { fontSize: 13, fontWeight: '600' },
});
