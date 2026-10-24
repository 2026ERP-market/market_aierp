import { useState, useSyncExternalStore } from 'react';
import { Modal, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { automationService } from '../../services';
import { errorMessage } from '../../services/errors';
import { Button, ConfirmDialog, Notice } from '../common/ui';
import { ui } from '../../theme';

export function AutomationControl({ onChanged, settings = false }: { onChanged?: () => Promise<void>; settings?: boolean }) {
  const state = useSyncExternalStore(automationService.subscribe, automationService.getSnapshot, automationService.getSnapshot);
  const [details, setDetails] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string>();
  async function change(enabled: boolean) {
    setConfirm(false); setError(undefined);
    try { await automationService.setEnabled(enabled) } catch (e) { setError(errorMessage(e)); setDetails(true) }
    finally { await onChanged?.() }
  }
  async function retry() {
    setError(undefined);
    try { await automationService.runDemo() } catch (e) { setError(errorMessage(e)) }
    finally { await onChanged?.() }
  }
  const status = state.enabled === null ? '연동 준비' : state.enabled ? 'ON' : 'OFF';
  const toggle = (dark: boolean) => <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
    <Pressable accessibilityRole="button" accessibilityLabel="자동 발주 설정 열기" onPress={() => setDetails(true)} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: dark ? '#fff' : '#303842', fontWeight: '700', fontSize: 13 }}>자동 발주 {status}</Text></Pressable>
    <View style={{ minHeight: 44, justifyContent: 'center' }}><Switch accessibilityLabel="AI 자동 발주 모드" value={state.enabled === true} disabled={!state.available || (state.running && !state.enabled)} onValueChange={enabled => { if (enabled) setConfirm(true); else void change(false) }} trackColor={{ false: '#6B7886', true: '#3182F6' }} thumbColor="#fff" /></View>
  </View>;
  const panel = <View style={{ gap: 12 }}>
    {toggle(false)}
    <Notice>{state.source === 'mock' ? '샘플 자동화 · 실제 AI 예측·공급업체 전송 없음. ON 시 현재 미처리 샘플 추천을 별도 승인 없이 발주 내역에 반영합니다. 앱 재시작 시 OFF로 초기화됩니다.' : (state.available ? '실제 API 모드 · 서버 자동 발주 연동됨. ON 설정 시 AI 추천을 서버 정책에 따라 자동으로 발주합니다.' : '실제 API 모드 · 자동화 서버 미연동. 현재 서버의 설정 상태를 알 수 없어 ON/OFF를 표시하거나 변경하지 않습니다.')}</Notice>
    <Text style={ui.body}>자동화 ON: AI 추천 → 추천 수량으로 자동 발주 → 발주 내역 → 입고 확인. 개별 초안 저장·사용자 승인 단계를 거치지 않습니다.</Text>
    <Text style={ui.muted}>OFF는 다음 발주부터 중단합니다. 이미 처리 중이거나 생성된 발주를 취소하지 않습니다. 재고는 실제 입고 확인 전까지 증가하지 않습니다.</Text>
    {state.source === 'mock' && <Text style={ui.muted}>현재 데모는 ON 시 한 번 실행하며, 이후 아래 버튼으로 추천 발생 이벤트를 재현합니다. 앱이 닫힌 동안의 자동 실행·예약·서버 저장 기능은 없습니다. 샘플 추천의 주의 문구와 별개로 데모 발주를 생성하며 운영 정책을 검증한 것은 아닙니다.</Text>}
    {state.running && <Notice>{state.source === 'mock' ? '샘플 ' : ''}자동 발주 처리 중… OFF로 바꾸면 다음 상품부터 중단합니다.</Notice>}
    {(error || state.error) && <Notice error>{error || state.error}</Notice>}
    {state.runs > 0 && <Text style={ui.body}>{state.source === 'mock' ? '최근 샘플 실행' : '최근 실행'}: 발주 {state.results.filter(r => r.status === 'ordered').length}건 · 제외 {state.results.filter(r => r.status === 'skipped').length}건 · 실패 {state.results.filter(r => r.status === 'failed').length}건{state.results.length === 0 ? ' · 새로 처리한 추천 없음' : ''}</Text>}
    {state.results.map((result, index) => <View key={result.runId ?? `${result.recommendationId}-${result.orderId ?? index}`} style={{ gap: 6 }}><Text style={ui.body}>{result.productName} · {result.quantity}개</Text><Notice error={result.status === 'failed'}>{result.message}</Notice>{result.orderId && <Button secondary title={`${state.source === 'mock' ? '샘플 ' : ''}발주 ${result.orderId} 보기`} onPress={() => { setDetails(false); router.push({ pathname: '/purchase-orders/[id]', params: { id: result.orderId! } }) }} />}</View>)}
    {state.source === 'mock' && <Button title="샘플 추천 이벤트 재실행 / 재시도" disabled={!state.enabled || state.running} onPress={() => { void retry() }} secondary />}
    <Button title="발주 내역 확인" secondary onPress={() => { setDetails(false); router.push({ pathname: '/purchases', params: { view: 'orders' } }) }} />
  </View>;
  return <>
    {settings ? panel : toggle(true)}
    <Modal visible={details} transparent animationType="fade" onRequestClose={() => setDetails(false)}><View style={{ flex: 1, backgroundColor: '#17243C99', padding: 16, justifyContent: 'center' }}><SafeAreaView style={{ maxHeight: '90%', maxWidth: 560, width: '100%', alignSelf: 'center', backgroundColor: '#fff', borderRadius: 16 }}><ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}><Text accessibilityRole="header" style={ui.heading}>AI 자동 발주 설정</Text>{panel}<Button title="닫기" secondary onPress={() => setDetails(false)} /></ScrollView></SafeAreaView></View></Modal>
    <ConfirmDialog visible={confirm} title={state.source === 'mock' ? '샘플 자동 발주를 켤까요?' : 'AI 자동 발주를 켤까요?'} text={state.source === 'mock' ? '현재 미처리 샘플 추천을 AI 추천 수량으로 즉시 발주합니다. 개별 승인은 받지 않습니다. 실제 매장 저장·공급업체 전송은 없으며, 현재 재고는 그대로 유지됩니다.' : '현재 미처리 AI 추천을 서버 정책 검증 후 즉시 발주서로 발행합니다. 개별 상품 승인은 받지 않으며, 현재 재고는 실제 입고 등록 전까지 유지됩니다.'} confirmLabel={state.source === 'mock' ? '샘플 자동 발주 켜기' : 'AI 자동 발주 켜기'} onCancel={() => setConfirm(false)} onConfirm={() => { setDetails(true); void change(true) }} />
  </>;
}
