import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts } from '../config/theme';

export default function StocksScreen() {
  return (
    <View style={s.container}>
      <Text style={s.label}>EQUITIES</Text>
      <Text style={s.sub}>Coming soon</Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface },
  label: { fontFamily: fonts.monoBold, fontSize: 14, color: colors.accent },
  sub: { fontFamily: fonts.mono, fontSize: 11, color: colors.textMuted, marginTop: 4 },
});
