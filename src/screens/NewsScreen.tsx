import { useCallback, useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, RefreshControl,
  StyleSheet, ActivityIndicator, Linking,
} from 'react-native';
import { colors, fonts } from '../config/theme';
import { fetchNews } from '../lib/api';
import { decodeHTMLEntities } from '../lib/html';
import type { NewsItem } from '../lib/types';
import DailySpark from '../components/DailySpark';

export default function NewsScreen() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
    await load(true);
    setRefreshing(false);
  }, [load]);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={colors.amber} />
      </View>
    );
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(_, i) => String(i)}
      style={s.list}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.amber} colors={[colors.amber]} progressBackgroundColor={colors.surface} />
      }
      ListHeaderComponent={
        <>
          <DailySpark />
          <View style={s.statusBar}>
            <Text style={s.statusText}>{items.length} ARTICLES</Text>
            <Text style={s.statusSep}>|</Text>
            <Text style={s.statusText}>MULTI-SOURCE RSS</Text>
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
  statusBar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: colors.surfaceAlt, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  statusText: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted },
  statusSep: { fontFamily: fonts.mono, fontSize: 10, color: colors.border, marginHorizontal: 6 },
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
