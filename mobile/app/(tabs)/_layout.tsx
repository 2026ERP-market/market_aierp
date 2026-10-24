import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../src/theme';
export default function TabLayout() {
  const insets = useSafeAreaInsets();
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.muted, tabBarLabelStyle: { fontSize: 12 }, tabBarStyle: { height: 68 + insets.bottom, paddingBottom: 8 + insets.bottom, paddingTop: 8, borderTopColor: colors.border } }}>
    {([{ name: 'index', title: '홈', icon: '⌂' }, { name: 'inventory', title: '재고', icon: '▤' }, { name: 'purchases', title: '발주', icon: '↗' }, { name: 'agent', title: 'AI', icon: '✦' }] as const).map(tab => <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.title, tabBarIcon: ({ color }) => <Text accessibilityElementsHidden style={{ fontSize: 23, color }}>{tab.icon}</Text> }} />)}
  </Tabs>;
}
