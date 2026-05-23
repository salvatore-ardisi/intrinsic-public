import { useCallback, useEffect, useState, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, RefreshControl,
  StyleSheet, ActivityIndicator, Image,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useNavigation } from '@react-navigation/native';
import type { MaterialTopTabNavigationProp } from '@react-navigation/material-top-tabs';
import { colors, fonts } from '../config/theme';
import { fetchResearch, fetchSpark } from '../lib/api';
import { decodeHTMLEntities, stripHtml } from '../lib/html';
import { findRelatedIndicators } from '../lib/crossref';
import type { RootTabParamList } from '../lib/navigation';
import type { ResearchItem, SparkItem } from '../lib/types';

type MergedItem = (ResearchItem | SparkItem) & { _imageUrl?: string | null };

type Filter = 'ALL' | 'FRED BLOG' | 'BLS JOBS' | 'BLS CPI' | 'BLS ALL' | 'DAILY SPARK';
const FILTERS: Filter[] = ['ALL', 'FRED BLOG', 'BLS JOBS', 'BLS CPI', 'BLS ALL', 'DAILY SPARK'];

export default function ResearchScreen() {
  const [researchItems, setResearchItems] = useState<ResearchItem[]>([]);
  const [sparkItems, setSparkItems] = useState<SparkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    const [research, spark] = await Promise.all([
      fetchResearch(force).catch(() => [] as ResearchItem[]),
      fetchSpark(force).catch(() => [] as SparkItem[]),
    ]);
    setResearchItems(research);
    setSparkItems(spark);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  }, [load]);

  const merged: MergedItem[] = useMemo(() => {
    const all: MergedItem[] = [
      ...researchItems,
      ...sparkItems.map(s => ({ ...s, _imageUrl: s.imageUrl })),
    ];
    all.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    return all;
  }, [researchItems, sparkItems]);

  const filtered = useMemo(() => {
    if (filter === 'ALL') return merged;
    return merged.filter(i => i.feedName === filter);
  }, [merged, filter]);

  const activeFilters = useMemo(() => {
    if (sparkItems.length === 0) return FILTERS.filter(f => f !== 'DAILY SPARK');
    return FILTERS;
  }, [sparkItems.length]);

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
          {activeFilters.map(f => (
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
        <ResearchRow
          item={item}
          imageUrl={('_imageUrl' in item ? item._imageUrl : null) ?? null}
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

function ResearchRow({ item, imageUrl, isExpanded, onToggle }: {
  item: MergedItem;
  imageUrl: string | null;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const nav = useNavigation<MaterialTopTabNavigationProp<RootTabParamList>>();
  const isFred = item.source === 'FRED BLOG';
  const isSpark = item.feedName === 'DAILY SPARK';
  const badgeColor = isSpark ? colors.accent : isFred ? colors.amber : colors.cyan;
  const indicators = useMemo(
    () => findRelatedIndicators(item.title, item.description),
    [item.title, item.description],
  );

  return (
    <TouchableOpacity
      onPress={() => { if (item.link) WebBrowser.openBrowserAsync(item.link); }}
      onLongPress={onToggle}
      activeOpacity={0.7}
      style={[s.row, isExpanded && s.rowExpanded]}
    >
      <View style={s.rowTop}>
        <View style={[s.badge, { borderColor: badgeColor }]}>
          <Text style={[s.badgeText, { color: badgeColor }]}>
            {item.source}
          </Text>
        </View>
        <Text style={s.date}>{item.date ? formatRelative(item.date) : '--'}</Text>
      </View>
      <Text style={s.title} numberOfLines={isExpanded ? undefined : 2}>{decodeHTMLEntities(item.title)}</Text>
      {imageUrl && (
        <Image source={{ uri: imageUrl }} style={s.sparkImage} resizeMode="contain" />
      )}
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
      {isExpanded && item.description ? (
        <Text style={s.description}>{stripHtml(item.description)}</Text>
      ) : null}
    </TouchableOpacity>
  );
}

function formatRelative(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffH = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffH < 1) return `${Math.max(1, Math.floor(diffMs / 60000))}m ago`;
    if (diffH < 24) return `${diffH}h ago`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
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
  description: {
    fontFamily: fonts.mono, fontSize: 11, color: colors.textSecondary,
    lineHeight: 16, marginTop: 8,
  },
  sparkImage: {
    width: '100%', height: 160,
    marginTop: 8, backgroundColor: colors.surfaceAlt,
  },
  indicatorTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  indicatorTag: { borderWidth: 1, borderColor: colors.accent, paddingHorizontal: 4, paddingVertical: 1 },
  indicatorTagText: { fontFamily: fonts.monoBold, fontSize: 8, color: colors.accent },
});
