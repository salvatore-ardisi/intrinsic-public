import { useCallback, useEffect, useState, useMemo } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, RefreshControl,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { colors, fonts } from '../config/theme';
import { fetchCompanyNews } from '../lib/api';
import CompanyPicker from '../components/CompanyPicker';
import type { CompanyNewsItem } from '../lib/types';
import type { StocksTabParamList } from '../lib/navigation';

const STORAGE_KEY = 'watchlist_tickers';

function formatRelativeTime(dateStr: string): string {
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

export default function StockNewsScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<StocksTabParamList, 'StockNews'>>();
  const paramTicker = route.params?.ticker;
  const [items, setItems] = useState<CompanyNewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [emptyWatchlist, setEmptyWatchlist] = useState(false);
  const [tickers, setTickers] = useState<string[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string>(paramTicker?.toUpperCase() ?? 'ALL');

  const load = useCallback(async (force = false) => {
    let wlTickers: string[] = [];
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) wlTickers = parsed;
      }
    } catch {}

    if (wlTickers.length === 0) {
      setEmptyWatchlist(true);
      setItems([]);
      setTickers([]);
      return;
    }
    setEmptyWatchlist(false);
    setTickers(wlTickers.map(t => t.toUpperCase()));

    const data = await fetchCompanyNews(wlTickers, force);
    setItems(data);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    const unsub = navigation.addListener('focus', () => { load(); });
    return unsub;
  }, [navigation, load]);

  useEffect(() => {
    if (paramTicker) setSelectedCompany(paramTicker.toUpperCase());
  }, [paramTicker]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  }, [load]);

  const filtered = useMemo(() => {
    if (selectedCompany === 'ALL') return items;
    return items.filter(item =>
      item.ticker.split(',').includes(selectedCompany),
    );
  }, [items, selectedCompany]);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={colors.amber} />
      </View>
    );
  }

  if (emptyWatchlist) {
    return (
      <View style={s.center}>
        <Text style={s.emptyText}>ADD STOCKS TO YOUR WATCHLIST TO SEE NEWS</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={filtered}
      keyExtractor={(item, i) => `${item.link}_${i}`}
      style={s.list}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.amber}
          colors={[colors.amber]}
          progressBackgroundColor={colors.surface}
        />
      }
      ListHeaderComponent={
        <View style={s.pickerWrap}>
          <CompanyPicker tickers={tickers} selected={selectedCompany} onSelect={setSelectedCompany} />
        </View>
      }
      ListEmptyComponent={
        <View style={s.emptyWrap}>
          <Text style={s.emptyText}>NO NEWS AVAILABLE - PULL TO RETRY</Text>
        </View>
      }
      renderItem={({ item }) => (
        <TouchableOpacity
          onPress={() => { if (item.link) WebBrowser.openBrowserAsync(item.link); }}
          activeOpacity={0.7}
          style={s.row}
        >
          <View style={s.tickerRow}>
            {item.ticker.split(',').slice(0, 2).map(t => (
              <View key={t} style={s.tickerBadge}>
                <Text style={s.tickerBadgeText}>{t}</Text>
              </View>
            ))}
            {item.ticker.split(',').length > 2 && (
              <Text style={s.tickerMore}>+{item.ticker.split(',').length - 2}</Text>
            )}
          </View>
          <Text style={s.title} numberOfLines={3}>{item.title}</Text>
          <View style={s.meta}>
            {item.source !== '' && (
              <>
                <View style={s.sourceBadge}>
                  <Text style={s.sourceText}>{item.source}</Text>
                </View>
              </>
            )}
            <Text style={s.date}>{item.date ? formatRelativeTime(item.date) : '--'}</Text>
          </View>
        </TouchableOpacity>
      )}
    />
  );
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface },
  list: { flex: 1, backgroundColor: colors.surface },
  emptyText: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted, letterSpacing: 1, textAlign: 'center', paddingHorizontal: 24 },
  emptyWrap: { paddingTop: 40, alignItems: 'center' },
  pickerWrap: { paddingHorizontal: 12, marginTop: 8, marginBottom: 6 },

  row: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  tickerRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  tickerBadge: {
    borderWidth: 1,
    borderColor: colors.accent,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  tickerBadgeText: { fontFamily: fonts.monoBold, fontSize: 9, color: colors.accent },
  tickerMore: { fontFamily: fonts.mono, fontSize: 9, color: colors.textMuted },
  title: { fontFamily: fonts.mono, fontSize: 12, color: colors.textPrimary, lineHeight: 17 },
  meta: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  sourceBadge: {
    borderWidth: 1, borderColor: colors.accent,
    paddingHorizontal: 6, paddingVertical: 1, marginRight: 8,
  },
  sourceText: { fontFamily: fonts.monoBold, fontSize: 9, color: colors.accent },
  date: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted },
});
