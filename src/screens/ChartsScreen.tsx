import { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl,
  Dimensions, StyleSheet,
} from 'react-native';
import Svg, { Polyline, Line, Text as SvgText } from 'react-native-svg';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { MaterialTopTabNavigationProp } from '@react-navigation/material-top-tabs';
import { colors, fonts } from '../config/theme';
import { CHART_SERIES } from '../config/series';
import { fetchSeriesHistory, fetchYieldCurveHistory } from '../lib/api';
import type { RootTabParamList } from '../lib/navigation';
import type { Observation, YieldCurvePoint } from '../lib/types';
import { padDomain } from '../lib/chartUtils';

type Status = 'loading' | 'ready' | 'error';

const CHART_IDS = ['macro-pulse', 'inflation-policy', 'rates-transmission', 'yield-curve'] as const;

export default function ChartsScreen() {
  const route = useRoute<RouteProp<RootTabParamList, 'Charts'>>();
  const scrollRef = useRef<ScrollView>(null);
  const layoutMap = useRef<Record<string, number>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [key, setKey] = useState(0);
  const [expandOverrides, setExpandOverrides] = useState<Record<string, boolean>>({});
  const [pendingScroll, setPendingScroll] = useState<string | null>(null);

  useEffect(() => {
    const target = route.params?.scrollTo;
    if (target) {
      setExpandOverrides(prev => ({ ...prev, [target]: true }));
      setPendingScroll(target);
    }
  }, [route.params?.scrollTo]);

  useEffect(() => {
    if (pendingScroll && layoutMap.current[pendingScroll] !== undefined) {
      const y = layoutMap.current[pendingScroll];
      setTimeout(() => scrollRef.current?.scrollTo({ y, animated: true }), 100);
      setPendingScroll(null);
    }
  }, [pendingScroll, layoutMap.current]);

  const onSectionLayout = useCallback((id: string, y: number) => {
    layoutMap.current[id] = y;
    if (pendingScroll === id) {
      setTimeout(() => scrollRef.current?.scrollTo({ y, animated: true }), 100);
      setPendingScroll(null);
    }
  }, [pendingScroll]);

  const onRefresh = () => {
    console.log('[ChartsScreen] onRefresh fired');
    setRefreshing(true);
    setKey(k => k + 1);
    setTimeout(() => setRefreshing(false), 500);
  };

  return (
    <ScrollView
      ref={scrollRef}
      style={s.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.amber} colors={[colors.amber]} progressBackgroundColor={colors.surface} />}
    >
      <MacroPulseSection key={`mp-${key}`} forceExpand={expandOverrides['macro-pulse']} onLayout={y => onSectionLayout('macro-pulse', y)} />
      <InflationPolicySection key={`ip-${key}`} forceExpand={expandOverrides['inflation-policy']} onLayout={y => onSectionLayout('inflation-policy', y)} />
      <RatesTransmissionSection key={`rt-${key}`} forceExpand={expandOverrides['rates-transmission']} onLayout={y => onSectionLayout('rates-transmission', y)} />
      <YieldCurveSection key={`yc-${key}`} forceExpand={expandOverrides['yield-curve']} onLayout={y => onSectionLayout('yield-curve', y)} />
      <Text style={s.footerNote}>
        Charts use 3-5 years of FRED historical data. Pull down to refresh.
      </Text>
    </ScrollView>
  );
}

/* ────── A. MACRO PULSE ────── */

function MacroPulseSection({ forceExpand, onLayout }: { forceExpand?: boolean; onLayout: (y: number) => void }) {
  const [collapsed, setCollapsed] = useState(false);
  const [status, setStatus] = useState<Status>('loading');
  const [unrate, setUnrate] = useState<Observation[]>([]);
  const [fed, setFed] = useState<Observation[]>([]);

  useEffect(() => { if (forceExpand) setCollapsed(false); }, [forceExpand]);

  useEffect(() => {
    Promise.all([fetchSeriesHistory('UNRATE'), fetchSeriesHistory('FEDFUNDS')])
      .then(([u, f]) => {
        if (u.length < 2 || f.length < 2) { setStatus('error'); return; }
        setUnrate(u); setFed(f); setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, []);

  return (
    <ChartSection title="MACRO PULSE" chartId="macro-pulse" collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} onLayout={onLayout}>
      {status === 'loading' && <Text style={s.statusText}>LOADING MACRO PULSE...</Text>}
      {status === 'error' && <Text style={s.statusText}>MACRO PULSE UNAVAILABLE</Text>}
      {status === 'ready' && (
        <>
          <DualAxisChart
            seriesA={unrate} seriesB={fed}
            colorA={colors.negative} colorB={colors.cyan}
            labelA="%" labelB="%"
            decimalsA={1} decimalsB={2}
          />
          <Legend items={[{ color: colors.negative, label: 'UNEMPLOYMENT' }, { color: colors.cyan, label: 'FED FUNDS' }]} />
          <Text style={s.caption}>
            Visualizes the Fed's dual mandate in action. The Fed targets maximum employment and stable prices - when unemployment rises, the FOMC typically eases policy; when the labor market tightens, it leans restrictive. This is the core dynamic behind the Taylor Rule.
          </Text>
          <IndicatorBadges chartId="macro-pulse" />
        </>
      )}
    </ChartSection>
  );
}

/* ────── B. INFLATION VS POLICY ────── */

function computeYoy(raw: Observation[]): Observation[] {
  const sorted = [...raw].sort((a, b) => a.date.localeCompare(b.date));
  const yoy: Observation[] = [];
  for (let i = 12; i < sorted.length; i++) {
    const current = sorted[i];
    const yearAgo = sorted[i - 12];
    if (yearAgo.value > 0) {
      yoy.push({
        date: current.date,
        value: parseFloat(((current.value / yearAgo.value - 1) * 100).toFixed(2)),
      });
    }
  }
  return yoy;
}

function InflationPolicySection({ forceExpand, onLayout }: { forceExpand?: boolean; onLayout: (y: number) => void }) {
  const [collapsed, setCollapsed] = useState(false);
  const [status, setStatus] = useState<Status>('loading');
  const [cpiYoy, setCpiYoy] = useState<Observation[]>([]);
  const [pceYoy, setPceYoy] = useState<Observation[]>([]);
  const [fed, setFed] = useState<Observation[]>([]);

  useEffect(() => { if (forceExpand) setCollapsed(false); }, [forceExpand]);

  useEffect(() => {
    Promise.all([fetchSeriesHistory('CPIAUCSL'), fetchSeriesHistory('PCEPI'), fetchSeriesHistory('FEDFUNDS')])
      .then(([cpiRaw, pceRaw, f]) => {
        if (cpiRaw.length < 13 || pceRaw.length < 13 || f.length < 2) { setStatus('error'); return; }
        setCpiYoy(computeYoy(cpiRaw));
        setPceYoy(computeYoy(pceRaw));
        setFed(f);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, []);

  return (
    <ChartSection title="INFLATION VS FED POLICY" chartId="inflation-policy" collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} onLayout={onLayout}>
      {status === 'loading' && <Text style={s.statusText}>LOADING INFLATION VS POLICY...</Text>}
      {status === 'error' && <Text style={s.statusText}>INFLATION VS POLICY UNAVAILABLE</Text>}
      {status === 'ready' && (
        <>
          <SingleAxisChart
            seriesA={cpiYoy} seriesB={fed} seriesC={pceYoy}
            colorA={colors.negative} colorB={colors.cyan} colorC="#CCCC00"
            unit="%" decimals={1}
          />
          <Legend items={[{ color: colors.negative, label: 'CPI YOY%' }, { color: '#CCCC00', label: 'PCE YOY%' }, { color: colors.cyan, label: 'FED FUNDS' }]} />
          <Text style={s.caption}>
            CPI and PCE measure realized inflation; the fed funds rate is the Fed's primary tool to control it. When the real rate (fed funds minus inflation) is positive, policy is restrictive. When negative, policy is accommodative. The Fed targets 2% PCE inflation.
          </Text>
          <IndicatorBadges chartId="inflation-policy" />
        </>
      )}
    </ChartSection>
  );
}

/* ────── C. RATES TRANSMISSION ────── */

function RatesTransmissionSection({ forceExpand, onLayout }: { forceExpand?: boolean; onLayout: (y: number) => void }) {
  const [collapsed, setCollapsed] = useState(false);
  const [status, setStatus] = useState<Status>('loading');
  const [dgs10, setDgs10] = useState<Observation[]>([]);
  const [mortgage, setMortgage] = useState<Observation[]>([]);

  useEffect(() => { if (forceExpand) setCollapsed(false); }, [forceExpand]);

  useEffect(() => {
    Promise.all([fetchSeriesHistory('DGS10'), fetchSeriesHistory('MORTGAGE30US')])
      .then(([d, m]) => {
        if (d.length < 2 || m.length < 2) { setStatus('error'); return; }
        setDgs10(d); setMortgage(m); setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, []);

  return (
    <ChartSection title="RATES TRANSMISSION" chartId="rates-transmission" collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} onLayout={onLayout}>
      {status === 'loading' && <Text style={s.statusText}>LOADING RATES TRANSMISSION...</Text>}
      {status === 'error' && <Text style={s.statusText}>RATES TRANSMISSION UNAVAILABLE</Text>}
      {status === 'ready' && (
        <>
          <SingleAxisChart
            seriesA={dgs10} seriesB={mortgage}
            colorA={colors.cyan} colorB={colors.amber}
            unit="%" decimals={2}
          />
          <Legend items={[{ color: colors.cyan, label: '10Y TREASURY' }, { color: colors.amber, label: '30Y MORTGAGE' }]} />
          <Text style={s.caption}>
            The spread between the 10-year Treasury yield and the 30-year mortgage rate reflects credit risk and liquidity premiums in the mortgage market. A widening spread signals tighter lending conditions; a narrowing spread signals easing. This is a key channel of monetary policy transmission to the real economy.
          </Text>
          <IndicatorBadges chartId="rates-transmission" />
        </>
      )}
    </ChartSection>
  );
}

/* ────── D. YIELD CURVE SPREAD ────── */

function YieldCurveSection({ forceExpand, onLayout }: { forceExpand?: boolean; onLayout: (y: number) => void }) {
  const [collapsed, setCollapsed] = useState(false);
  const [status, setStatus] = useState<Status>('loading');
  const [data, setData] = useState<YieldCurvePoint[]>([]);

  useEffect(() => { if (forceExpand) setCollapsed(false); }, [forceExpand]);

  useEffect(() => {
    fetchYieldCurveHistory()
      .then(d => { setData(d); setStatus(d.length >= 2 ? 'ready' : 'error'); })
      .catch(() => setStatus('error'));
  }, []);

  return (
    <ChartSection title="YIELD CURVE SPREAD (10Y - 2Y)" chartId="yield-curve" collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} onLayout={onLayout}>
      {status === 'loading' && <Text style={s.statusText}>LOADING YIELD CURVE...</Text>}
      {status === 'error' && <Text style={s.statusText}>YIELD CURVE UNAVAILABLE</Text>}
      {status === 'ready' && (
        <>
          <YieldCurveChart data={data} />
          <Text style={s.caption}>
            Negative values (red) indicate yield curve inversion. Nearly every U.S. recession since 1955 has been preceded by an inversion of the 2Y/10Y spread, though the lead time varies from 6 to 24 months.
          </Text>
          <IndicatorBadges chartId="yield-curve" />
        </>
      )}
    </ChartSection>
  );
}

/* ────── SHARED COMPONENTS ────── */

function ChartSection({ title, chartId, collapsed, onToggle, onLayout, children }: {
  title: string; chartId: string; collapsed: boolean; onToggle: () => void; onLayout: (y: number) => void; children: React.ReactNode;
}) {
  return (
    <View
      style={s.section}
      onLayout={e => onLayout(e.nativeEvent.layout.y)}
    >
      <TouchableOpacity onPress={onToggle} activeOpacity={0.7} style={s.sectionHeader}>
        <Text style={s.sectionTitle}>{title}</Text>
        <Text style={s.chevron}>{collapsed ? '▶' : '▼'}</Text>
      </TouchableOpacity>
      {!collapsed && children}
    </View>
  );
}

function Legend({ items }: { items: { color: string; label: string }[] }) {
  return (
    <View style={s.legend}>
      {items.map(item => (
        <View key={item.label} style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: item.color }]} />
          <Text style={s.legendText}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}

function IndicatorBadges({ chartId }: { chartId: string }) {
  const nav = useNavigation<MaterialTopTabNavigationProp<RootTabParamList>>();
  const seriesIds = CHART_SERIES[chartId] || [];
  if (seriesIds.length === 0) return null;

  return (
    <View style={s.badgeRow}>
      {seriesIds.map(id => (
        <TouchableOpacity
          key={id}
          onPress={() => nav.navigate('Indicators', { expandedSeriesId: id })}
          style={s.badge}
          activeOpacity={0.7}
        >
          <Text style={s.badgeText}>{id}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function buildCommonDates(a: Observation[], b: Observation[]) {
  const mapA: Record<string, number> = {};
  for (const o of a) mapA[o.date] = o.value;
  const mapB: Record<string, number> = {};
  for (const o of b) mapB[o.date] = o.value;
  const allDates = [...new Set([...a.map(o => o.date), ...b.map(o => o.date)])].sort();
  const common = allDates.filter(d => mapA[d] !== undefined && mapB[d] !== undefined);
  return { common, mapA, mapB };
}

function makeDateLabels(dates: string[], toX: (i: number) => number, count = 5) {
  const labels: { label: string; x: number }[] = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.round((i / (count - 1)) * (dates.length - 1));
    const d = new Date(dates[idx]);
    labels.push({
      label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      x: toX(idx),
    });
  }
  return labels;
}

/* Dual Y-axis chart (different scales left/right) */
function DualAxisChart({ seriesA, seriesB, colorA, colorB, labelA, labelB, decimalsA, decimalsB }: {
  seriesA: Observation[]; seriesB: Observation[];
  colorA: string; colorB: string;
  labelA: string; labelB: string;
  decimalsA: number; decimalsB: number;
}) {
  const screenW = Dimensions.get('window').width - 24;
  const H = 180;
  const PAD_L = 42; const PAD_R = 42; const PAD_T = 8; const PAD_B = 22;
  const chartW = screenW - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  const { common, mapA, mapB } = buildCommonDates(seriesA, seriesB);
  if (common.length < 2) return null;

  const aVals = common.map(d => mapA[d]);
  const bVals = common.map(d => mapB[d]);
  const aMin = Math.min(...aVals); const aMax = Math.max(...aVals);
  const bMin = Math.min(...bVals); const bMax = Math.max(...bVals);
  const aDom = padDomain(aMin, aMax);
  const bDom = padDomain(bMin, bMax);

  const toX = (i: number) => PAD_L + (i / (common.length - 1)) * chartW;
  const toYA = (v: number) => PAD_T + chartH - ((v - aDom.min) / aDom.range) * chartH;
  const toYB = (v: number) => PAD_T + chartH - ((v - bDom.min) / bDom.range) * chartH;

  const lineA = common.map((_, i) => `${toX(i).toFixed(1)},${toYA(aVals[i]).toFixed(1)}`).join(' ');
  const lineB = common.map((_, i) => `${toX(i).toFixed(1)},${toYB(bVals[i]).toFixed(1)}`).join(' ');
  const dateLabels = makeDateLabels(common, toX);

  return (
    <View style={{ backgroundColor: '#000000' }}>
      <Svg width={screenW} height={H}>
        {[0, 0.25, 0.5, 0.75, 1].map(frac => (
          <Line key={frac} x1={PAD_L} y1={PAD_T + chartH * (1 - frac)} x2={screenW - PAD_R} y2={PAD_T + chartH * (1 - frac)} stroke="#1a1a1a" strokeWidth="1" />
        ))}
        <Polyline points={lineA} fill="none" stroke={colorA} strokeWidth="1.5" />
        <Polyline points={lineB} fill="none" stroke={colorB} strokeWidth="1.5" />
        <SvgText x={PAD_L - 4} y={PAD_T + 3} textAnchor="end" fill={colorA} fontSize="9" fontFamily={fonts.mono!}>{aDom.max.toFixed(decimalsA)}{labelA}</SvgText>
        <SvgText x={PAD_L - 4} y={PAD_T + chartH + 3} textAnchor="end" fill={colorA} fontSize="9" fontFamily={fonts.mono!}>{aDom.min.toFixed(decimalsA)}{labelA}</SvgText>
        <SvgText x={screenW - PAD_R + 4} y={PAD_T + 3} textAnchor="start" fill={colorB} fontSize="9" fontFamily={fonts.mono!}>{bDom.max.toFixed(decimalsB)}{labelB}</SvgText>
        <SvgText x={screenW - PAD_R + 4} y={PAD_T + chartH + 3} textAnchor="start" fill={colorB} fontSize="9" fontFamily={fonts.mono!}>{bDom.min.toFixed(decimalsB)}{labelB}</SvgText>
        {dateLabels.map((dl, i) => (
          <SvgText key={i} x={dl.x} y={H - 4} textAnchor={i === 0 ? 'start' : i === dateLabels.length - 1 ? 'end' : 'middle'} fill="#666666" fontSize="9" fontFamily={fonts.mono!}>{dl.label}</SvgText>
        ))}
      </Svg>
    </View>
  );
}

/* Single Y-axis chart (same scale, optional third series) */
function SingleAxisChart({ seriesA, seriesB, seriesC, colorA, colorB, colorC, unit, decimals }: {
  seriesA: Observation[]; seriesB: Observation[];
  seriesC?: Observation[];
  colorA: string; colorB: string; colorC?: string;
  unit: string; decimals: number;
}) {
  const screenW = Dimensions.get('window').width - 24;
  const H = 180;
  const PAD_L = 42; const PAD_R = 8; const PAD_T = 8; const PAD_B = 22;
  const chartW = screenW - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  const { common, mapA, mapB } = buildCommonDates(seriesA, seriesB);
  const mapC: Record<string, number> = {};
  if (seriesC) for (const o of seriesC) mapC[o.date] = o.value;
  const filtered = seriesC ? common.filter(d => mapC[d] !== undefined) : common;
  if (filtered.length < 2) return null;

  const aVals = filtered.map(d => mapA[d]);
  const bVals = filtered.map(d => mapB[d]);
  const cVals = seriesC ? filtered.map(d => mapC[d]) : [];
  const allVals = [...aVals, ...bVals, ...cVals];
  const minVal = Math.min(...allVals); const maxVal = Math.max(...allVals);
  const dom = padDomain(minVal, maxVal);

  const toX = (i: number) => PAD_L + (i / (filtered.length - 1)) * chartW;
  const toY = (v: number) => PAD_T + chartH - ((v - dom.min) / dom.range) * chartH;

  const lineA = filtered.map((_, i) => `${toX(i).toFixed(1)},${toY(aVals[i]).toFixed(1)}`).join(' ');
  const lineB = filtered.map((_, i) => `${toX(i).toFixed(1)},${toY(bVals[i]).toFixed(1)}`).join(' ');
  const lineC = seriesC ? filtered.map((_, i) => `${toX(i).toFixed(1)},${toY(cVals[i]).toFixed(1)}`).join(' ') : null;
  const dateLabels = makeDateLabels(filtered, toX);

  return (
    <View style={{ backgroundColor: '#000000' }}>
      <Svg width={screenW} height={H}>
        {[0, 0.25, 0.5, 0.75, 1].map(frac => (
          <Line key={frac} x1={PAD_L} y1={PAD_T + chartH * (1 - frac)} x2={screenW - PAD_R} y2={PAD_T + chartH * (1 - frac)} stroke="#1a1a1a" strokeWidth="1" />
        ))}
        <Polyline points={lineA} fill="none" stroke={colorA} strokeWidth="1.5" />
        <Polyline points={lineB} fill="none" stroke={colorB} strokeWidth="1.5" />
        {lineC && colorC && <Polyline points={lineC} fill="none" stroke={colorC} strokeWidth="1.5" />}
        <SvgText x={PAD_L - 4} y={PAD_T + 3} textAnchor="end" fill="#666666" fontSize="9" fontFamily={fonts.mono!}>{dom.max.toFixed(decimals)}{unit}</SvgText>
        <SvgText x={PAD_L - 4} y={PAD_T + chartH / 2 + 3} textAnchor="end" fill="#666666" fontSize="9" fontFamily={fonts.mono!}>{((dom.max + dom.min) / 2).toFixed(decimals)}{unit}</SvgText>
        <SvgText x={PAD_L - 4} y={PAD_T + chartH + 3} textAnchor="end" fill="#666666" fontSize="9" fontFamily={fonts.mono!}>{dom.min.toFixed(decimals)}{unit}</SvgText>
        {dateLabels.map((dl, i) => (
          <SvgText key={i} x={dl.x} y={H - 4} textAnchor={i === 0 ? 'start' : i === dateLabels.length - 1 ? 'end' : 'middle'} fill="#666666" fontSize="9" fontFamily={fonts.mono!}>{dl.label}</SvgText>
        ))}
      </Svg>
    </View>
  );
}

/* Yield curve area chart */
function YieldCurveChart({ data }: { data: YieldCurvePoint[] }) {
  const screenW = Dimensions.get('window').width - 24;
  const H = 180;
  const PAD_L = 40; const PAD_R = 8; const PAD_T = 8; const PAD_B = 22;
  const chartW = screenW - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  const spreads = data.map(d => d.spread);
  const minVal = Math.min(...spreads);
  const maxVal = Math.max(...spreads);
  const dom = padDomain(minVal, maxVal);

  const toX = (i: number) => PAD_L + (i / (data.length - 1)) * chartW;
  const toY = (v: number) => PAD_T + chartH - ((v - dom.min) / dom.range) * chartH;
  const zeroY = toY(0);
  const zeroInView = minVal <= 0 && maxVal >= 0;

  const linePoints = data.map((d, i) => `${toX(i).toFixed(1)},${toY(d.spread).toFixed(1)}`).join(' ');

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

  const dateLabels = makeDateLabels(data.map(d => d.date), toX);
  const fmtY = (v: number) => v.toFixed(1);

  return (
    <View style={{ backgroundColor: '#000000' }}>
      <Svg width={screenW} height={H}>
        {segments.map((seg, i) => (
          <Polyline key={i} points={seg.points} fill={seg.isPositive ? 'rgba(51, 255, 51, 0.10)' : 'rgba(255, 51, 51, 0.10)'} stroke="none" />
        ))}
        {[0, 0.25, 0.5, 0.75, 1].map(frac => (
          <Line key={frac} x1={PAD_L} y1={PAD_T + chartH * (1 - frac)} x2={screenW - PAD_R} y2={PAD_T + chartH * (1 - frac)} stroke="#1a1a1a" strokeWidth="1" />
        ))}
        {zeroInView && (
          <Line x1={PAD_L} y1={zeroY} x2={screenW - PAD_R} y2={zeroY} stroke="#555555" strokeWidth="1" strokeDasharray="4,3" />
        )}
        <Polyline points={linePoints} fill="none" stroke={colors.amber} strokeWidth="1.5" />
        {[dom.max, (dom.max + dom.min) / 2, dom.min].map((val, i) => (
          <SvgText key={i} x={PAD_L - 4} y={PAD_T + (i * chartH / 2) + 3} textAnchor="end" fill="#666666" fontSize="9" fontFamily={fonts.mono!}>{fmtY(val)}</SvgText>
        ))}
        {zeroInView && (
          <SvgText x={PAD_L - 4} y={zeroY + 3} textAnchor="end" fill="#999999" fontSize="9" fontFamily={fonts.mono!}>0.0</SvgText>
        )}
        {dateLabels.map((dl, i) => (
          <SvgText key={i} x={dl.x} y={H - 4} textAnchor={i === 0 ? 'start' : i === dateLabels.length - 1 ? 'end' : 'middle'} fill="#666666" fontSize="9" fontFamily={fonts.mono!}>{dl.label}</SvgText>
        ))}
      </Svg>
    </View>
  );
}

/* ────── STYLES ────── */

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  section: {
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  sectionTitle: {
    fontFamily: fonts.monoBold,
    fontSize: 10,
    color: colors.accent,
  },
  chevron: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
  },
  statusText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
    paddingVertical: 8,
  },
  legend: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 6,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendText: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.textMuted,
  },
  caption: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
    lineHeight: 15,
    marginTop: 6,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  badge: {
    borderWidth: 1,
    borderColor: colors.accent,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    fontFamily: fonts.monoBold,
    fontSize: 8,
    color: colors.accent,
  },
  footerNote: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
});
