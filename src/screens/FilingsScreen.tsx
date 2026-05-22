import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Keyboard, RefreshControl,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, fonts } from '../config/theme';
import { resolveCik, getFilings, loadTickerMap } from '../lib/edgar';
import type { Filing, TickerEntry } from '../lib/types';

const STORAGE_KEY = 'watchlist_tickers';
const WATCHLIST_FILINGS_LIMIT = 25;

type Filter = 'ALL' | '10-K' | '10-Q' | '8-K';
const FILTERS: Filter[] = ['ALL', '10-K', '10-Q', '8-K'];

type Status = 'idle' | 'loading' | 'ready' | 'not-found' | 'error';

interface WatchlistFiling extends Filing {
  ticker: string;
  companyName: string;
}

const FILING_TYPES: { form: string; desc: string }[] = [
  { form: '10-K', desc: 'Annual report. Full-year financials, risk factors, business overview.' },
  { form: '10-Q', desc: 'Quarterly report. Unaudited financials for Q1-Q3.' },
  { form: '8-K', desc: 'Current report. Material events - earnings, M&A, leadership changes.' },
  { form: 'DEF 14A', desc: 'Proxy statement. Executive comp, board nominees, shareholder votes.' },
  { form: 'S-1', desc: 'IPO registration. Pre-IPO financials, business model, risk factors.' },
  { form: '13F', desc: 'Institutional holdings. Quarterly snapshot of large fund positions.' },
  { form: '4', desc: 'Insider transactions. Officer/director buys and sells within 2 days.' },
  { form: 'SC 13D/G', desc: 'Large stake disclosure. Filed when someone crosses 5% ownership.' },
];

const wfCache: { data: WatchlistFiling[]; ts: number; key: string } = { data: [], ts: 0, key: '' };
const WF_CACHE_TTL = 15 * 60 * 1000;

export default function FilingsScreen() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [filings, setFilings] = useState<Filing[]>([]);
  const [companyName, setCompanyName] = useState('');
  const [searchedTicker, setSearchedTicker] = useState('');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [suggestions, setSuggestions] = useState<TickerEntry[]>([]);
  const tickerMapRef = useRef<Record<string, TickerEntry> | null>(null);

  const [wfItems, setWfItems] = useState<WatchlistFiling[]>([]);
  const [wfLoading, setWfLoading] = useState(true);
  const [wfEmpty, setWfEmpty] = useState(false);
  const [wfRefreshing, setWfRefreshing] = useState(false);
  const [refExpanded, setRefExpanded] = useState(false);

  useEffect(() => {
    loadTickerMap()
      .then(map => { tickerMapRef.current = map; })
      .catch(() => {});
  }, []);

  const loadWatchlistFilings = useCallback(async (force = false) => {
    let tickers: string[] = [];
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) tickers = parsed;
      }
    } catch {}

    if (tickers.length === 0) {
      setWfEmpty(true);
      setWfItems([]);
      return;
    }
    setWfEmpty(false);

    const cacheKey = tickers.map(t => t.toUpperCase()).sort().join(',');
    if (!force && wfCache.key === cacheKey && Date.now() - wfCache.ts < WF_CACHE_TTL) {
      setWfItems(wfCache.data);
      return;
    }

    const results = await Promise.allSettled(
      tickers.map(async (ticker): Promise<WatchlistFiling[]> => {
        const resolved = await resolveCik(ticker);
        if (!resolved) return [];
        const tickerFilings = await getFilings(resolved.cik);
        return tickerFilings.map(f => ({
          ...f,
          ticker: ticker.toUpperCase(),
          companyName: resolved.title,
        }));
      }),
    );

    const merged: WatchlistFiling[] = [];
    for (const r of results) {
      if (r.status === 'fulfilled') merged.push(...r.value);
    }
    merged.sort((a, b) => b.filingDate.localeCompare(a.filingDate));
    const limited = merged.slice(0, WATCHLIST_FILINGS_LIMIT);

    wfCache.data = limited;
    wfCache.ts = Date.now();
    wfCache.key = cacheKey;
    setWfItems(limited);
  }, []);

  useEffect(() => {
    loadWatchlistFilings().finally(() => setWfLoading(false));
  }, [loadWatchlistFilings]);

  const onWfRefresh = useCallback(async () => {
    setWfRefreshing(true);
    await loadWatchlistFilings(true);
    setWfRefreshing(false);
  }, [loadWatchlistFilings]);

  const search = useCallback(async (ticker: string) => {
    const clean = ticker.trim().toUpperCase();
    if (!clean) return;
    Keyboard.dismiss();
    setSuggestions([]);
    setStatus('loading');
    setFilter('ALL');
    setSearchedTicker(clean);

    try {
      const resolved = await resolveCik(clean);
      if (!resolved) {
        setStatus('not-found');
        setFilings([]);
        setCompanyName('');
        return;
      }
      setCompanyName(resolved.title);
      const results = await getFilings(resolved.cik);
      setFilings(results);
      setStatus(results.length > 0 ? 'ready' : 'not-found');
    } catch {
      setStatus('error');
      setFilings([]);
      setCompanyName('');
    }
  }, []);

  const onChangeText = useCallback((text: string) => {
    setQuery(text);
    if (text.trim() === '' && status !== 'idle') {
      setStatus('idle');
      setFilings([]);
      setCompanyName('');
      setSearchedTicker('');
    }
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
  }, [status]);

  const filtered = useMemo(() => {
    if (filter === 'ALL') return filings;
    return filings.filter(f => f.form === filter);
  }, [filings, filter]);

  return (
    <View style={s.container}>
      <View style={s.searchRow}>
        <TextInput
          style={s.input}
          value={query}
          onChangeText={onChangeText}
          onSubmitEditing={() => search(query)}
          placeholder="TICKER (e.g. AAPL)"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="search"
          selectionColor={colors.accent}
        />
        <TouchableOpacity onPress={() => search(query)} style={s.searchBtn} activeOpacity={0.7}>
          <Text style={s.searchBtnText}>SEARCH</Text>
        </TouchableOpacity>
      </View>

      {suggestions.length > 0 && (
        <View style={s.suggestions}>
          {suggestions.map(entry => (
            <TouchableOpacity
              key={entry.ticker}
              style={s.suggestionRow}
              activeOpacity={0.7}
              onPress={() => {
                setQuery(entry.ticker);
                setSuggestions([]);
                search(entry.ticker);
              }}
            >
              <Text style={s.suggestionTicker}>{entry.ticker}</Text>
              <Text style={s.suggestionName} numberOfLines={1}>{entry.title}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {status === 'idle' && (
        <IdleContent
          wfItems={wfItems}
          wfLoading={wfLoading}
          wfEmpty={wfEmpty}
          wfRefreshing={wfRefreshing}
          onRefresh={onWfRefresh}
          refExpanded={refExpanded}
          onToggleRef={() => setRefExpanded(e => !e)}
        />
      )}

      {status === 'loading' && (
        <View style={s.center}>
          <ActivityIndicator color={colors.amber} />
          <Text style={s.loadingText}>FETCHING FILINGS...</Text>
        </View>
      )}

      {status === 'not-found' && (
        <View style={s.center}>
          <Text style={s.errorText}>NO FILINGS FOUND FOR {searchedTicker}</Text>
        </View>
      )}

      {status === 'error' && (
        <View style={s.center}>
          <Text style={s.errorText}>NETWORK ERROR</Text>
          <TouchableOpacity onPress={() => search(searchedTicker)} style={s.retryBtn} activeOpacity={0.7}>
            <Text style={s.retryText}>RETRY</Text>
          </TouchableOpacity>
        </View>
      )}

      {status === 'ready' && (
        <FlatList
          data={filtered}
          keyExtractor={(item, i) => `${item.accessionNumber}-${i}`}
          style={s.list}
          ListHeaderComponent={
            <View>
              <View style={s.filterRow}>
                {FILTERS.map(f => (
                  <TouchableOpacity
                    key={f}
                    onPress={() => setFilter(f)}
                    style={[s.filterBtn, filter === f && s.filterActive]}
                  >
                    <Text style={[s.filterText, filter === f && s.filterActiveText]}>{f}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={s.statusBar}>
                <Text style={s.statusText}>{filtered.length} FILINGS</Text>
                <Text style={s.statusSep}>|</Text>
                <Text style={s.statusText} numberOfLines={1}>{companyName}</Text>
              </View>
            </View>
          }
          renderItem={({ item }) => <FilingRow filing={item} />}
        />
      )}
    </View>
  );
}

function IdleContent({
  wfItems, wfLoading, wfEmpty, wfRefreshing, onRefresh, refExpanded, onToggleRef,
}: {
  wfItems: WatchlistFiling[];
  wfLoading: boolean;
  wfEmpty: boolean;
  wfRefreshing: boolean;
  onRefresh: () => void;
  refExpanded: boolean;
  onToggleRef: () => void;
}) {
  if (wfEmpty) {
    return (
      <View style={s.center}>
        <Text style={s.prompt}>ADD STOCKS TO YOUR WATCHLIST TO SEE RECENT FILINGS</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={wfItems}
      keyExtractor={(item, i) => `wf-${item.ticker}-${item.accessionNumber}-${i}`}
      style={s.list}
      refreshControl={
        <RefreshControl
          refreshing={wfRefreshing}
          onRefresh={onRefresh}
          tintColor={colors.amber}
          colors={[colors.amber]}
          progressBackgroundColor={colors.surface}
        />
      }
      ListHeaderComponent={
        <View>
          <ReferenceCard expanded={refExpanded} onToggle={onToggleRef} />
          <View style={s.statusBar}>
            <Text style={s.statusText}>{wfItems.length} RECENT FILINGS</Text>
            <Text style={s.statusSep}>|</Text>
            <Text style={s.statusText}>WATCHLIST</Text>
          </View>
        </View>
      }
      ListEmptyComponent={
        wfLoading ? (
          <View style={s.wfLoadingWrap}>
            <ActivityIndicator color={colors.amber} />
            <Text style={s.loadingText}>LOADING WATCHLIST FILINGS...</Text>
          </View>
        ) : null
      }
      renderItem={({ item }) => <WatchlistFilingRow filing={item} />}
    />
  );
}

function ReferenceCard({ expanded, onToggle }: { expanded: boolean; onToggle: () => void }) {
  return (
    <View style={s.refCard}>
      <TouchableOpacity onPress={onToggle} activeOpacity={0.7} style={s.refHeader}>
        <Text style={s.refTitle}>FILING REFERENCE</Text>
        <Text style={s.refChevron}>{expanded ? '▼' : '▶'}</Text>
      </TouchableOpacity>
      {expanded && (
        <View style={s.refBody}>
          {FILING_TYPES.map(ft => (
            <View key={ft.form} style={s.refRow}>
              <Text style={s.refForm}>{ft.form}</Text>
              <Text style={s.refDesc}>{ft.desc}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function formColor(form: string): string {
  if (form === '10-K') return colors.accent;
  if (form === '10-Q') return colors.cyan;
  if (form === '8-K') return colors.amber;
  return colors.textMuted;
}

function FilingRow({ filing }: { filing: Filing }) {
  const fc = formColor(filing.form);
  return (
    <TouchableOpacity
      onPress={() => WebBrowser.openBrowserAsync(filing.documentUrl)}
      activeOpacity={0.7}
      style={s.row}
    >
      <View style={s.rowTop}>
        <View style={[s.badge, { borderColor: fc }]}>
          <Text style={[s.badgeText, { color: fc }]}>{filing.form}</Text>
        </View>
        <Text style={s.date}>{filing.filingDate}</Text>
      </View>
      {filing.reportDate ? (
        <Text style={s.reportDate}>REPORT PERIOD: {filing.reportDate}</Text>
      ) : null}
      <Text style={s.accession} numberOfLines={1}>{filing.accessionNumber}</Text>
    </TouchableOpacity>
  );
}

function WatchlistFilingRow({ filing }: { filing: WatchlistFiling }) {
  const fc = formColor(filing.form);
  return (
    <TouchableOpacity
      onPress={() => WebBrowser.openBrowserAsync(filing.documentUrl)}
      activeOpacity={0.7}
      style={s.row}
    >
      <View style={s.rowTop}>
        <View style={[s.badge, { borderColor: fc }]}>
          <Text style={[s.badgeText, { color: fc }]}>{filing.form}</Text>
        </View>
        <View style={s.wfTickerBadge}>
          <Text style={s.wfTickerText}>{filing.ticker}</Text>
        </View>
        <Text style={s.date}>{filing.filingDate}</Text>
      </View>
      <Text style={s.wfCompany} numberOfLines={1}>{filing.companyName}</Text>
      {filing.reportDate ? (
        <Text style={s.reportDate}>REPORT PERIOD: {filing.reportDate}</Text>
      ) : null}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  list: { flex: 1 },

  searchRow: {
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
  searchBtn: {
    borderWidth: 1,
    borderColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    justifyContent: 'center',
  },
  searchBtnText: {
    fontFamily: fonts.monoBold,
    fontSize: 10,
    color: colors.accent,
  },

  suggestions: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 8,
  },
  suggestionTicker: {
    fontFamily: fonts.monoBold,
    fontSize: 11,
    color: colors.accent,
    width: 60,
  },
  suggestionName: {
    flex: 1,
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textSecondary,
  },

  prompt: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted, letterSpacing: 1, textAlign: 'center' },
  loadingText: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted, marginTop: 8 },
  errorText: { fontFamily: fonts.monoBold, fontSize: 11, color: colors.negative, textAlign: 'center' },
  retryBtn: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  retryText: { fontFamily: fonts.monoBold, fontSize: 10, color: colors.accent },

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
  badge: { borderWidth: 1, paddingHorizontal: 6, paddingVertical: 1, marginRight: 8 },
  badgeText: { fontFamily: fonts.monoBold, fontSize: 9 },
  date: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted },
  reportDate: { fontFamily: fonts.mono, fontSize: 10, color: colors.textSecondary, marginBottom: 2 },
  accession: { fontFamily: fonts.mono, fontSize: 9, color: colors.textMuted },

  wfTickerBadge: {
    borderWidth: 1,
    borderColor: colors.accent,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginRight: 8,
  },
  wfTickerText: { fontFamily: fonts.monoBold, fontSize: 9, color: colors.accent },
  wfCompany: { fontFamily: fonts.mono, fontSize: 10, color: colors.textSecondary, marginBottom: 2 },
  wfLoadingWrap: { paddingTop: 40, alignItems: 'center' },

  refCard: {
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  refHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  refTitle: { fontFamily: fonts.monoBold, fontSize: 10, color: colors.accent, letterSpacing: 1 },
  refChevron: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted },
  refBody: { paddingHorizontal: 10, paddingBottom: 10 },
  refRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  refForm: {
    fontFamily: fonts.monoBold,
    fontSize: 10,
    color: colors.accent,
    width: 72,
    flexShrink: 0,
  },
  refDesc: {
    flex: 1,
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textSecondary,
    lineHeight: 15,
  },
});
