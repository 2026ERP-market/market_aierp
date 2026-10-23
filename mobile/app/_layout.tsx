import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '../src/theme';
export default function RootLayout() {
  return <SafeAreaProvider><StatusBar style="dark" /><Stack screenOptions={{ headerTintColor: colors.text, headerStyle: { backgroundColor: colors.surface }, contentStyle: { backgroundColor: colors.background }, headerBackTitle: '뒤로' }}>
    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
    <Stack.Screen name="sales" options={{ title: '판매 데이터 참고 · 보조 화면' }} />
    <Stack.Screen name="products/[id]" options={{ title: '상품 상세' }} />
    <Stack.Screen name="products/edit" options={{ title: '상품 정보 입력' }} />
    <Stack.Screen name="purchase-orders/[id]" options={{ title: '발주 상세' }} />
    <Stack.Screen name="settings" options={{ title: '개발 설정' }} />
  </Stack></SafeAreaProvider>;
}
