import { useCallback, useEffect, useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Dimensions,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Polyline, Polygon, Line, Text as SvgText } from 'react-native-svg';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { CommonActions } from '@react-navigation/native';
import { colors, fonts } from '../config/theme';
import { getQuote, getProfile, getCandle } from '../lib/prices';
import type { CandleResult } from '../lib/prices';
import { getTickerDetails, getRelatedTickers, getDividends } from '../lib/massive';
import { fetchCompanyFacts, extractLatestMetrics } from '../lib/xbrl';
import type { LatestMetrics } from '../lib/xbrl';
import type { Quote, StockProfile, TickerDetails, Dividend } from '../lib/types';
import { padDomain } from '../lib/chartUtils';
import type { RootStackParamList } from '../lib/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'StockDetail'>;

type Range = '1M' | '6M' | '1Y' | '2Y';
const RANGES: Range[] = ['1M', '6M', '1Y', '2Y'];

function rangeDays(r: Range): number {
  switch (r) {
    case '1M': return 22;
    case '6M': return 132;
    case '1Y': return 252;
    case '2Y': return 504;
  }
}

function fmtMktCap(v: number): string {
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}T`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}B`;
  return `$${v.toFixed(0)}M`;
}

const STORAGE_KEY = 'watchlist_tickers';

export default function StockDetailScreen({ route, navigation }: Props) {
  const { symbol } = route.params;
  const insets = useSafeAreaInsets();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [profile, setProfile] = useState<StockProfile | null>(null);
  const [candleResult, setCandleResult] = useState<CandleResult | null>(null);
  const [tickerDetails, setTickerDetails] = useState<TickerDetails | null>(null);
  const [relatedTickers, setRelatedTickers] = useState<string[]>([]);
  const [dividends, setDividends] = useState<Dividend[]>([]);
  const [xbrlMetrics, setXbrlMetrics] = useState<LatestMetrics | null>(null);
  const [descExpanded, setDescExpanded] = useState(false);
  const [range, setRange] = useState<Range>('1Y');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [q, p, c] = await Promise.all([
        getQuote(symbol),
        getProfile(symbol),
        getCandle(symbol),
      ]);
      if (cancelled) return;
      setQuote(q);
      setProfile(p);
      setCandleResult(c);
      setLoading(false);

      // Stagger Massive calls to respect 5/min rate limit
      const td = await getTickerDetails(symbol);
      if (!cancelled) setTickerDetails(td);

      const rel = await getRelatedTickers(symbol);
      if (!cancelled) setRelatedTickers(rel);

      const div = await getDividends(symbol);
      if (!cancelled) setDividends(div);

      const factsResult = await fetchCompanyFacts(symbol);
      if (!cancelled && factsResult) {
        setXbrlMetrics(extractLatestMetrics(factsResult.facts));
      }
    })();
    return () => { cancelled = true; };
  }, [symbol]);

  const handleRemove = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      if (raw) {
        const tickers: string[] = JSON.parse(raw);
        const updated = tickers.filter(t => t !== symbol);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      }
    } catch {}
    navigation.goBack();
  }, [symbol, navigation]);

  const q = quote;
  const changeColor = q
    ? q.d > 0 ? colors.positive : q.d < 0 ? colors.negative : colors.textMuted
    : colors.textMuted;
  const chartColor = q && q.d >= 0 ? colors.positive : colors.negative;

  const weekRange52 = useMemo(() => {
    if (!candleResult || candleResult.status !== 'ok') return null;
    const { candle } = candleResult;
    const days252 = Math.max(0, candle.l.length - 252);
    const lows = candle.l.slice(days252);
    const highs = candle.h.slice(days252);
    if (lows.length === 0) return null;
    const lo = Math.min(...lows);
    const hi = Math.max(...highs);
    return `${lo.toFixed(2)} - ${hi.toFixed(2)}`;
  }, [candleResult]);

  const dividendDisplay = useMemo(() => {
    if (dividends.length === 0) return '-';
    const latest = dividends[0];
    if (!latest.cash_amount) return '-';
    const freqMap: Record<number, string> = { 1: 'ANNUAL', 2: 'SEMI-ANNUAL', 4: 'QUARTERLY', 12: 'MONTHLY' };
    const freqLabel = latest.frequency ? freqMap[latest.frequency] ?? '' : '';
    return `$${latest.cash_amount.toFixed(2)}${freqLabel ? ' ' + freqLabel : ''}`;
  }, [dividends]);

  const displayIndustry = tickerDetails?.sic_description ?? profile?.finnhubIndustry ?? '-';
  const displayDescription = tickerDetails?.description ?? null;
  const displayWebsite = tickerDetails?.homepage_url ?? profile?.weburl ?? null;

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Header bar */}
      <View style={s.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn} activeOpacity={0.7}>
          <Text style={s.backChevron}>{'‹'}</Text>
        </TouchableOpacity>
        <Text style={s.headerSymbol}>{symbol}</Text>
      </View>

      {loading ? (
        <View style={s.center}>
          <ActivityIndicator color={colors.amber} />
        </View>
      ) : (
        <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
          {/* Identity */}
          <View style={s.section}>
            <Text style={s.ticker}>{symbol}</Text>
            {profile && (
              <Text style={s.companyName}>{profile.name}</Text>
            )}
            {profile && (
              <Text style={s.meta}>
                {profile.exchange} · {profile.finnhubIndustry}
              </Text>
            )}
          </View>

          {/* Price */}
          <View style={s.section}>
            {q ? (
              <>
                <Text style={s.bigPrice}>{q.c.toFixed(2)}</Text>
                <Text style={[s.bigChange, { color: changeColor }]}>
                  {q.d >= 0 ? '+' : ''}{q.d.toFixed(2)} ({q.dp >= 0 ? '+' : ''}{q.dp.toFixed(2)}%)
                </Text>
              </>
            ) : (
              <Text style={s.noData}>QUOTE UNAVAILABLE</Text>
            )}
          </View>

          {/* Range selector */}
          <View style={s.rangeRow}>
            {RANGES.map(r => (
              <TouchableOpacity
                key={r}
                onPress={() => setRange(r)}
                style={[s.rangeBtn, range === r && s.rangeBtnActive]}
                activeOpacity={0.7}
              >
                <Text style={[s.rangeBtnText, range === r && s.rangeBtnTextActive]}>{r}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Chart */}
          <CandleChart
            candleResult={candleResult}
            range={range}
            chartColor={chartColor}
            prevClose={q?.pc ?? null}
          />

          {/* TODAY */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>TODAY</Text>
            <View style={s.grid}>
              <GridCell label="OPEN" value={q ? q.o.toFixed(2) : '—'} />
              <GridCell label="PREV CLOSE" value={q ? q.pc.toFixed(2) : '—'} />
              <GridCell label="DAY HIGH" value={q ? q.h.toFixed(2) : '—'} />
              <GridCell label="DAY LOW" value={q ? q.l.toFixed(2) : '—'} />
              <GridCell label="MARKET CAP" value={profile ? fmtMktCap(profile.marketCapitalization) : '—'} />
            </View>
          </View>

          {/* PROFILE */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>PROFILE</Text>
            <View style={s.grid}>
              <GridCell label="EXCHANGE" value={tickerDetails?.primary_exchange ?? profile?.exchange ?? '-'} />
              <GridCell label="INDUSTRY" value={displayIndustry} />
              <GridCell label="IPO DATE" value={tickerDetails?.list_date ?? profile?.ipo ?? '-'} />
              {displayWebsite ? (
                <TouchableOpacity
                  style={s.gridCell}
                  activeOpacity={0.7}
                  onPress={() => WebBrowser.openBrowserAsync(displayWebsite)}
                >
                  <Text style={s.gridLabel}>WEBSITE</Text>
                  <Text style={[s.gridValue, { color: colors.accent }]} numberOfLines={1}>
                    {displayWebsite.replace(/^https?:\/\//, '')}
                  </Text>
                </TouchableOpacity>
              ) : (
                <GridCell label="WEBSITE" value="-" />
              )}
            </View>
            {displayDescription && (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => setDescExpanded(v => !v)}
                style={s.descContainer}
              >
                <Text
                  style={s.descText}
                  numberOfLines={descExpanded ? undefined : 3}
                >
                  {displayDescription}
                </Text>
                <Text style={s.descMore}>
                  {descExpanded ? 'LESS' : 'MORE'}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* FUNDAMENTALS */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>FUNDAMENTALS</Text>
            <View style={s.grid}>
              <GridCell label="52W RANGE" value={weekRange52 ?? '-'} />
              <GridCell label="DIVIDEND" value={dividendDisplay} />
              <GridCell
                label="P/E"
                value={
                  q && xbrlMetrics?.epsDiluted && xbrlMetrics.epsDiluted > 0
                    ? (q.c / xbrlMetrics.epsDiluted).toFixed(2)
                    : '-'
                }
                muted={!xbrlMetrics?.epsDiluted}
              />
              <GridCell
                label="EPS"
                value={
                  xbrlMetrics?.epsDiluted != null
                    ? `$${xbrlMetrics.epsDiluted.toFixed(2)}`
                    : '-'
                }
                muted={xbrlMetrics?.epsDiluted == null}
              />
            </View>
          </View>

          {/* RELATED */}
          <View style={s.section}>
            <Text style={s.sectionTitle}>RELATED</Text>
            <View style={s.relatedRow}>
              <TouchableOpacity
                style={s.relatedBtn}
                activeOpacity={0.7}
                onPress={() => {
                  navigation.dispatch(
                    CommonActions.reset({
                      index: 0,
                      routes: [{
                        name: 'Main',
                        params: { floor: 'Stocks', tab: 'Filings', params: { ticker: symbol } },
                      }],
                    }),
                  );
                }}
              >
                <Text style={s.relatedBtnText}>VIEW FILINGS</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.relatedBtn}
                activeOpacity={0.7}
                onPress={() => {
                  navigation.dispatch(
                    CommonActions.reset({
                      index: 0,
                      routes: [{
                        name: 'Main',
                        params: { floor: 'Stocks', tab: 'StockNews', params: { ticker: symbol } },
                      }],
                    }),
                  );
                }}
              >
                <Text style={s.relatedBtnText}>COMPANY NEWS</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* PEERS */}
          {relatedTickers.length > 0 && (
            <View style={s.section}>
              <Text style={s.sectionTitle}>PEERS</Text>
              <View style={s.peersRow}>
                {relatedTickers.slice(0, 5).map(t => (
                  <TouchableOpacity
                    key={t}
                    style={s.peerBadge}
                    activeOpacity={0.7}
                    onPress={() => navigation.push('StockDetail', { symbol: t })}
                  >
                    <Text style={s.peerBadgeText}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}

          {/* REMOVE */}
          <View style={[s.section, { marginBottom: insets.bottom + 20 }]}>
            <TouchableOpacity
              style={s.removeBtn}
              activeOpacity={0.7}
              onPress={handleRemove}
            >
              <Text style={s.removeBtnText}>REMOVE FROM WATCHLIST</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}
    </View>
  );
}

/* ---------- Chart sub-component ---------- */

function CandleChart({
  candleResult,
  range,
  chartColor,
  prevClose,
}: {
  candleResult: CandleResult | null;
  range: Range;
  chartColor: string;
  prevClose: number | null;
}) {
  const sliced = useMemo(() => {
    if (!candleResult || candleResult.status !== 'ok') return null;
    const { candle } = candleResult;
    const days = rangeDays(range);
    const start = Math.max(0, candle.c.length - days);
    return {
      t: candle.t.slice(start),
      c: candle.c.slice(start),
    };
  }, [candleResult, range]);

  if (!candleResult) {
    return (
      <View style={s.chartBox}>
        <ActivityIndicator color={colors.amber} />
      </View>
    );
  }

  if (candleResult.status === 'rate_limited') {
    return (
      <View style={s.chartBox}>
        <Text style={s.chartMsg}>CHART UNAVAILABLE — DAILY LIMIT</Text>
      </View>
    );
  }

  if (candleResult.status === 'error' || !sliced || sliced.c.length < 2) {
    return (
      <View style={s.chartBox}>
        <Text style={s.chartMsg}>CHART UNAVAILABLE</Text>
      </View>
    );
  }

  const screenW = Dimensions.get('window').width;
  const H = 180;
  const PAD_L = 48;
  const PAD_R = 8;
  const PAD_T = 8;
  const PAD_B = 22;
  const chartW = screenW - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  const values = sliced.c;
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const dom = padDomain(minVal, maxVal);

  const toX = (i: number) => PAD_L + (i / (values.length - 1)) * chartW;
  const toY = (v: number) => PAD_T + chartH - ((v - dom.min) / dom.range) * chartH;

  const linePoints = values
    .map((v, i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`)
    .join(' ');

  const fillPoints =
    `${toX(0).toFixed(1)},${(PAD_T + chartH).toFixed(1)} ` +
    linePoints +
    ` ${toX(values.length - 1).toFixed(1)},${(PAD_T + chartH).toFixed(1)}`;

  const labelCount = 5;
  const dateLabels: { label: string; x: number }[] = [];
  for (let i = 0; i < labelCount; i++) {
    const idx = Math.round((i / (labelCount - 1)) * (values.length - 1));
    const d = new Date(sliced.t[idx] * 1000);
    dateLabels.push({
      label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      x: toX(idx),
    });
  }

  const yLabels = [
    { value: maxVal, y: toY(maxVal) },
    { value: (maxVal + minVal) / 2, y: toY((maxVal + minVal) / 2) },
    { value: minVal, y: toY(minVal) },
  ];

  const pcY = prevClose !== null && prevClose >= dom.min && prevClose <= dom.max
    ? toY(prevClose) : null;

  return (
    <View style={s.chartSection}>
      <View style={{ backgroundColor: colors.surface }}>
        <Svg width={screenW} height={H}>
          {[0, 0.5, 1].map(frac => (
            <Line
              key={frac}
              x1={PAD_L}
              y1={PAD_T + chartH * (1 - frac)}
              x2={screenW - PAD_R}
              y2={PAD_T + chartH * (1 - frac)}
              stroke="#1a1a1a"
              strokeWidth="1"
            />
          ))}

          <Polygon points={fillPoints} fill={chartColor} opacity={0.12} />
          <Polyline points={linePoints} fill="none" stroke={chartColor} strokeWidth="1.5" />

          {pcY !== null && (
            <Line
              x1={PAD_L}
              y1={pcY}
              x2={screenW - PAD_R}
              y2={pcY}
              stroke={colors.textMuted}
              strokeWidth="1"
              strokeDasharray="4,4"
            />
          )}

          {yLabels.map((yl, i) => (
            <SvgText
              key={i}
              x={PAD_L - 4}
              y={yl.y + 3}
              textAnchor="end"
              fill="#666666"
              fontSize="9"
              fontFamily={fonts.mono!}
            >
              {yl.value.toFixed(2)}
            </SvgText>
          ))}

          {dateLabels.map((dl, i) => (
            <SvgText
              key={i}
              x={dl.x}
              y={H - 4}
              textAnchor={i === 0 ? 'start' : i === dateLabels.length - 1 ? 'end' : 'middle'}
              fill="#666666"
              fontSize="9"
              fontFamily={fonts.mono!}
            >
              {dl.label}
            </SvgText>
          ))}
        </Svg>
      </View>
      <Text style={s.chartFooter}>
        DAILY OHLCV · END OF DAY · MASSIVE
      </Text>
    </View>
  );
}

/* ---------- Grid cell ---------- */

function GridCell({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <View style={s.gridCell}>
      <Text style={s.gridLabel}>{label}</Text>
      <Text style={[s.gridValue, muted && { color: colors.textMuted }]}>{value}</Text>
    </View>
  );
}

/* ---------- Styles ---------- */

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scroll: { flex: 1 },

  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    backgroundColor: colors.surfaceAlt,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: { paddingHorizontal: 16 },
  backChevron: { fontFamily: fonts.monoBold, fontSize: 22, color: colors.accent },
  headerSymbol: { fontFamily: fonts.monoBold, fontSize: 14, color: colors.accent },

  section: { paddingHorizontal: 12, paddingVertical: 10 },
  sectionTitle: {
    fontFamily: fonts.monoBold,
    fontSize: 10,
    color: colors.accent,
    letterSpacing: 1,
    marginBottom: 8,
  },

  ticker: { fontFamily: fonts.monoBold, fontSize: 18, color: colors.accent },
  companyName: { fontFamily: fonts.mono, fontSize: 12, color: colors.textPrimary, marginTop: 2 },
  meta: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted, marginTop: 2 },

  bigPrice: { fontFamily: fonts.monoBold, fontSize: 28, color: colors.textPrimary },
  bigChange: { fontFamily: fonts.mono, fontSize: 13, marginTop: 2 },
  noData: { fontFamily: fonts.mono, fontSize: 13, color: colors.textMuted },

  rangeRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    gap: 8,
    marginBottom: 4,
  },
  rangeBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  rangeBtnActive: {
    borderColor: colors.accent,
    backgroundColor: '#1a1000',
  },
  rangeBtnText: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted },
  rangeBtnTextActive: { color: colors.accent },

  chartBox: {
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  chartMsg: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted },
  chartSection: { paddingHorizontal: 0, marginBottom: 4 },
  chartFooter: {
    fontFamily: fonts.mono,
    fontSize: 8,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
    letterSpacing: 1,
  },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridCell: {
    width: '50%',
    paddingVertical: 6,
    paddingRight: 8,
  },
  gridLabel: { fontFamily: fonts.mono, fontSize: 9, color: colors.textMuted, letterSpacing: 0.5 },
  gridValue: { fontFamily: fonts.monoBold, fontSize: 12, color: colors.textPrimary, marginTop: 1 },

  descContainer: { marginTop: 8 },
  descText: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted, lineHeight: 15 },
  descMore: { fontFamily: fonts.monoBold, fontSize: 9, color: colors.accent, marginTop: 4, letterSpacing: 0.5 },

  peersRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  peerBadge: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  peerBadgeText: { fontFamily: fonts.monoBold, fontSize: 10, color: colors.accent },

  relatedRow: { flexDirection: 'row', gap: 8 },
  relatedBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  relatedBtnText: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted },

  removeBtn: {
    borderWidth: 1,
    borderColor: colors.negative,
    paddingVertical: 10,
    alignItems: 'center',
  },
  removeBtnText: { fontFamily: fonts.monoBold, fontSize: 10, color: colors.negative, letterSpacing: 1 },
});
