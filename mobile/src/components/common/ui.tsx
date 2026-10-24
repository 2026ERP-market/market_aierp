import type { PropsWithChildren, ReactNode } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView, Text, TextInput, View, type TextInputProps } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { colors, ui } from '../../theme';
import { isMock } from '../../services';
export function Button({ title, onPress, disabled, secondary = false }: { title: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [ui.button, secondary && { backgroundColor: colors.primarySoft }, { opacity: disabled ? 0.45 : pressed ? 0.75 : 1 }]}><Text style={{ fontSize: 16, fontWeight: '700', color: secondary ? colors.primary : '#fff', textAlign: 'center' }}>{title}</Text></Pressable>;
}
export function Screen({ title, subtitle, children, loading, onRefresh, action, showSettings = true, variant = 'standard' }: PropsWithChildren<{ title: string; subtitle?: string; loading?: boolean; onRefresh?: () => void; action?: ReactNode; showSettings?: boolean; variant?: 'standard' | 'pos' }>) {
  return <SafeAreaView edges={['top', 'left', 'right']} style={ui.page}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[ui.content, variant === 'pos' && { gap: 14, paddingTop: 16 }]} refreshControl={onRefresh ? <RefreshControl refreshing={!!loading} onRefresh={onRefresh} /> : undefined}>
    <View style={ui.between}><Text style={{ color: colors.primary, fontWeight: '700', fontSize: 14 }}>MARKET / 매장 관리</Text>{showSettings && <Button title="설정" secondary onPress={() => router.push('/settings')} />}</View>
    <Notice>{isMock ? variant === 'pos' ? '샘플 데이터 · 실제 발주·입고 없음' : '데모 데이터 · 실제 매장과 연결되지 않아요. 변경은 메모리에서만 유지되며 앱 재시작 시 초기화됩니다.' : '실제 API 모드 · 서버 응답을 표시합니다. 초안 수정·승인·입고 등록은 연동 준비 중입니다.'}</Notice>
    <View style={ui.between}><View style={{ flex: 1, minWidth: 200, gap: 6 }}><Text accessibilityRole="header" style={ui.title}>{title}</Text>{subtitle && <Text style={ui.muted}>{subtitle}</Text>}</View>{action}</View>
    {children}
  </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}
export function Card({ title, children }: PropsWithChildren<{ title?: string }>) { return <View style={ui.card}>{title && <Text accessibilityRole="header" style={ui.heading}>{title}</Text>}{children}</View> }
export function Notice({ children, error = false }: PropsWithChildren<{ error?: boolean }>) { return <View accessibilityRole={error ? 'alert' : undefined} style={{ backgroundColor: error ? colors.dangerSoft : colors.primarySoft, padding: 12, borderRadius: 12 }}><Text style={[ui.muted, { color: error ? colors.danger : colors.primary }]}>{children}</Text></View> }
export function Badge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'warning' | 'danger' | 'success' }) {
  const palette = { neutral: [colors.primarySoft, colors.primary], warning: [colors.warningSoft, colors.warning], danger: [colors.dangerSoft, colors.danger], success: [colors.successSoft, colors.success] }[tone];
  return <View style={{ alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: palette[0] }}><Text style={{ color: palette[1], fontSize: 13, fontWeight: '600' }}>{label}</Text></View>;
}
export function ResourceState({ loading, error, hasData, retry }: { loading: boolean; error?: string; hasData: boolean; retry: () => void }) {
  return <>{loading && <View style={ui.row}><ActivityIndicator color={colors.primary} /><Text style={ui.muted}>{hasData ? '최신 데이터를 확인하고 있어요…' : '데이터를 불러오고 있어요…'}</Text></View>}{error && <Card><Notice error>{error}{hasData ? '\n아래는 이전에 불러온 데이터입니다.' : ''}</Notice><Button title="다시 시도" secondary onPress={retry} /></Card>}</>;
}
export function EmptyState({ text = '표시할 데이터가 없어요.' }: { text?: string }) { return <Card><Text style={ui.heading}>아직 내역이 없어요</Text><Text style={ui.muted}>{text}</Text></Card> }
export function Field({ label, ...props }: TextInputProps & { label: string }) { return <View style={{ gap: 6 }}><Text style={ui.muted}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor={colors.muted} style={ui.input} {...props} /></View> }
export function Chips({ values, selected, onSelect }: { values: { label: string; value: string }[]; selected: string; onSelect: (value: string) => void }) {
  return <View style={[ui.row, { gap: 8 }]}>{values.map(value => <Pressable key={value.value} accessibilityRole="button" accessibilityState={{ selected: selected === value.value }} onPress={() => onSelect(value.value)} style={{ minHeight: 44, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, backgroundColor: selected === value.value ? colors.primary : colors.surface, borderWidth: 1, borderColor: selected === value.value ? colors.primary : colors.border }}><Text style={{ fontSize: 14, fontWeight: '600', color: selected === value.value ? '#fff' : colors.muted }}>{value.label}</Text></Pressable>)}</View>;
}
export function ConfirmDialog({ visible, title, text, onCancel, onConfirm, busy, confirmLabel = '확인 후 승인' }: { visible: boolean; title: string; text: string; onCancel: () => void; onConfirm: () => void; busy?: boolean; confirmLabel?: string }) {
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { if (!busy) onCancel() }}><View style={{ flex: 1, backgroundColor: '#17243C99', justifyContent: 'center', padding: 24 }}><View accessibilityViewIsModal style={[ui.card, { maxWidth: 480, width: '100%', alignSelf: 'center' }]}><Text accessibilityRole="header" style={ui.heading}>{title}</Text><Text style={ui.body}>{text}</Text><Button title={busy ? '처리 중…' : confirmLabel} disabled={busy} onPress={onConfirm} /><Button title="취소" secondary disabled={busy} onPress={onCancel} /></View></View></Modal>;
}
