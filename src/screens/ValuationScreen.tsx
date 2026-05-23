import { useCallback, useEffect, useState, useMemo, useRef } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Keyboard,
} from 'react-native';
import { colors, fonts } from '../config/theme';
import TickerAutocomplete from '../components/TickerAutocomplete';
import { loadTickerMap } from '../lib/edgar';
import { getQuote } from '../lib/prices';
import { fetchCompanyFacts, extractAnnualMetrics, extractLatestMetrics } from '../lib/xbrl';
import type { AnnualMetrics, LatestMetrics } from '../lib/xbrl';
import type { TickerEntry, Quote } from '../lib/types';
import { formatLargeNumber, formatPercent, formatShares, formatRatio } from '../lib/formatters';

type Status = 'idle' | 'loading' | 'ready' | 'not-found' | 'error';

export default function ValuationScreen() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [ticker, setTicker] = useState('');
  const [entityName, setEntityName] = useState('');
  const [quote, setQuote] = useState<Quote | null>(null);
  const [latest, setLatest] = useState<LatestMetrics | null>(null);
  const [annual, setAnnual] = useState<AnnualMetrics[]>([]);
  const [suggestions, setSuggestions] = useState<TickerEntry[]>([]);
  const tickerMapRef = useRef<Record<string, TickerEntry> | null>(null);

  useEffect(() => {
    loadTickerMap()
      .then(map => { tickerMapRef.current = map; })
      .catch(() => {});
  }, []);

  const handleTextChange = useCallback((text: string) => {
    setQuery(text.toUpperCase());
    const map = tickerMapRef.current;
    if (!map || text.length < 1) { setSuggestions([]); return; }
    const upper = text.toUpperCase();
    const matches = Object.values(map)
      .filter(e => e.ticker.startsWith(upper) || e.title.toUpperCase().includes(upper))
      .slice(0, 6);
    setSuggestions(matches);
  }, []);

  const search = useCallback(async (t: string) => {
    Keyboard.dismiss();
    setSuggestions([]);
    setStatus('loading');
    setTicker(t.toUpperCase());

    try {
      const [factsResult, q] = await Promise.all([
        fetchCompanyFacts(t),
        getQuote(t),
      ]);

      if (!factsResult) { setStatus('not-found'); return; }

      setEntityName(factsResult.entityName);
      setQuote(q);
      setLatest(extractLatestMetrics(factsResult.facts));
      setAnnual(extractAnnualMetrics(factsResult.facts));
      setStatus('ready');
    } catch {
      setStatus('error');
    }
  }, []);

  const handleSelect = useCallback((entry: TickerEntry) => {
    setQuery(entry.ticker);
    setSuggestions([]);
    search(entry.ticker);
  }, [search]);

  const price = quote?.c ?? null;
  const pe = useMemo(() => {
    if (price == null || !latest?.epsDiluted || latest.epsDiluted <= 0) return null;
    return price / latest.epsDiluted;
  }, [price, latest]);

  const fcf = useMemo(() => {
    if (latest?.operatingCashFlow == null) return null;
    const capex = latest.capex ?? 0;
    return latest.operatingCashFlow - capex;
  }, [latest]);

  const bookValuePerShare = useMemo(() => {
    if (latest?.stockholdersEquity == null || latest?.sharesOutstanding == null) return null;
    if (latest.sharesOutstanding === 0) return null;
    return latest.stockholdersEquity / latest.sharesOutstanding;
  }, [latest]);

  const pbRatio = useMemo(() => {
    if (price == null || bookValuePerShare == null || bookValuePerShare <= 0) return null;
    return price / bookValuePerShare;
  }, [price, bookValuePerShare]);

  const marketCap = useMemo(() => {
    if (price == null || !latest?.sharesOutstanding) return null;
    return price * latest.sharesOutstanding;
  }, [price, latest]);

  const debtToEquity = useMemo(() => {
    if (latest?.totalLiabilities == null || latest?.stockholdersEquity == null) return null;
    if (latest.stockholdersEquity === 0) return null;
    return latest.totalLiabilities / latest.stockholdersEquity;
  }, [latest]);

  return (
    <View style={s.root}>
      {/* Search bar */}
      <View style={s.searchRow}>
        <TextInput
          style={s.searchInput}
          value={query}
          onChangeText={handleTextChange}
          placeholder="TICKER"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="characters"
          autoCorrect={false}
          returnKeyType="search"
          onSubmitEditing={() => query.length > 0 && search(query)}
        />
        <TouchableOpacity
          style={[s.searchBtn, query.length === 0 && s.searchBtnDisabled]}
          activeOpacity={0.7}
          onPress={() => query.length > 0 && search(query)}
          disabled={query.length === 0}
        >
          <Text style={s.searchBtnText}>SEARCH</Text>
        </TouchableOpacity>
      </View>

      <TickerAutocomplete suggestions={suggestions} onSelect={handleSelect} />

      {status === 'idle' && (
        <View style={s.emptyState}>
          <Text style={s.emptyText}>ENTER A TICKER TO VIEW FUNDAMENTALS</Text>
          <Text style={s.emptySubtext}>DATA FROM SEC EDGAR XBRL FILINGS</Text>
        </View>
      )}

      {status === 'loading' && (
        <View style={s.center}>
          <ActivityIndicator color={colors.amber} />
          <Text style={s.loadingText}>LOADING XBRL DATA...</Text>
        </View>
      )}

      {status === 'not-found' && (
        <View style={s.center}>
          <Text style={s.errorText}>TICKER NOT FOUND IN EDGAR</Text>
        </View>
      )}

      {status === 'error' && (
        <View style={s.center}>
          <Text style={s.errorText}>FAILED TO LOAD DATA</Text>
        </View>
      )}

      {status === 'ready' && latest && (
        <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
          {/* Company header */}
          <View style={s.section}>
            <Text style={s.tickerLabel}>{ticker}</Text>
            <Text style={s.entityName}>{entityName}</Text>
            <View style={s.headerMeta}>
              {price != null && (
                <Text style={s.priceText}>${price.toFixed(2)}</Text>
              )}
              {marketCap != null && (
                <Text style={s.mktCapText}>MKT CAP {formatLargeNumber(marketCap)}</Text>
              )}
            </View>
          </View>

          {/* KEY METRICS */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>KEY METRICS</Text>
            <Text style={s.sectionSubtitle}>LATEST ANNUAL (10-K)</Text>
            <View style={s.grid}>
              <MetricCell label="REVENUE" value={formatLargeNumber(latest.revenue)} />
              <MetricCell label="NET INCOME" value={formatLargeNumber(latest.netIncome)} />
              <MetricCell label="EPS (DILUTED)" value={latest.epsDiluted != null ? `$${latest.epsDiluted.toFixed(2)}` : '-'} />
              <MetricCell label="P/E RATIO" value={pe != null ? formatRatio(pe) : '-'} />
              <MetricCell label="OPERATING INCOME" value={formatLargeNumber(latest.operatingIncome)} />
              <MetricCell label="FREE CASH FLOW" value={formatLargeNumber(fcf)} />
              <MetricCell label="TOTAL ASSETS" value={formatLargeNumber(latest.totalAssets)} />
              <MetricCell label="TOTAL DEBT" value={formatLargeNumber(latest.longTermDebt)} />
              <MetricCell label="CASH" value={formatLargeNumber(latest.cash)} />
              <MetricCell label="SHARES OUT" value={formatShares(latest.sharesOutstanding)} />
              <MetricCell label="BOOK VALUE/SH" value={bookValuePerShare != null ? `$${bookValuePerShare.toFixed(2)}` : '-'} />
              <MetricCell label="P/B RATIO" value={pbRatio != null ? formatRatio(pbRatio) : '-'} />
            </View>
          </View>

          {/* TREND */}
          {annual.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>TREND</Text>
              <Text style={s.sectionSubtitle}>ANNUAL (10-K) HISTORY</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View>
                  {/* Header row */}
                  <View style={s.tableRow}>
                    <Text style={[s.tableHeader, s.colFy]}>FY</Text>
                    <Text style={[s.tableHeader, s.colNum]}>REVENUE</Text>
                    <Text style={[s.tableHeader, s.colNum]}>NET INCOME</Text>
                    <Text style={[s.tableHeader, s.colSmall]}>EPS</Text>
                    <Text style={[s.tableHeader, s.colSmall]}>MARGIN</Text>
                  </View>
                  {/* Data rows */}
                  {annual.map((row, i) => {
                    const prev = annual[i + 1];
                    const margin = row.revenue && row.netIncome
                      ? row.netIncome / row.revenue
                      : null;
                    const prevMargin = prev?.revenue && prev?.netIncome
                      ? prev.netIncome / prev.revenue
                      : null;
                    return (
                      <View key={row.fy} style={[s.tableRow, i % 2 === 0 && s.tableRowAlt]}>
                        <Text style={[s.tableCell, s.colFy]}>{row.fy}</Text>
                        <Text style={[s.tableCell, s.colNum, trendColor(row.revenue, prev?.revenue)]}>
                          {formatLargeNumber(row.revenue)}
                        </Text>
                        <Text style={[s.tableCell, s.colNum, trendColor(row.netIncome, prev?.netIncome)]}>
                          {formatLargeNumber(row.netIncome)}
                        </Text>
                        <Text style={[s.tableCell, s.colSmall, trendColor(row.epsDiluted, prev?.epsDiluted)]}>
                          {row.epsDiluted != null ? row.epsDiluted.toFixed(2) : '-'}
                        </Text>
                        <Text style={[s.tableCell, s.colSmall, trendColor(margin, prevMargin)]}>
                          {margin != null ? formatPercent(margin) : '-'}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              </ScrollView>
            </View>
          )}

          {/* BALANCE SHEET */}
          <View style={[s.section, { marginBottom: 40 }]}>
            <Text style={s.sectionTitle}>BALANCE SHEET</Text>
            <Text style={s.sectionSubtitle}>LATEST ANNUAL SNAPSHOT</Text>

            {/* Asset/Liability bar */}
            {latest.totalAssets != null && latest.totalLiabilities != null && (
              <View style={s.barSection}>
                <View style={s.barLabelRow}>
                  <Text style={s.barLabel}>ASSETS</Text>
                  <Text style={s.barValue}>{formatLargeNumber(latest.totalAssets)}</Text>
                </View>
                <View style={s.barTrack}>
                  <View style={[s.barFillAssets, { width: '100%' }]} />
                </View>
                <View style={s.barLabelRow}>
                  <Text style={s.barLabel}>LIABILITIES</Text>
                  <Text style={s.barValue}>{formatLargeNumber(latest.totalLiabilities)}</Text>
                </View>
                <View style={s.barTrack}>
                  <View style={[
                    s.barFillLiab,
                    { width: `${Math.min(100, (latest.totalLiabilities / latest.totalAssets) * 100).toFixed(0)}%` as `${number}%` },
                  ]} />
                </View>
              </View>
            )}

            <View style={s.grid}>
              <MetricCell label="CASH" value={formatLargeNumber(latest.cash)} />
              <MetricCell label="EQUITY" value={formatLargeNumber(latest.stockholdersEquity)} />
              <MetricCell label="LONG-TERM DEBT" value={formatLargeNumber(latest.longTermDebt)} />
              <MetricCell label="DEBT/EQUITY" value={debtToEquity != null ? formatRatio(debtToEquity) : '-'} />
            </View>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

function trendColor(
  current: number | null | undefined,
  previous: number | null | undefined,
): { color: string } | undefined {
  if (current == null || previous == null) return undefined;
  if (current > previous) return { color: colors.positive };
  if (current < previous) return { color: colors.negative };
  return undefined;
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.metricCell}>
      <Text style={s.metricLabel}>{label}</Text>
      <Text style={s.metricValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },

  searchRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.mono,
    fontSize: 13,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: colors.surface,
  },
  searchBtn: {
    borderWidth: 1,
    borderColor: colors.accent,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  searchBtnDisabled: {
    borderColor: colors.border,
  },
  searchBtnText: {
    fontFamily: fonts.monoBold,
    fontSize: 10,
    color: colors.accent,
    letterSpacing: 1,
  },

  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyText: {
    fontFamily: fonts.monoBold,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 1,
    textAlign: 'center',
  },
  emptySubtext: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 6,
    letterSpacing: 0.5,
  },
  loadingText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 8,
    letterSpacing: 0.5,
  },
  errorText: {
    fontFamily: fonts.monoBold,
    fontSize: 11,
    color: colors.negative,
    letterSpacing: 1,
  },

  section: { paddingHorizontal: 12, paddingVertical: 10 },
  sectionTitle: {
    fontFamily: fonts.monoBold,
    fontSize: 10,
    color: colors.accent,
    letterSpacing: 1,
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontFamily: fonts.mono,
    fontSize: 8,
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 8,
  },

  tickerLabel: {
    fontFamily: fonts.monoBold,
    fontSize: 18,
    color: colors.accent,
  },
  entityName: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textPrimary,
    marginTop: 2,
  },
  headerMeta: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 4,
    alignItems: 'baseline',
  },
  priceText: {
    fontFamily: fonts.monoBold,
    fontSize: 16,
    color: colors.textPrimary,
  },
  mktCapText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  metricCell: {
    width: '50%',
    paddingVertical: 6,
    paddingRight: 8,
  },
  metricLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  metricValue: {
    fontFamily: fonts.monoBold,
    fontSize: 12,
    color: colors.textPrimary,
    marginTop: 1,
  },

  tableRow: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 4,
  },
  tableRowAlt: {
    backgroundColor: colors.surfaceAlt,
  },
  tableHeader: {
    fontFamily: fonts.monoBold,
    fontSize: 8,
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  tableCell: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textPrimary,
  },
  colFy: { width: 50 },
  colNum: { width: 90, textAlign: 'right' },
  colSmall: { width: 65, textAlign: 'right' },

  barSection: {
    marginBottom: 12,
  },
  barLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  barLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  barValue: {
    fontFamily: fonts.monoBold,
    fontSize: 9,
    color: colors.textPrimary,
  },
  barTrack: {
    height: 6,
    backgroundColor: colors.borderSubtle,
    marginBottom: 8,
  },
  barFillAssets: {
    height: 6,
    backgroundColor: colors.positive,
    opacity: 0.6,
  },
  barFillLiab: {
    height: 6,
    backgroundColor: colors.negative,
    opacity: 0.6,
  },
});
