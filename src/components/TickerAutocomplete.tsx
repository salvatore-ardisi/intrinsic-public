import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, fonts } from '../config/theme';
import type { TickerEntry } from '../lib/types';

interface Props {
  suggestions: TickerEntry[];
  onSelect: (entry: TickerEntry) => void;
}

export default function TickerAutocomplete({ suggestions, onSelect }: Props) {
  if (suggestions.length === 0) return null;

  return (
    <View style={s.container}>
      {suggestions.map(entry => (
        <TouchableOpacity
          key={entry.ticker}
          style={s.row}
          activeOpacity={0.7}
          onPress={() => onSelect(entry)}
        >
          <Text style={s.ticker}>{entry.ticker}</Text>
          <Text style={s.name} numberOfLines={1}>{entry.title}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
  },
  ticker: {
    fontFamily: fonts.monoBold,
    fontSize: 11,
    color: colors.accent,
    width: 60,
  },
  name: {
    flex: 1,
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textSecondary,
  },
});
