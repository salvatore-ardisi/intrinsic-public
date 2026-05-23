import { useCallback, useEffect, useState, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, RefreshControl,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { MaterialTopTabNavigationProp } from '@react-navigation/material-top-tabs';
import { colors, fonts } from '../config/theme';
import { fetchFedComms } from '../lib/api';
import { decodeHTMLEntities, stripHtml } from '../lib/html';
import { findRelatedIndicators } from '../lib/crossref';
import type { RootTabParamList } from '../lib/navigation';
import type { FedComm } from '../lib/types';

const TYPE_COLORS: Record<string, string> = {
  FOMC: colors.negative,
  MINUTES: colors.accent,
  PROJECTIONS: colors.positive,
  SPEECH: colors.cyan,
  OTHER: colors.textMuted,
};

type CommsFilter = 'ALL' | 'FOMC' | 'MINUTES' | 'SPEECHES' | 'OTHER';
const COMMS_FILTERS: CommsFilter[] = ['ALL', 'FOMC', 'MINUTES', 'SPEECHES', 'OTHER'];

function matchesCommsFilter(item: FedComm, filter: CommsFilter): boolean {
  if (filter === 'ALL') return true;
  if (filter === 'FOMC') return item.type === 'FOMC';
  if (filter === 'MINUTES') return item.type === 'MINUTES';
  if (filter === 'SPEECHES') return item.type === 'SPEECH';
  return item.type !== 'FOMC' && item.type !== 'MINUTES' && item.type !== 'SPEECH';
}

export default function FedCommsScreen() {
  const [items, setItems] = useState<FedComm[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState<CommsFilter>('ALL');

  const load = useCallback(async (force = false) => {
    try {
      const data = await fetchFedComms(force);
      setItems(data);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    console.log('[FedCommsScreen] onRefresh fired');
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  }, [load]);

  const filtered = useMemo(() => {
    if (filter === 'ALL') return items;
    return items.filter(item => matchesCommsFilter(item, filter));
  }, [items, filter]);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={colors.amber} />
      </View>
    );
  }

  return (
    <FlatList
      data={filtered}
      keyExtractor={(_, i) => String(i)}
      style={s.list}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.amber} colors={[colors.amber]} progressBackgroundColor={colors.surface} />
      }
      ListHeaderComponent={
        <View style={s.filterRow}>
          {COMMS_FILTERS.map(f => (
            <TouchableOpacity
              key={f}
              onPress={() => setFilter(f)}
              style={[s.filterBtn, filter === f && s.filterActive]}
            >
              <Text style={[s.filterText, filter === f && s.filterActiveText]}>{f}</Text>
            </TouchableOpacity>
          ))}
        </View>
      }
      renderItem={({ item }) => (
        <FedCommRow
          item={item}
          isExpanded={expanded === `${item.title}:${item.date}`}
          onToggle={() => {
            const key = `${item.title}:${item.date}`;
            setExpanded(expanded === key ? null : key);
          }}
        />
      )}
    />
  );
}

function FedCommRow({ item, isExpanded, onToggle }: {
  item: FedComm;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const nav = useNavigation<MaterialTopTabNavigationProp<RootTabParamList>>();
  const typeColor = TYPE_COLORS[item.type] || colors.textMuted;
  const dateStr = item.date ? formatFedDate(item.date) : '--';
  const indicators = useMemo(
    () => findRelatedIndicators(item.title, item.summary),
    [item.title, item.summary],
  );

  return (
    <TouchableOpacity
      onPress={onToggle}
      activeOpacity={0.7}
      style={[s.row, isExpanded && s.rowExpanded]}
    >
      <View style={s.rowTop}>
        <View style={[s.badge, { borderColor: typeColor }]}>
          <Text style={[s.badgeText, { color: typeColor }]}>{item.type}</Text>
        </View>
        <Text style={s.date}>{dateStr}</Text>
      </View>
      <Text style={s.title} numberOfLines={isExpanded ? undefined : 2}>{decodeHTMLEntities(item.title)}</Text>
      {indicators.length > 0 && (
        <View style={s.indicatorTags}>
          {indicators.map(id => (
            <TouchableOpacity
              key={id}
              onPress={() => nav.navigate('Indicators', { expandedSeriesId: id })}
              style={s.indicatorTag}
            >
              <Text style={s.indicatorTagText}>{id}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      {isExpanded && item.summary ? (
        <Text style={s.summary}>{stripHtml(item.summary)}</Text>
      ) : null}
    </TouchableOpacity>
  );
}

function formatFedDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface },
  list: { flex: 1, backgroundColor: colors.surface },
  filterRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
    paddingHorizontal: 12, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  filterBtn: {
    borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  filterActive: { borderColor: colors.accent, backgroundColor: colors.accent },
  filterText: { fontFamily: fonts.monoBold, fontSize: 9, color: colors.textMuted },
  filterActiveText: { color: colors.surface },
  row: {
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.borderSubtle,
  },
  rowExpanded: { backgroundColor: colors.hoverRow },
  rowTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  badge: { borderWidth: 1, paddingHorizontal: 6, paddingVertical: 1, marginRight: 8 },
  badgeText: { fontFamily: fonts.monoBold, fontSize: 9 },
  date: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted },
  title: { fontFamily: fonts.mono, fontSize: 12, color: colors.textPrimary, lineHeight: 17 },
  summary: { fontFamily: fonts.mono, fontSize: 11, color: colors.textSecondary, lineHeight: 16, marginTop: 8 },
  indicatorTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  indicatorTag: { borderWidth: 1, borderColor: colors.accent, paddingHorizontal: 4, paddingVertical: 1 },
  indicatorTagText: { fontFamily: fonts.monoBold, fontSize: 8, color: colors.accent },
});
