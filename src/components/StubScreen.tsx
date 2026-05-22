import { View, Text, StyleSheet } from 'react-native';
import { colors, fonts } from '../config/theme';

interface Props {
  section: string;
  title: string;
}

export default function StubScreen({ section, title }: Props) {
  return (
    <View style={s.container}>
      <Text style={s.section}>{section}</Text>
      <Text style={s.title}>{title}</Text>
      <Text style={s.sub}>COMING SOON</Text>
    </View>
  );
}

export function createStubScreen(section: string, title: string) {
  return function Stub() {
    return <StubScreen section={section} title={title} />;
  };
}

const s = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface },
  section: { fontFamily: fonts.mono, fontSize: 9, color: colors.textMuted, letterSpacing: 2, marginBottom: 4 },
  title: { fontFamily: fonts.monoBold, fontSize: 14, color: colors.accent },
  sub: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted, marginTop: 8, letterSpacing: 1 },
});
