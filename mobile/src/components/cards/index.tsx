import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import type { Product, PurchaseOrder } from '../../types/domain';
import { colors, ui } from '../../theme';
import { money, number, orderLabel, stockLabel } from '../../utils/format';
import { Badge } from '../common/ui';
import type { InventoryPlanning } from '../../services/replenishment';
export function MetricCard({ label, value, note, onPress }: { label: string; value: string; note?: string; onPress?: () => void }) {
  return <Pressable accessibilityRole={onPress ? 'button' : undefined} disabled={!onPress} onPress={onPress} style={[ui.card, { flexGrow: 1, flexBasis: 145, minWidth: 130 }]}><Text style={ui.muted}>{label}</Text><Text adjustsFontSizeToFit minimumFontScale={0.65} numberOfLines={1} style={{ fontSize: value.length > 9 ? 20 : 24, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] }}>{value}</Text>{note && <Text style={ui.muted}>{note}</Text>}</Pressable>;
}
export function ProductListItem({ product, planning }: { product: Product; planning?: InventoryPlanning }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`${product.name}, ${planning?.overstockRisk ? '과잉 위험' : stockLabel[product.risk.status]}, 상세 보기`} onPress={() => router.push({ pathname: '/products/[id]', params: { id: product.id } })} style={ui.card}><View style={ui.between}><Badge label={product.category} /><Badge label={planning?.overstockRisk ? '! 과잉 위험' : stockLabel[product.risk.status]} tone={planning?.overstockRisk ? 'warning' : product.risk.status === 'normal' ? 'success' : product.risk.status === 'out' ? 'danger' : 'warning'} /></View><Text style={ui.heading}>{product.name}</Text><View style={ui.between}><Text style={ui.muted}>현재 재고</Text><Text style={ui.heading}>{number(product.quantity)}{product.unit}</Text></View><Text style={ui.body}>입고 예정 {planning?.incomingQuantity == null ? '미제공' : `${number(planning.incomingQuantity)}${product.unit}`} · 최근 판매 {product.recentSales === null ? '미제공' : `${number(product.recentSales)}${product.unit}`}</Text><Text style={ui.muted}>매입가 {money(product.purchasePrice)} · 입고 예정은 현재 재고에 포함하지 않아요.</Text><Text style={ui.muted}>바코드 {product.barcode} · 상세 보기 →</Text></Pressable>;
}
export function PurchaseOrderCard({ order }: { order: PurchaseOrder }) {
  return <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/purchase-orders/[id]', params: { id: order.id } })} style={ui.card}><View style={ui.between}><Badge label={orderLabel[order.status]} tone={order.allowedActions.includes('approve') ? 'warning' : 'neutral'} /><Text style={ui.muted}>{order.id}</Text></View><Text style={ui.heading}>{order.supplier}</Text><Text style={ui.body}>{order.items.map(i => i.name).join(', ')}</Text><View style={ui.between}><Text style={ui.muted}>예상 매입액</Text><Text style={ui.heading}>{money(order.estimatedCost)}</Text></View><Text style={ui.muted}>추천 검토 및 상세 보기 →</Text></Pressable>;
}
