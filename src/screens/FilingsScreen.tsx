import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Keyboard, RefreshControl,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import { colors, fonts } from '../config/theme';
import DropdownPicker from '../components/DropdownPicker';
import TickerAutocomplete from '../components/TickerAutocomplete';
import { resolveCik, getFilings, loadTickerMap } from '../lib/edgar';
import type { Filing, TickerEntry } from '../lib/types';
import type { StocksTabParamList } from '../lib/navigation';

const CURRENT_YEAR = new Date().getFullYear();

const FORM_OPTIONS = [
  '10-K', '10-Q', '8-K', 'DEF 14A', 'FORM 4',
  'S-1', '13F', 'SC 13D', 'PROXY', '20-F',
];

const FILING_TYPES: { form: string; desc: string }[] = [
  { form: '10-K', desc: 'Annual report. Full-year financials, risk factors, business overview.' },
  { form: '10-Q', desc: 'Quarterly report. Unaudited financials for Q1-Q3.' },
  { form: '8-K', desc: 'Current report. Material events - earnings, M&A, leadership changes.' },
  { form: 'DEF 14A', desc: 'Proxy statement. Executive comp, board nominees, shareholder votes.' },
  { form: 'S-1', desc: 'IPO registration. Pre-IPO financials, business model, risk factors.' },
  { form: '13F', desc: 'Institutional holdings. Quarterly snapshot of large fund positions.' },
  { form: 'FORM 4', desc: 'Insider transactions. Officer/director buys and sells within 2 days.' },
  { form: 'SC 13D', desc: 'Large stake disclosure. Filed when someone crosses 5% ownership.' },
  { form: 'PROXY', desc: 'Alias for DEF 14A. Proxy statement for shareholder meetings.' },
  { form: '20-F', desc: 'Foreign filer annual report. Equivalent of 10-K for non-US companies.' },
];

type Status = 'idle' | 'loading' | 'ready' | 'not-found' | 'error';

export default function FilingsScreen() {
  const route = useRoute<RouteProp<StocksTabParamList, 'Filings'>>();
  const paramTicker = route.params?.ticker;
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [filings, setFilings] = useState<Filing[]>([]);
  const [companyName, setCompanyName] = useState('');
  const [searchedTicker, setSearchedTicker] = useState('');
  const [yearInput, setYearInput] = useState('');
  const [selectedForm, setSelectedForm] = useState('ALL');
  const [suggestions, setSuggestions] = useState<TickerEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [refExpanded, setRefExpanded] = useState(false);
  const tickerMapRef = useRef<Record<string, TickerEntry> | null>(null);
  const appliedParamRef = useRef<string | null>(null);

  useEffect(() => {
    loadTickerMap()
      .then(map => { tickerMapRef.current = map; })
      .catch(() => {});
  }, []);

  const parsedYear = yearInput.length === 4 ? parseInt(yearInput, 10) : null;
  const validYear = parsedYear && parsedYear >= 1993 && parsedYear <= CURRENT_YEAR
    ? parsedYear : null;

  const filtered = useMemo(() => {
    let items = filings;
    if (validYear) {
      items = items.filter(f => f.filingDate.startsWith(String(validYear)));
    }
    if (selectedForm !== 'ALL') {
      if (selectedForm === 'PROXY') {
        items = items.filter(f => f.form === 'DEF 14A');
      } else if (selectedForm === 'FORM 4') {
        items = items.filter(f => f.form === '4' || f.form === 'FORM 4');
      } else if (selectedForm === 'SC 13D') {
        items = items.filter(f => f.form.startsWith('SC 13D') || f.form.startsWith('SC 13G'));
      } else {
        items = items.filter(f => f.form === selectedForm);
      }
    }
    return items;
  }, [filings, validYear, selectedForm]);

  const search = useCallback(async (ticker: string) => {
    const clean = ticker.trim().toUpperCase();
    if (!clean) return;
    Keyboard.dismiss();
    setSuggestions([]);
    setStatus('loading');
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
      const results = await getFilings(resolved.cik, validYear ?? undefined);

      const trimmed = validYear
        ? results
        : results.filter(f => {
            const y = parseInt(f.filingDate.slice(0, 4), 10);
            return y >= CURRENT_YEAR - 1;
          });

      setFilings(trimmed);
      setStatus(trimmed.length > 0 ? 'ready' : 'not-found');
    } catch {
      setStatus('error');
      setFilings([]);
      setCompanyName('');
    }
  }, [validYear]);

  useEffect(() => {
    if (paramTicker && paramTicker !== appliedParamRef.current) {
      appliedParamRef.current = paramTicker;
      setQuery(paramTicker);
      search(paramTicker);
    }
  }, [paramTicker, search]);

  const onRefresh = useCallback(async () => {
    if (!searchedTicker) return;
    setRefreshing(true);
    await search(searchedTicker);
    setRefreshing(false);
  }, [searchedTicker, search]);

  const onChangeText = useCallback((text: string) => {
    setQuery(text);
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

  const onSelectTicker = useCallback((entry: TickerEntry) => {
    setQuery(entry.ticker);
    setSuggestions([]);
  }, []);

  const header = (
    <View>
      <View style={s.pickerRow}>
        <TextInput
          style={s.yearInput}
          value={yearInput}
          onChangeText={t => setYearInput(t.replace(/[^0-9]/g, ''))}
          placeholder="YEAR"
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
          maxLength={4}
          selectionColor={colors.accent}
          returnKeyType="done"
        />
        <DropdownPicker
          items={FORM_OPTIONS}
          selected={selectedForm}
          onSelect={setSelectedForm}
          allLabel="ALL FORMS"
          title="SELECT FORM TYPE"
        />
      </View>
      <TouchableOpacity
        onPress={() => search(query)}
        style={s.bigSearchBtn}
        activeOpacity={0.7}
      >
        <Text style={s.bigSearchText}>SEARCH</Text>
      </TouchableOpacity>
      <ReferenceCard expanded={refExpanded} onToggle={() => setRefExpanded(e => !e)} />
    </View>
  );

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
      </View>

      <TickerAutocomplete
        suggestions={suggestions}
        onSelect={onSelectTicker}
      />

      {status === 'loading' && (
        <>
          {header}
          <View style={s.center}>
            <ActivityIndicator color={colors.amber} />
            <Text style={s.loadingText}>FETCHING FILINGS...</Text>
          </View>
        </>
      )}

      {status === 'idle' && (
        <FlatList
          data={[]}
          keyExtractor={() => ''}
          renderItem={() => null}
          ListHeaderComponent={header}
        />
      )}

      {status === 'not-found' && (
        <>
          {header}
          <View style={s.center}>
            <Text style={s.errorText}>NO FILINGS FOUND FOR {searchedTicker}</Text>
          </View>
        </>
      )}

      {status === 'error' && (
        <>
          {header}
          <View style={s.center}>
            <Text style={s.errorText}>NETWORK ERROR</Text>
            <TouchableOpacity onPress={() => search(searchedTicker)} style={s.retryBtn} activeOpacity={0.7}>
              <Text style={s.retryText}>RETRY</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {status === 'ready' && (
        <FlatList
          data={filtered}
          keyExtractor={(item, i) => `${item.accessionNumber}-${i}`}
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
            <View>
              {header}
              {companyName ? (
                <View style={s.resultHeader}>
                  <Text style={s.resultTicker}>{searchedTicker}</Text>
                  <Text style={s.resultCompany} numberOfLines={1}>{companyName}</Text>
                  <Text style={s.resultCount}>{filtered.length} FILINGS</Text>
                </View>
              ) : null}
            </View>
          }
          renderItem={({ item }) => (
            <FilingRow filing={item} ticker={searchedTicker} companyName={companyName} />
          )}
          ListEmptyComponent={
            <View style={s.center}>
              <Text style={s.errorText}>NO FILINGS MATCH FILTERS</Text>
            </View>
          }
        />
      )}
    </View>
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

function FilingRow({ filing, ticker, companyName }: { filing: Filing; ticker: string; companyName: string }) {
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
        <View style={s.tickerBadge}>
          <Text style={s.tickerBadgeText}>{ticker}</Text>
        </View>
        <Text style={s.date}>{filing.filingDate}</Text>
      </View>
      <Text style={s.company} numberOfLines={1}>{companyName}</Text>
      {filing.reportDate ? (
        <Text style={s.reportDate}>REPORT PERIOD: {filing.reportDate}</Text>
      ) : null}
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24, paddingVertical: 40 },
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

  pickerRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    marginTop: 8,
    marginBottom: 6,
  },
  yearInput: {
    width: 80,
    fontFamily: fonts.monoBold,
    fontSize: 10,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: colors.surfaceAlt,
    letterSpacing: 1,
  },
  bigSearchBtn: {
    marginHorizontal: 12,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: colors.accent,
    paddingVertical: 10,
    alignItems: 'center',
  },
  bigSearchText: {
    fontFamily: fonts.monoBold,
    fontSize: 11,
    color: colors.accent,
    letterSpacing: 2,
  },

  resultHeader: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  resultTicker: {
    fontFamily: fonts.monoBold,
    fontSize: 13,
    color: colors.accent,
  },
  resultCompany: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textSecondary,
    marginTop: 2,
  },
  resultCount: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 4,
  },

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

  row: {
    paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: colors.borderSubtle,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  badge: { borderWidth: 1, paddingHorizontal: 6, paddingVertical: 1, marginRight: 8 },
  badgeText: { fontFamily: fonts.monoBold, fontSize: 9 },
  tickerBadge: {
    borderWidth: 1,
    borderColor: colors.accent,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginRight: 8,
  },
  tickerBadgeText: { fontFamily: fonts.monoBold, fontSize: 9, color: colors.accent },
  date: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted },
  company: { fontFamily: fonts.mono, fontSize: 10, color: colors.textSecondary, marginBottom: 2 },
  reportDate: { fontFamily: fonts.mono, fontSize: 10, color: colors.textSecondary, marginBottom: 2 },

  refCard: {
    marginHorizontal: 12,
    marginTop: 6,
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
