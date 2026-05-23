import { useCallback, useEffect, useState, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, RefreshControl, Keyboard,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { colors, fonts } from '../config/theme';
import { getQuote, getProfile } from '../lib/prices';
import { getMarketMovers } from '../lib/massive';
import { loadTickerMap } from '../lib/edgar';
import TickerAutocomplete from '../components/TickerAutocomplete';
import type { Quote, TickerEntry, MarketMover } from '../lib/types';
import type { RootStackParamList } from '../lib/navigation';

const STORAGE_KEY = 'watchlist_tickers';
const DEFAULT_TICKERS = ['AAPL', 'MSFT', 'NVDA', 'GOOGL', 'AMZN'];

type RootNav = NativeStackNavigationProp<RootStackParamList>;

interface WatchlistItem {
  symbol: string;
  name: string;
  quote: Quote | null;
  error: boolean;
}

async function loadTickers(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_TICKERS));
  return DEFAULT_TICKERS;
}

async function saveTickers(tickers: string[]) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(tickers));
}

export default function WatchlistScreen() {
  const navigation = useNavigation();
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [tickers, setTickers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [addText, setAddText] = useState('');
  const [addError, setAddError] = useState('');
  const [adding, setAdding] = useState(false);
  const profileCache = useRef<Record<string, string>>({});
  const tickerMapRef = useRef<Record<string, TickerEntry> | null>(null);
  const [suggestions, setSuggestions] = useState<TickerEntry[]>([]);
  const [movers, setMovers] = useState<MarketMover[]>([]);
  const [moversDir, setMoversDir] = useState<'gainers' | 'losers'>('gainers');
  const [moversCollapsed, setMoversCollapsed] = useState(false);

  useEffect(() => {
    getMarketMovers(moversDir).then(setMovers).catch(() => {});
  }, [moversDir]);

  useEffect(() => {
    loadTickerMap()
      .then(map => { tickerMapRef.current = map; })
      .catch(() => {});
  }, []);

  const updateSuggestions = useCallback((text: string) => {
    const upper = text.trim().toUpperCase();
    if (upper.length < 1 || !tickerMapRef.current) {
      setSuggestions([]);
      return;
    }
    const map = tickerMapRef.current;
    const matches: TickerEntry[] = [];
    for (const entry of Object.values(map)) {
      if (matches.length >= 6) break;
      if (
        entry.ticker.startsWith(upper) ||
        entry.title.toUpperCase().includes(upper)
      ) {
        matches.push(entry);
      }
    }
    setSuggestions(matches);
  }, []);

  const fetchAll = useCallback(async (tickerList: string[]) => {
    const results = await Promise.all(
      tickerList.map(async (sym): Promise<WatchlistItem> => {
        const [quote, profile] = await Promise.all([
          getQuote(sym),
          profileCache.current[sym]
            ? Promise.resolve(null)
            : getProfile(sym),
        ]);
        if (profile?.name) profileCache.current[sym] = profile.name;
        return {
          symbol: sym,
          name: profileCache.current[sym] ?? sym,
          quote,
          error: quote === null,
        };
      }),
    );
    setItems(results);
  }, []);

  const reloadFromStorage = useCallback(async () => {
    const list = await loadTickers();
    setTickers(list);
    await fetchAll(list);
  }, [fetchAll]);

  useEffect(() => {
    reloadFromStorage().finally(() => setLoading(false));
  }, [reloadFromStorage]);

  useEffect(() => {
    const unsub = navigation.addListener('focus', () => {
      reloadFromStorage();
    });
    return unsub;
  }, [navigation, reloadFromStorage]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await reloadFromStorage();
    setRefreshing(false);
  }, [reloadFromStorage]);

  const addTicker = useCallback(async () => {
    const sym = addText.trim().toUpperCase();
    if (!sym) return;
    if (tickers.includes(sym)) {
      setAddError(`${sym} ALREADY IN WATCHLIST`);
      return;
    }
    Keyboard.dismiss();
    setSuggestions([]);
    setAdding(true);
    setAddError('');

    const profile = await getProfile(sym);
    if (!profile) {
      setAddError(`${sym} NOT FOUND`);
      setAdding(false);
      return;
    }

    profileCache.current[sym] = profile.name;
    const quote = await getQuote(sym);
    const newTickers = [...tickers, sym];
    setTickers(newTickers);
    await saveTickers(newTickers);
    setItems(prev => [...prev, { symbol: sym, name: profile.name, quote, error: quote === null }]);
    setAddText('');
    setAdding(false);
  }, [addText, tickers]);

  const removeTicker = useCallback(async (sym: string) => {
    const newTickers = tickers.filter(t => t !== sym);
    setTickers(newTickers);
    setItems(prev => prev.filter(i => i.symbol !== sym));
    await saveTickers(newTickers);
  }, [tickers]);

  const rootNav = navigation.getParent<RootNav>();

  const openDetail = useCallback((sym: string) => {
    rootNav?.navigate('StockDetail', { symbol: sym });
  }, [rootNav]);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={colors.amber} />
      </View>
    );
  }

  return (
    <View style={s.container}>
      <View style={s.addRow}>
        <TextInput
          style={s.input}
          value={addText}
          onChangeText={t => { setAddText(t); setAddError(''); updateSuggestions(t); }}
          onSubmitEditing={addTicker}
          placeholder="ADD TICKER"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="done"
          selectionColor={colors.accent}
          editable={!adding}
        />
        <TouchableOpacity
          onPress={addTicker}
          style={s.addBtn}
          activeOpacity={0.7}
          disabled={adding}
        >
          {adding
            ? <ActivityIndicator color={colors.accent} size="small" />
            : <Text style={s.addBtnText}>ADD</Text>
          }
        </TouchableOpacity>
      </View>
      {addError !== '' && (
        <View style={s.errorBar}>
          <Text style={s.errorText}>{addError}</Text>
        </View>
      )}

      <TickerAutocomplete
        suggestions={suggestions}
        onSelect={entry => {
          setAddText(entry.ticker);
          setSuggestions([]);
        }}
      />

      {/* Market Movers */}
      {movers.length > 0 && <View style={s.moversCard}>
        <TouchableOpacity
          style={s.moversHeader}
          activeOpacity={0.7}
          onPress={() => setMoversCollapsed(v => !v)}
        >
          <Text style={s.moversTitle}>MARKET MOVERS</Text>
          <Text style={s.moversChevron}>{moversCollapsed ? '+' : '-'}</Text>
        </TouchableOpacity>
        {!moversCollapsed && (
          <>
            <View style={s.moversToggle}>
              <TouchableOpacity
                style={[s.moversTab, moversDir === 'gainers' && s.moversTabActive]}
                activeOpacity={0.7}
                onPress={() => setMoversDir('gainers')}
              >
                <Text style={[s.moversTabText, moversDir === 'gainers' && s.moversTabTextActive]}>GAINERS</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.moversTab, moversDir === 'losers' && s.moversTabActive]}
                activeOpacity={0.7}
                onPress={() => setMoversDir('losers')}
              >
                <Text style={[s.moversTabText, moversDir === 'losers' && s.moversTabTextActive]}>LOSERS</Text>
              </TouchableOpacity>
            </View>
            {movers.slice(0, 5).map(m => (
              <TouchableOpacity
                key={m.ticker}
                style={s.moverRow}
                activeOpacity={0.7}
                onPress={() => openDetail(m.ticker)}
              >
                <Text style={s.moverTicker}>{m.ticker}</Text>
                <View style={s.moverRight}>
                  <Text style={s.moverPrice}>
                    {m.price != null ? m.price.toFixed(2) : '-'}
                  </Text>
                  <Text style={[
                    s.moverChange,
                    { color: (m.change_percent ?? 0) >= 0 ? colors.positive : colors.negative },
                  ]}>
                    {m.change_percent != null
                      ? `${m.change_percent >= 0 ? '+' : ''}${m.change_percent.toFixed(2)}%`
                      : '-'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}
      </View>}

      {items.length === 0 ? (
        <View style={s.center}>
          <Text style={s.prompt}>ADD A TICKER TO START YOUR WATCHLIST</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={item => item.symbol}
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
          renderItem={({ item }) => (
            <WatchlistRow item={item} onRemove={removeTicker} onPress={openDetail} />
          )}
        />
      )}
    </View>
  );
}

function WatchlistRow({ item, onRemove, onPress }: { item: WatchlistItem; onRemove: (sym: string) => void; onPress: (sym: string) => void }) {
  const q = item.quote;
  const changeColor = q
    ? q.d > 0 ? colors.positive : q.d < 0 ? colors.negative : colors.textMuted
    : colors.textMuted;

  return (
    <TouchableOpacity style={s.row} activeOpacity={0.7} onPress={() => onPress(item.symbol)}>
      <View style={s.rowLeft}>
        <View style={s.rowSymbolLine}>
          <Text style={s.symbol}>{item.symbol}</Text>
          {item.error && <Text style={s.staleTag}>STALE</Text>}
        </View>
        <Text style={s.companyName} numberOfLines={1}>{item.name}</Text>
      </View>
      <View style={s.rowRight}>
        {q ? (
          <>
            <Text style={s.price}>{q.c.toFixed(2)}</Text>
            <Text style={[s.change, { color: changeColor }]}>
              {q.d >= 0 ? '+' : ''}{q.d.toFixed(2)} ({q.dp >= 0 ? '+' : ''}{q.dp.toFixed(2)}%)
            </Text>
          </>
        ) : (
          <Text style={s.noData}>--</Text>
        )}
      </View>
      <TouchableOpacity onPress={() => onRemove(item.symbol)} style={s.deleteBtn} activeOpacity={0.7}>
        <Text style={s.deleteText}>✕</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { flex: 1 },

  addRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  input: {
    flex: 1,
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: colors.surfaceAlt,
  },
  addBtn: {
    borderWidth: 1,
    borderColor: colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 6,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 50,
  },
  addBtnText: { fontFamily: fonts.monoBold, fontSize: 10, color: colors.accent },

  errorBar: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: colors.surfaceAlt,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  errorText: { fontFamily: fonts.mono, fontSize: 10, color: colors.negative },

  prompt: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted, letterSpacing: 1 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  rowLeft: { flex: 1, marginRight: 8 },
  rowSymbolLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  symbol: { fontFamily: fonts.monoBold, fontSize: 13, color: colors.accent },
  staleTag: {
    fontFamily: fonts.mono,
    fontSize: 8,
    color: colors.negative,
    borderWidth: 1,
    borderColor: colors.negative,
    paddingHorizontal: 3,
    paddingVertical: 0,
  },
  companyName: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted, marginTop: 1 },
  rowRight: { alignItems: 'flex-end', marginRight: 10 },
  price: { fontFamily: fonts.monoBold, fontSize: 13, color: colors.textPrimary },
  change: { fontFamily: fonts.mono, fontSize: 10, marginTop: 1 },
  noData: { fontFamily: fonts.mono, fontSize: 13, color: colors.textMuted },
  deleteBtn: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  deleteText: { fontFamily: fonts.mono, fontSize: 11, color: colors.textMuted },

  moversCard: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  moversHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.surfaceAlt,
  },
  moversTitle: {
    fontFamily: fonts.monoBold,
    fontSize: 10,
    color: colors.accent,
    letterSpacing: 1,
  },
  moversChevron: {
    fontFamily: fonts.monoBold,
    fontSize: 14,
    color: colors.textMuted,
  },
  moversToggle: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
  },
  moversTab: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  moversTabActive: {
    borderColor: colors.accent,
    backgroundColor: '#1a1000',
  },
  moversTabText: { fontFamily: fonts.mono, fontSize: 9, color: colors.textMuted },
  moversTabTextActive: { color: colors.accent },
  moverRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  moverTicker: { fontFamily: fonts.monoBold, fontSize: 11, color: colors.accent },
  moverRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  moverPrice: { fontFamily: fonts.mono, fontSize: 11, color: colors.textPrimary },
  moverChange: { fontFamily: fonts.mono, fontSize: 10, minWidth: 60, textAlign: 'right' },
});
