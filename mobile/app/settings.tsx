import { useState } from 'react';
import { Text } from 'react-native';
import { Card, Chips, Notice, Screen } from '../src/components/common/ui';
import { apiBaseUrl, dataSource, isMock, mockServices, warehouseId } from '../src/services';
import type { MockScenario } from '../src/services/mock';
import { ui } from '../src/theme';
import { AutomationControl } from '../src/components/pos/AutomationControl';
export default function SettingsScreen() {
  const [scenario, setScenario] = useState<string>(() => mockServices.getScenario());
  return <Screen title="개발·데이터 설정" showSettings={false}><Card title="현재 데이터 소스"><Text style={ui.body}>{dataSource}</Text><Notice>앱에 로그인·권한 서버가 아직 없습니다. 데모는 실제 매장 계정과 무관합니다. 실서비스 배포 전 인증과 권한 연동이 필요합니다.</Notice></Card>
    {!isMock && <Card title="API 연결 설정"><Text style={ui.body}>서버: {apiBaseUrl || '미설정 · EXPO_PUBLIC_API_BASE_URL 설정 필요'}</Text><Text style={ui.muted}>매장: {warehouseId} · 환경변수를 변경한 뒤 Expo를 재시작하세요.</Text><Notice>서버 조회·AI 질문·상품 저장·실사·추천 거절·기존 입고를 연결합니다. 새 상품별 발주는 API 계약 준비 중입니다. 오류가 발생해도 Mock으로 바뀌지 않습니다.</Notice></Card>}
    {isMock && <Card title="데모 상태 확인"><Text style={ui.muted}>상태를 선택한 뒤 탭 화면으로 돌아가세요. 재조회 시 반영됩니다. 실제 네트워크나 사용자 권한은 변경하지 않습니다.</Text><Chips selected={scenario} onSelect={value => { setScenario(value); mockServices.setScenario(value as MockScenario) }} values={[{ value: 'normal', label: '정상' }, { value: 'empty', label: '빈 목록' }, { value: 'network', label: '네트워크 오류' }, { value: 'forbidden', label: '권한 오류' }]} /></Card>}
    <Card title="AI 자동 발주"><AutomationControl settings /></Card>
    <Card title="아직 연결되지 않은 기능"><Text style={ui.body}>계정·매장 전환, 공급업체 관리, POS 데이터 가져오기, 카메라 바코드 스캔은 후속 연동 범위입니다. 바코드는 재고 탭에서 텍스트로 검색할 수 있어요.</Text></Card>
  </Screen>;
}
