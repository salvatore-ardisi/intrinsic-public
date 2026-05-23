import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, RefreshControl,
  StyleSheet, ActivityIndicator, Linking,
} from 'react-native';
import { colors, fonts } from '../config/theme';
import { fetchNews } from '../lib/api';
import { decodeHTMLEntities } from '../lib/html';
import type { NewsItem } from '../lib/types';
import DailySpark from '../components/DailySpark';
import type { DailySparkHandle } from '../components/DailySpark';

type NewsFilter = 'ALL' | 'LABOR' | 'INFLATION' | 'FED' | 'GROWTH' | 'RATES';
const NEWS_FILTERS: NewsFilter[] = ['ALL', 'LABOR', 'INFLATION', 'FED', 'GROWTH', 'RATES'];

const FILTER_KEYWORDS: Record<Exclude<NewsFilter, 'ALL'>, string[]> = {
  LABOR: ['unemployment', 'jobs', 'payrolls', 'nonfarm', 'hiring', 'layoffs', 'labor', 'participation', 'employment', 'wages', 'workers', 'workforce'],
  INFLATION: ['inflation', 'cpi', 'consumer prices', 'pce', 'cost of living', 'deflation', 'tariff', 'tariffs', 'prices'],
  FED: ['fed', 'fomc', 'interest rate', 'rate cut', 'rate hike', 'powell', 'monetary policy', 'tightening', 'easing', 'dovish', 'hawkish', 'central bank', 'federal reserve'],
  GROWTH: ['gdp', 'recession', 'economic growth', 'expansion', 'output', 'productivity', 'consumer spending', 'retail sales'],
  RATES: ['treasury', 'yield', 'mortgage', 'bond', '10-year', '2-year', 'yield curve', 'credit', 'spread', 'basis points', 'bps'],
};

function matchesFilter(item: NewsItem, filter: NewsFilter): boolean {
  if (filter === 'ALL') return true;
  const keywords = FILTER_KEYWORDS[filter];
  const text = `${item.title} ${item.description ?? ''}`.toLowerCase();
  return keywords.some(kw => text.includes(kw));
}

export default function NewsScreen() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<NewsFilter>('ALL');
  const sparkRef = useRef<DailySparkHandle>(null);

  const load = useCallback(async (force = false) => {
    try {
      const data = await fetchNews(force);
      setItems(data);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    console.log('[NewsScreen] onRefresh fired');
    setRefreshing(true);
    await Promise.all([load(true), sparkRef.current?.refresh()]);
    setRefreshing(false);
  }, [load]);

  const filtered = useMemo(() => {
    if (filter === 'ALL') return items;
    return items.filter(item => matchesFilter(item, filter));
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
        <>
          <DailySpark ref={sparkRef} />
          <View style={s.filterRow}>
            {NEWS_FILTERS.map(f => (
              <TouchableOpacity
                key={f}
                onPress={() => setFilter(f)}
                style={[s.filterBtn, filter === f && s.filterActive]}
              >
                <Text style={[s.filterText, filter === f && s.filterActiveText]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </>
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          onPress={() => { if (item.link) Linking.openURL(item.link); }}
          activeOpacity={0.7}
          style={s.row}
        >
          <View style={s.rowTop}>
            <View style={s.sourceBadge}>
              <Text style={s.sourceText}>{item.source}</Text>
            </View>
            <Text style={s.date}>{item.date ? formatNewsDate(item.date) : '--'}</Text>
          </View>
          <Text style={s.title} numberOfLines={3}>{decodeHTMLEntities(item.title)}</Text>
        </TouchableOpacity>
      )}
    />
  );
}

function formatNewsDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffH = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffH < 1) return `${Math.max(1, Math.floor(diffMs / 60000))}m ago`;
    if (diffH < 24) return `${diffH}h ago`;
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
  rowTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  sourceBadge: {
    borderWidth: 1, borderColor: colors.accent,
    paddingHorizontal: 6, paddingVertical: 1, marginRight: 8,
  },
  sourceText: { fontFamily: fonts.monoBold, fontSize: 9, color: colors.accent },
  date: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted },
  title: { fontFamily: fonts.mono, fontSize: 12, color: colors.textPrimary, lineHeight: 17 },
});
