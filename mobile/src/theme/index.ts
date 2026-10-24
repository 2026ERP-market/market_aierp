import { StyleSheet } from 'react-native';
export const colors = { primary: '#2458D3', primarySoft: '#EDF2FF', text: '#17243C', muted: '#52647D', background: '#F5F7FB', surface: '#FFFFFF', border: '#DEE5EF', danger: '#B32935', dangerSoft: '#FFF0F0', warning: '#865300', warningSoft: '#FFF5DF', success: '#176B4C', successSoft: '#E8F5EE' };
export const ui = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: { width: '100%', maxWidth: 1000, alignSelf: 'center', padding: 20, gap: 18, paddingBottom: 40 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  card: { backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, padding: 18, gap: 12 },
  title: { fontSize: 27, lineHeight: 36, fontWeight: '700', color: colors.text },
  heading: { fontSize: 18, lineHeight: 26, fontWeight: '700', color: colors.text },
  body: { fontSize: 16, lineHeight: 25, color: colors.text, flexShrink: 1 },
  muted: { fontSize: 14, lineHeight: 22, color: colors.muted, flexShrink: 1 },
  input: { minHeight: 48, padding: 12, borderWidth: 1, borderColor: '#AAB8CC', borderRadius: 12, backgroundColor: colors.surface, color: colors.text, fontSize: 16 },
  button: { minHeight: 48, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  divider: { height: 1, backgroundColor: colors.border },
});
