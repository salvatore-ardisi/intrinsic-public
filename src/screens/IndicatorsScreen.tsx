import { useCallback, useEffect, useState, useMemo } from 'react';
import {
  View, Text, SectionList, TouchableOpacity, RefreshControl,
  StyleSheet, ActivityIndicator, Dimensions,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import Svg, { Polyline, Line, Text as SvgText } from 'react-native-svg';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { MaterialTopTabNavigationProp } from '@react-navigation/material-top-tabs';
import { colors, fonts } from '../config/theme';
import { EXPLAINERS, FRED_CHART_MAP, SERIES_CHART_MAP } from '../config/series';
import { fetchIndicators, fetchYieldCurveHistory, fetchSeriesHistory, getCachedResearch, getCachedNews } from '../lib/api';
import { formatValue, formatChange, formatDate, directionColor, directionArrow } from '../lib/format';
import { decodeHTMLEntities } from '../lib/html';
import { findRelatedArticles } from '../lib/crossref';
import { analyzeIndicator, generateDynamicReading } from '../lib/historicalAnalysis';
import type { RootTabParamList } from '../lib/navigation';
import type { Indicator, CategoryGroup, YieldCurvePoint, Observation } from '../lib/types';
import IndicatorChart from '../components/IndicatorChart';
import MacroSummary from '../components/MacroSummary';

type Direction = 'up' | 'down' | 'flat';

const READINGS: Record<string, Record<Direction, string>> = {
  UNRATE: {
    flat: 'Unemployment held steady at {value}. The labor market is stable with no significant change in joblessness.',
    up: 'Unemployment rose to {value} from {prev}. Rising unemployment suggests the labor market is softening, which could slow consumer spending but may ease inflation pressure.',
    down: 'Unemployment fell to {value} from {prev}. A tightening labor market is positive for workers and spending, but the Fed watches for wage-driven inflation at low unemployment levels.',
  },
  CES0000000001: {
    up: 'The economy added {change} thousand jobs. Positive job growth signals economic expansion. Above +200K is considered strong; below +100K signals a slowdown.',
    down: 'The economy lost {change} thousand jobs. Negative payroll growth is a recession warning signal.',
    flat: 'Payrolls were essentially flat. The labor market is neither adding nor shedding jobs.',
  },
  LNS11300000: {
    up: 'Participation rose to {value}. More people are entering the workforce, which is a sign of confidence in job prospects.',
    down: 'Participation fell to {value}. Workers may be dropping out of the labor force due to discouragement, retirement, or other factors. This can mask true unemployment.',
    flat: 'Participation rate unchanged. The labor force composition is stable.',
  },
  CPIAUCSL: {
    up: 'CPI rose to {value}, a {change_pct}% increase. Consumer prices are climbing, eroding purchasing power. The Fed targets around 2% annual inflation.',
    down: 'CPI declined to {value}. Falling prices (deflation) can signal weak demand, which the Fed typically responds to with rate cuts.',
    flat: 'CPI unchanged. Price stability, which is the Fed target.',
  },
  PCEPI: {
    up: 'PCE index rose to {value}. This is the Fed preferred inflation gauge - persistent increases above 2% annualized make rate cuts less likely.',
    down: 'PCE index fell to {value}. Declining PCE inflation gives the Fed room to cut rates if needed.',
    flat: 'PCE inflation flat - consistent with price stability.',
  },
  T10YIE: {
    up: 'Breakeven inflation rose to {value}%. The bond market is pricing in higher future inflation, which typically pushes yields up and weighs on growth stocks.',
    down: 'Breakeven inflation fell to {value}%. The market expects lower inflation ahead, which supports the case for rate cuts.',
    flat: 'Inflation expectations stable at {value}%.',
  },
  GDPC1: {
    up: 'Real GDP grew to ${value}B, up ${change}B from the prior quarter. The economy is expanding. Two consecutive quarterly declines is the textbook definition of recession.',
    down: 'Real GDP contracted to ${value}B. Economic output shrank, which if sustained for two quarters constitutes a recession.',
    flat: 'GDP essentially flat - the economy is stalling, neither growing nor contracting.',
  },
  FEDFUNDS: {
    up: 'The fed funds rate rose to {value}%. The Fed is tightening monetary policy to combat inflation. Higher rates slow borrowing, cool the economy, and pressure asset prices.',
    down: 'The fed funds rate fell to {value}%. The Fed is easing policy, which stimulates borrowing, spending, and typically boosts asset prices.',
    flat: 'Fed funds rate unchanged at {value}%. The Fed is holding steady, watching incoming data before making the next move.',
  },
  DGS10: {
    up: 'The 10-year yield rose to {value}%. Higher long-term rates increase mortgage and corporate borrowing costs, and compress stock valuations (especially growth stocks).',
    down: 'The 10-year yield fell to {value}%. Falling yields signal a flight to safety or expectations of slower growth, and reduce borrowing costs across the economy.',
    flat: 'The 10-year yield is stable at {value}%. Bond markets are in wait-and-see mode.',
  },
  DGS2: {
    up: 'The 2-year yield rose to {value}%. Markets are pricing in tighter Fed policy or higher short-term rates ahead.',
    down: 'The 2-year yield fell to {value}%. Markets expect the Fed to ease policy or see lower short-term rates ahead.',
    flat: 'The 2-year yield is stable at {value}%. Near-term rate expectations are unchanged.',
  },
  MORTGAGE30US: {
    up: 'Mortgage rates rose to {value}%. Higher mortgage rates reduce home affordability and cool housing demand. Each 1% increase reduces purchasing power by roughly 10%.',
    down: 'Mortgage rates fell to {value}%. Lower rates improve affordability and tend to stimulate home buying and refinancing activity.',
    flat: 'Mortgage rates steady at {value}%. Housing affordability conditions are unchanged.',
  },
  YIELD_SPREAD: {
    up: 'The yield curve steepened to {value}%. A positive and widening spread is the normal state - long-term rates above short-term rates signal confidence in future growth.',
    down: 'The yield curve flattened to {value}%. A narrowing spread signals growing caution about the economic outlook. Watch for inversion (below zero).',
    flat: 'The yield spread is stable at {value}%.',
  },
};

interface ReadingResult {
  text: string;
  isInversionWarning: boolean;
}

function getReading(indicator: Indicator): ReadingResult | null {
  if (indicator.series_id === 'YIELD_SPREAD' && indicator.value !== null && indicator.value < 0) {
    const dgs10 = indicator.dgs10_value !== undefined ? indicator.dgs10_value.toFixed(2) : '--';
    const dgs2 = indicator.dgs2_value !== undefined ? indicator.dgs2_value.toFixed(2) : '--';
    return {
      text: `THE YIELD CURVE IS INVERTED at ${indicator.value.toFixed(2)}%. The 2-year yield (${dgs2}%) exceeds the 10-year yield (${dgs10}%). Every U.S. recession since 1955 has been preceded by a yield curve inversion. This does not mean recession is imminent - the lead time has historically ranged from 6 to 24 months - but it is the most reliable warning signal in macro finance.`,
      isInversionWarning: true,
    };
  }

  const templates = READINGS[indicator.series_id];
  if (!templates) return null;
  const template = templates[indicator.direction];
  if (!template) return null;

  const val = indicator.value !== null ? formatValue(indicator.value, indicator.unit) : '--';
  const prev = indicator.previous !== null ? formatValue(indicator.previous, indicator.unit) : '--';
  const chg = indicator.change !== null ? Math.abs(indicator.change).toString() : '--';
  const chgPct = indicator.change_pct !== null ? Math.abs(indicator.change_pct).toFixed(2) : '--';

  return {
    text: template
      .replace(/\{value\}/g, val)
      .replace(/\$\{value\}/g, val)
      .replace(/\{prev\}/g, prev)
      .replace(/\{change\}/g, chg)
      .replace(/\$\{change\}/g, chg)
      .replace(/\{change_pct\}/g, chgPct),
    isInversionWarning: false,
  };
}

export default function IndicatorsScreen() {
  const route = useRoute<RouteProp<RootTabParamList, 'Indicators'>>();
  const [categories, setCategories] = useState<CategoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const paramId = route.params?.expandedSeriesId;
    if (paramId) setExpanded(paramId);
  }, [route.params?.expandedSeriesId]);

  const load = useCallback(async (force = false) => {
    try {
      const data = await fetchIndicators(force);
      setCategories(data);
    } catch { /* handled per-indicator */ }
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  const onRefresh = useCallback(async () => {
    console.log('[IndicatorsScreen] onRefresh fired');
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
    console.log('[IndicatorsScreen] onRefresh complete');
  }, [load]);

  const allIndicators = useMemo(
    () => categories.flatMap(c => c.indicators),
    [categories],
  );

  const toggleExpand = (id: string) => {
    setExpanded(prev => prev === id ? null : id);
  };

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={colors.amber} />
      </View>
    );
  }

  const sections = categories.map(cat => ({
    title: cat.name,
    data: cat.indicators,
  }));

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => item.series_id}
      style={s.list}
      stickySectionHeadersEnabled={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.amber}
          colors={[colors.amber]}
          progressBackgroundColor={colors.surface}
        />
      }
      renderSectionHeader={({ section }) => (
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>{section.title.toUpperCase()}</Text>
        </View>
      )}
      renderItem={({ item }) => (
        <IndicatorRow
          indicator={item}
          isExpanded={expanded === item.series_id}
          onPress={() => toggleExpand(item.series_id)}
        />
      )}
      ListHeaderComponent={
        <View>
          <MacroSummary indicators={allIndicators} />
          <View style={s.statusBar}>
            <Text style={s.statusText}>
              {categories.reduce((s, c) => s + c.indicators.length, 0)} SERIES
            </Text>
            <Text style={s.statusSep}>|</Text>
            <Text style={s.statusText}>SOURCES: FRED + BLS</Text>
          </View>
        </View>
      }
    />
  );
}

function IndicatorRow({ indicator, isExpanded, onPress }: {
  indicator: Indicator;
  isExpanded: boolean;
  onPress: () => void;
}) {
  const sentiment = directionColor(indicator.direction, indicator.invert_sentiment);
  const arrow = directionArrow(indicator.direction);
  const changeColor = sentiment === 'positive' ? colors.positive
    : sentiment === 'negative' ? colors.negative : colors.textMuted;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      style={[s.row, isExpanded && s.rowExpanded]}
    >
      <View style={s.rowMain}>
        <View style={s.rowLeft}>
          <Text style={s.seriesId}>{indicator.series_id}</Text>
          <Text style={s.name} numberOfLines={1}>{indicator.name}</Text>
        </View>
        <View style={s.rowRight}>
          <Text style={s.value}>
            {indicator.error
              ? <Text style={{ color: colors.negative }}>ERR</Text>
              : formatValue(indicator.value, indicator.unit)}
          </Text>
          <Text style={[s.change, { color: changeColor }]}>
            {indicator.change !== null
              ? `${arrow} ${formatChange(indicator.change, indicator.unit)}`
              : '--'}
          </Text>
        </View>
      </View>

      {isExpanded && <DetailSection indicator={indicator} />}
    </TouchableOpacity>
  );
}

function formatRelativeDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffH = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60));
    if (diffH < 1) return 'now';
    if (diffH < 24) return `${diffH}h ago`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

function RelatedArticles({ seriesId }: { seriesId: string }) {
  const articles = useMemo(() => {
    const research = getCachedResearch() || [];
    const news = getCachedNews() || [];
    const all = [
      ...research.map(r => ({ title: r.title, description: r.description, date: r.date, link: r.link, source: r.source })),
      ...news.map(n => ({ title: n.title, date: n.date, link: n.link, source: n.source })),
    ];
    return findRelatedArticles(seriesId, all).slice(0, 3);
  }, [seriesId]);

  if (articles.length === 0) return null;

  return (
    <View style={s.relatedBlock}>
      <Text style={s.relatedLabel}>RELATED ARTICLES</Text>
      {articles.map((article, i) => (
        <TouchableOpacity
          key={i}
          onPress={() => { if (article.link) WebBrowser.openBrowserAsync(article.link); }}
          activeOpacity={0.7}
          style={s.relatedRow}
        >
          <View style={s.relatedTop}>
            <View style={s.relatedBadge}>
              <Text style={s.relatedBadgeText}>{article.source}</Text>
            </View>
            {article.date && (
              <Text style={s.relatedDate}>{formatRelativeDate(article.date)}</Text>
            )}
          </View>
          <Text style={s.relatedTitle} numberOfLines={2}>{decodeHTMLEntities(article.title)}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function YieldCurveChart() {
  const [data, setData] = useState<YieldCurvePoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchYieldCurveHistory().then(setData).finally(() => setLoading(false));
  }, []);

  if (loading) return <Text style={{ fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted }}>Loading yield curve...</Text>;
  if (data.length < 2) return null;

  const screenW = Dimensions.get('window').width - 24;
  const H = 180;
  const PAD_L = 40;
  const PAD_R = 8;
  const PAD_T = 8;
  const PAD_B = 22;
  const chartW = screenW - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  const spreads = data.map(d => d.spread);
  const minVal = Math.min(...spreads);
  const maxVal = Math.max(...spreads);
  const range = maxVal - minVal || 1;

  const toX = (i: number) => PAD_L + (i / (data.length - 1)) * chartW;
  const toY = (v: number) => PAD_T + chartH - ((v - minVal) / range) * chartH;
  const zeroY = toY(0);
  const zeroInView = minVal <= 0 && maxVal >= 0;

  const linePoints = data.map((d, i) => `${toX(i).toFixed(1)},${toY(d.spread).toFixed(1)}`).join(' ');

  const posPoints: string[] = [];
  const negPoints: string[] = [];
  for (let i = 0; i < data.length; i++) {
    const x = toX(i).toFixed(1);
    const y = toY(data[i].spread).toFixed(1);
    if (data[i].spread >= 0) {
      posPoints.push(`${x},${y}`);
    } else {
      negPoints.push(`${x},${y}`);
    }
  }

  const labelCount = 5;
  const dateLabels: { label: string; x: number }[] = [];
  for (let i = 0; i < labelCount; i++) {
    const idx = Math.round((i / (labelCount - 1)) * (data.length - 1));
    const d = new Date(data[idx].date);
    dateLabels.push({
      label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      x: toX(idx),
    });
  }

  const fmtY = (v: number) => v.toFixed(1);

  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ fontFamily: fonts.monoBold, fontSize: 10, color: colors.accent, marginBottom: 4 }}>
        YIELD CURVE SPREAD (10Y - 2Y)
      </Text>
      <View style={{ backgroundColor: '#000000' }}>
        <Svg width={screenW} height={H}>
          {/* Fill areas - simplified: positive green, negative red */}
          {data.length > 1 && (() => {
            const segments: { points: string; isPositive: boolean }[] = [];
            let currentSegment: { xs: string[]; isPos: boolean } | null = null;

            for (let i = 0; i < data.length; i++) {
              const isPos = data[i].spread >= 0;
              const x = toX(i).toFixed(1);
              const y = toY(data[i].spread).toFixed(1);

              if (!currentSegment || currentSegment.isPos !== isPos) {
                if (currentSegment && currentSegment.xs.length > 0) {
                  const lastX = toX(i - 1).toFixed(1);
                  const closedPts = [...currentSegment.xs, `${lastX},${zeroY.toFixed(1)}`, `${currentSegment.xs[0].split(',')[0]},${zeroY.toFixed(1)}`].join(' ');
                  segments.push({ points: closedPts, isPositive: currentSegment.isPos });
                }
                currentSegment = { xs: [`${x},${y}`], isPos };
              } else {
                currentSegment.xs.push(`${x},${y}`);
              }
            }
            if (currentSegment && currentSegment.xs.length > 0) {
              const lastX = toX(data.length - 1).toFixed(1);
              const closedPts = [...currentSegment.xs, `${lastX},${zeroY.toFixed(1)}`, `${currentSegment.xs[0].split(',')[0]},${zeroY.toFixed(1)}`].join(' ');
              segments.push({ points: closedPts, isPositive: currentSegment.isPos });
            }

            return segments.map((seg, i) => (
              <Polyline
                key={i}
                points={seg.points}
                fill={seg.isPositive ? 'rgba(51, 255, 51, 0.10)' : 'rgba(255, 51, 51, 0.10)'}
                stroke="none"
              />
            ));
          })()}

          {/* Grid */}
          {[0, 0.25, 0.5, 0.75, 1].map(frac => (
            <Line key={frac} x1={PAD_L} y1={PAD_T + chartH * (1 - frac)} x2={screenW - PAD_R} y2={PAD_T + chartH * (1 - frac)} stroke="#1a1a1a" strokeWidth="1" />
          ))}

          {/* Zero line */}
          {zeroInView && (
            <Line x1={PAD_L} y1={zeroY} x2={screenW - PAD_R} y2={zeroY} stroke="#555555" strokeWidth="1" strokeDasharray="4,3" />
          )}

          {/* Data line */}
          <Polyline points={linePoints} fill="none" stroke={colors.amber} strokeWidth="1.5" />

          {/* Y-axis */}
          {[maxVal, (maxVal + minVal) / 2, minVal].map((val, i) => (
            <SvgText key={i} x={PAD_L - 4} y={toY(val) + 3} textAnchor="end" fill="#666666" fontSize="9" fontFamily={fonts.mono!}>{fmtY(val)}</SvgText>
          ))}
          {zeroInView && (
            <SvgText x={PAD_L - 4} y={zeroY + 3} textAnchor="end" fill="#999999" fontSize="9" fontFamily={fonts.mono!}>0.0</SvgText>
          )}

          {/* X-axis */}
          {dateLabels.map((dl, i) => (
            <SvgText key={i} x={dl.x} y={H - 4} textAnchor={i === 0 ? 'start' : i === dateLabels.length - 1 ? 'end' : 'middle'} fill="#666666" fontSize="9" fontFamily={fonts.mono!}>{dl.label}</SvgText>
          ))}
        </Svg>
      </View>
    </View>
  );
}

function DetailSection({ indicator }: { indicator: Indicator }) {
  const nav = useNavigation<MaterialTopTabNavigationProp<RootTabParamList>>();
  const sentiment = directionColor(indicator.direction, indicator.invert_sentiment);
  const arrow = directionArrow(indicator.direction);
  const changeColor = sentiment === 'positive' ? colors.positive
    : sentiment === 'negative' ? colors.negative : colors.textMuted;
  const explainer = EXPLAINERS[indicator.series_id];
  const isBLS = indicator.source === 'BLS';
  const isComputed = indicator.series_id === 'YIELD_SPREAD';
  const fredChartId = FRED_CHART_MAP[indicator.series_id];
  const chartSeriesId = fredChartId || indicator.series_id;
  const canChart = !isComputed;
  const chartTarget = SERIES_CHART_MAP[indicator.series_id];

  const [history, setHistory] = useState<Observation[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  useEffect(() => {
    if (isComputed) {
      Promise.all([fetchSeriesHistory('DGS10'), fetchSeriesHistory('DGS2')]).then(([obs10, obs2]) => {
        const map2: Record<string, number> = {};
        for (const o of obs2) map2[o.date] = o.value;
        const spreadObs: Observation[] = [];
        for (const o of obs10) {
          if (map2[o.date] !== undefined) {
            spreadObs.push({ date: o.date, value: parseFloat((o.value - map2[o.date]).toFixed(2)) });
          }
        }
        setHistory(spreadObs);
        setHistoryLoaded(true);
      });
    } else {
      fetchSeriesHistory(chartSeriesId)
        .then(obs => { setHistory(obs); setHistoryLoaded(true); })
        .catch(() => setHistoryLoaded(true));
    }
  }, [indicator.series_id, chartSeriesId, isComputed]);

  const dynamicReading = useMemo(() => {
    if (!historyLoaded || history.length < 3 || indicator.value === null) return null;
    const analysis = analyzeIndicator(
      indicator.series_id,
      indicator.value,
      indicator.previous,
      indicator.direction,
      history,
    );
    if (!analysis) return null;
    return generateDynamicReading(
      indicator.series_id,
      analysis,
      indicator.value,
      indicator.previous,
      indicator.change,
      indicator.change_pct,
    );
  }, [historyLoaded, history, indicator]);

  const staticReading = getReading(indicator);
  const reading = dynamicReading || staticReading;

  return (
    <View style={s.detail}>
      {/* Header metrics */}
      <View style={s.detailHeader}>
        <Text style={s.detailValue}>
          {formatValue(indicator.value, indicator.unit)}
        </Text>
        <Text style={[s.detailChange, { color: changeColor }]}>
          {indicator.change !== null
            ? `${arrow} ${formatChange(indicator.change, indicator.unit)}`
            : '--'}
          {indicator.change_pct !== null && (
            <Text style={s.detailPct}>
              {' '}({indicator.change_pct > 0 ? '+' : ''}{indicator.change_pct.toFixed(2)}%)
            </Text>
          )}
        </Text>
        <Text style={s.detailDate}>{formatDate(indicator.date)}</Text>
      </View>

      {/* Metadata */}
      <View style={s.metadata}>
        <Text style={s.metaText}>{indicator.category.toUpperCase()}</Text>
        <Text style={s.metaSep}>|</Text>
        <Text style={s.metaText}>{indicator.source}</Text>
        <Text style={s.metaSep}>|</Text>
        <Text style={s.metaText}>{indicator.frequency.toUpperCase()}</Text>
        <Text style={s.metaSep}>|</Text>
        <Text style={s.metaText}>{indicator.unit.toUpperCase()}</Text>
      </View>

      {/* Explainer */}
      {explainer && (
        <Text style={s.explainer}>{explainer}</Text>
      )}

      {/* Reading */}
      {reading && (
        <View style={s.readingBlock}>
          <Text style={s.readingLabel}>READING</Text>
          <Text style={[s.readingText, reading.isInversionWarning && s.readingWarning]}>
            {reading.text}
          </Text>
        </View>
      )}

      {/* Sparkline Chart */}
      {canChart && !historyLoaded && (
        <Text style={s.chartLoading}>LOADING...</Text>
      )}
      {canChart && historyLoaded && history.length >= 2 && (
        <IndicatorChart
          observations={history}
          unit={indicator.unit}
          decimals={indicator.unit === '%' ? 2 : indicator.unit === 'index' ? 1 : 1}
        />
      )}

      {/* View in Charts link */}
      {chartTarget && (
        <TouchableOpacity onPress={() => nav.navigate('Charts', { scrollTo: chartTarget })}>
          <Text style={s.externalLink}>VIEW IN CHARTS →</Text>
        </TouchableOpacity>
      )}

      {/* Related Articles */}
      <RelatedArticles seriesId={indicator.series_id} />

      {/* Yield Curve Chart */}
      {isComputed && <YieldCurveChart />}

      {/* External links */}
      {!isComputed && isBLS && fredChartId && (
        <>
          <TouchableOpacity onPress={() => WebBrowser.openBrowserAsync(`https://data.bls.gov/timeseries/${indicator.series_id}`)}>
            <Text style={s.externalLink}>VIEW ON BLS →</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => WebBrowser.openBrowserAsync(`https://fred.stlouisfed.org/series/${fredChartId}`)}>
            <Text style={s.externalLink}>VIEW ON FRED →</Text>
          </TouchableOpacity>
        </>
      )}
      {!isComputed && isBLS && !fredChartId && (
        <TouchableOpacity onPress={() => WebBrowser.openBrowserAsync(`https://data.bls.gov/timeseries/${indicator.series_id}`)}>
          <Text style={s.externalLink}>VIEW ON BLS →</Text>
        </TouchableOpacity>
      )}
      {!isComputed && !isBLS && (
        <TouchableOpacity onPress={() => WebBrowser.openBrowserAsync(`https://fred.stlouisfed.org/series/${indicator.series_id}`)}>
          <Text style={s.externalLink}>VIEW ON FRED →</Text>
        </TouchableOpacity>
      )}

      {/* Inverted sentiment */}
      {indicator.invert_sentiment && (
        <Text style={s.invertedNote}>INVERTED SENTIMENT — increase is negative for markets</Text>
      )}
    </View>
  );
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
  sectionHeader: {
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: colors.surfaceAlt, borderTopWidth: 1, borderTopColor: colors.border,
  },
  sectionTitle: { fontFamily: fonts.monoBold, fontSize: 11, color: colors.accent },
  row: { borderBottomWidth: 1, borderBottomColor: colors.borderSubtle, paddingHorizontal: 12, paddingVertical: 8 },
  rowExpanded: { backgroundColor: colors.hoverRow },
  rowMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLeft: { flex: 1, marginRight: 12 },
  seriesId: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted },
  name: { fontFamily: fonts.mono, fontSize: 12, color: colors.textPrimary, marginTop: 1 },
  rowRight: { alignItems: 'flex-end' },
  value: { fontFamily: fonts.monoBold, fontSize: 13, color: colors.textPrimary },
  change: { fontFamily: fonts.monoBold, fontSize: 11, marginTop: 2 },
  detail: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  detailHeader: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 8 },
  detailValue: { fontFamily: fonts.monoBold, fontSize: 18, color: colors.textPrimary },
  detailChange: { fontFamily: fonts.monoBold, fontSize: 14 },
  detailPct: { fontSize: 11 },
  detailDate: { fontFamily: fonts.mono, fontSize: 11, color: colors.textMuted },
  metadata: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' },
  metaText: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted },
  metaSep: { fontFamily: fonts.mono, fontSize: 10, color: colors.border, marginHorizontal: 6 },
  explainer: {
    fontFamily: fonts.mono, fontSize: 11, color: colors.textSecondary,
    lineHeight: 17, marginBottom: 10,
  },
  readingBlock: { marginBottom: 10 },
  readingLabel: { fontFamily: fonts.monoBold, fontSize: 10, color: colors.accent, marginBottom: 4 },
  readingText: { fontFamily: fonts.mono, fontSize: 11, color: '#cccccc', lineHeight: 17 },
  readingWarning: { color: '#FFFF00' },
  chartLoading: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted, marginBottom: 10 },
  relatedBlock: { marginBottom: 10 },
  relatedLabel: { fontFamily: fonts.monoBold, fontSize: 10, color: colors.accent, marginBottom: 6 },
  relatedRow: { paddingVertical: 6, borderTopWidth: 1, borderTopColor: colors.borderSubtle },
  relatedTop: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  relatedBadge: { borderWidth: 1, borderColor: colors.accent, paddingHorizontal: 4, paddingVertical: 0, marginRight: 6 },
  relatedBadgeText: { fontFamily: fonts.monoBold, fontSize: 8, color: colors.accent },
  relatedDate: { fontFamily: fonts.mono, fontSize: 9, color: colors.textMuted },
  relatedTitle: { fontFamily: fonts.mono, fontSize: 11, color: colors.textSecondary, lineHeight: 15 },
  externalLink: { fontFamily: fonts.mono, fontSize: 11, color: colors.cyan, marginBottom: 6 },
  invertedNote: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted, marginTop: 4 },
});
