import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, RefreshControl,
  Dimensions, StyleSheet,
} from 'react-native';
import Svg, { Polyline, Line, Text as SvgText } from 'react-native-svg';
import { colors, fonts } from '../../config/theme';
import { fetchSeriesHistory } from '../../lib/api';
import { padDomain } from '../../lib/chartUtils';
import type { Observation } from '../../lib/types';

type Status = 'loading' | 'ready' | 'error';

export default function BondChartsScreen() {
  const [refreshing, setRefreshing] = useState(false);
  const [key, setKey] = useState(0);

  const onRefresh = () => {
    setRefreshing(true);
    setKey(k => k + 1);
    setTimeout(() => setRefreshing(false), 500);
  };

  return (
    <ScrollView
      style={s.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.amber} colors={[colors.amber]} progressBackgroundColor={colors.surface} />}
    >
      <CreditConditionsSection key={`cc-${key}`} />
      <TermStructureSection key={`ts-${key}`} />
      <RealVsNominalSection key={`rn-${key}`} />
      <Text style={s.footerNote}>
        Charts use 3 years of FRED historical data. Pull down to refresh.
      </Text>
    </ScrollView>
  );
}

function CreditConditionsSection() {
  const [collapsed, setCollapsed] = useState(false);
  const [status, setStatus] = useState<Status>('loading');
  const [baa, setBaa] = useState<Observation[]>([]);
  const [aaa, setAaa] = useState<Observation[]>([]);

  useEffect(() => {
    Promise.all([fetchSeriesHistory('BAA10Y'), fetchSeriesHistory('AAA10Y')])
      .then(([b, a]) => {
        if (b.length < 2 || a.length < 2) { setStatus('error'); return; }
        setBaa(b); setAaa(a); setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, []);

  return (
    <ChartSection title="CREDIT CONDITIONS" collapsed={collapsed} onToggle={() => setCollapsed(c => !c)}>
      {status === 'loading' && <Text style={s.statusText}>LOADING CREDIT CONDITIONS...</Text>}
      {status === 'error' && <Text style={s.statusText}>CREDIT CONDITIONS UNAVAILABLE</Text>}
      {status === 'ready' && (
        <>
          <SingleAxisChart
            seriesA={baa} seriesB={aaa}
            colorA={colors.negative} colorB={colors.cyan}
            unit="%" decimals={2}
          />
          <Legend items={[{ color: colors.negative, label: 'BAA SPREAD' }, { color: colors.cyan, label: 'AAA SPREAD' }]} />
          <Text style={s.caption}>
            Corporate bond spreads measure the yield premium investors demand over Treasuries. The Baa-Treasury spread is the most-watched indicator of credit stress - widening spreads signal rising default risk and tightening financial conditions.
          </Text>
        </>
      )}
    </ChartSection>
  );
}

function TermStructureSection() {
  const [collapsed, setCollapsed] = useState(false);
  const [status, setStatus] = useState<Status>('loading');
  const [spread10y2y, setSpread10y2y] = useState<Observation[]>([]);
  const [spread10y3m, setSpread10y3m] = useState<Observation[]>([]);

  useEffect(() => {
    const compute10y2y = Promise.all([fetchSeriesHistory('DGS10'), fetchSeriesHistory('DGS2')]).then(([obs10, obs2]) => {
      const map2: Record<string, number> = {};
      for (const o of obs2) map2[o.date] = o.value;
      const result: Observation[] = [];
      for (const o of obs10) {
        if (map2[o.date] !== undefined) {
          result.push({ date: o.date, value: parseFloat((o.value - map2[o.date]).toFixed(2)) });
        }
      }
      return result;
    });

    Promise.all([compute10y2y, fetchSeriesHistory('T10Y3M')])
      .then(([s1, s2]) => {
        if (s1.length < 2 || s2.length < 2) { setStatus('error'); return; }
        setSpread10y2y(s1); setSpread10y3m(s2); setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, []);

  return (
    <ChartSection title="TERM STRUCTURE EVOLUTION" collapsed={collapsed} onToggle={() => setCollapsed(c => !c)}>
      {status === 'loading' && <Text style={s.statusText}>LOADING TERM STRUCTURE...</Text>}
      {status === 'error' && <Text style={s.statusText}>TERM STRUCTURE UNAVAILABLE</Text>}
      {status === 'ready' && (
        <>
          <SingleAxisChartWithZero
            seriesA={spread10y2y} seriesB={spread10y3m}
            colorA={colors.amber} colorB={colors.cyan}
            unit="%" decimals={2}
          />
          <Legend items={[{ color: colors.amber, label: '10Y-2Y SPREAD' }, { color: colors.cyan, label: '10Y-3M SPREAD' }]} />
          <Text style={s.caption}>
            The two most-watched recession indicators. The 10Y-3M spread has the strongest academic backing (SF Fed). The 10Y-2Y spread is more commonly cited on trading desks. When both invert simultaneously, the signal is strongest.
          </Text>
        </>
      )}
    </ChartSection>
  );
}

function RealVsNominalSection() {
  const [collapsed, setCollapsed] = useState(false);
  const [status, setStatus] = useState<Status>('loading');
  const [dgs10, setDgs10] = useState<Observation[]>([]);
  const [dfii10, setDfii10] = useState<Observation[]>([]);

  useEffect(() => {
    Promise.all([fetchSeriesHistory('DGS10'), fetchSeriesHistory('DFII10')])
      .then(([d, f]) => {
        if (d.length < 2 || f.length < 2) { setStatus('error'); return; }
        setDgs10(d); setDfii10(f); setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, []);

  return (
    <ChartSection title="REAL VS NOMINAL YIELDS" collapsed={collapsed} onToggle={() => setCollapsed(c => !c)}>
      {status === 'loading' && <Text style={s.statusText}>LOADING REAL VS NOMINAL...</Text>}
      {status === 'error' && <Text style={s.statusText}>REAL VS NOMINAL UNAVAILABLE</Text>}
      {status === 'ready' && (
        <>
          <SingleAxisChart
            seriesA={dgs10} seriesB={dfii10}
            colorA={colors.accent} colorB={colors.positive}
            unit="%" decimals={2}
          />
          <Legend items={[{ color: colors.accent, label: '10Y NOMINAL' }, { color: colors.positive, label: '10Y REAL (TIPS)' }]} />
          <Text style={s.caption}>
            The spread between the nominal 10-year yield and the real (TIPS) yield approximates the market's inflation expectation over the next decade. This is the bond market's inflation forecast.
          </Text>
        </>
      )}
    </ChartSection>
  );
}

function ChartSection({ title, collapsed, onToggle, children }: {
  title: string; collapsed: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <View style={s.section}>
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

function SingleAxisChart({ seriesA, seriesB, colorA, colorB, unit, decimals }: {
  seriesA: Observation[]; seriesB: Observation[];
  colorA: string; colorB: string;
  unit: string; decimals: number;
}) {
  const screenW = Dimensions.get('window').width - 24;
  const H = 180;
  const PAD_L = 42; const PAD_R = 8; const PAD_T = 8; const PAD_B = 22;
  const chartW = screenW - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  const { common, mapA, mapB } = buildCommonDates(seriesA, seriesB);
  if (common.length < 2) return null;

  const aVals = common.map(d => mapA[d]);
  const bVals = common.map(d => mapB[d]);
  const allVals = [...aVals, ...bVals];
  const dom = padDomain(Math.min(...allVals), Math.max(...allVals));

  const toX = (i: number) => PAD_L + (i / (common.length - 1)) * chartW;
  const toY = (v: number) => PAD_T + chartH - ((v - dom.min) / dom.range) * chartH;

  const lineA = common.map((_, i) => `${toX(i).toFixed(1)},${toY(aVals[i]).toFixed(1)}`).join(' ');
  const lineB = common.map((_, i) => `${toX(i).toFixed(1)},${toY(bVals[i]).toFixed(1)}`).join(' ');
  const dateLabels = makeDateLabels(common, toX);

  return (
    <View style={{ backgroundColor: '#000000' }}>
      <Svg width={screenW} height={H}>
        {[0, 0.25, 0.5, 0.75, 1].map(frac => (
          <Line key={frac} x1={PAD_L} y1={PAD_T + chartH * (1 - frac)} x2={screenW - PAD_R} y2={PAD_T + chartH * (1 - frac)} stroke="#1a1a1a" strokeWidth="1" />
        ))}
        <Polyline points={lineA} fill="none" stroke={colorA} strokeWidth="1.5" />
        <Polyline points={lineB} fill="none" stroke={colorB} strokeWidth="1.5" />
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

function SingleAxisChartWithZero({ seriesA, seriesB, colorA, colorB, unit, decimals }: {
  seriesA: Observation[]; seriesB: Observation[];
  colorA: string; colorB: string;
  unit: string; decimals: number;
}) {
  const screenW = Dimensions.get('window').width - 24;
  const H = 180;
  const PAD_L = 42; const PAD_R = 8; const PAD_T = 8; const PAD_B = 22;
  const chartW = screenW - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  const { common, mapA, mapB } = buildCommonDates(seriesA, seriesB);
  if (common.length < 2) return null;

  const aVals = common.map(d => mapA[d]);
  const bVals = common.map(d => mapB[d]);
  const allVals = [...aVals, ...bVals];
  const dom = padDomain(Math.min(...allVals), Math.max(...allVals));

  const toX = (i: number) => PAD_L + (i / (common.length - 1)) * chartW;
  const toY = (v: number) => PAD_T + chartH - ((v - dom.min) / dom.range) * chartH;

  const zeroY = toY(0);
  const zeroInView = dom.min <= 0 && dom.max >= 0;

  const lineA = common.map((_, i) => `${toX(i).toFixed(1)},${toY(aVals[i]).toFixed(1)}`).join(' ');
  const lineB = common.map((_, i) => `${toX(i).toFixed(1)},${toY(bVals[i]).toFixed(1)}`).join(' ');
  const dateLabels = makeDateLabels(common, toX);

  return (
    <View style={{ backgroundColor: '#000000' }}>
      <Svg width={screenW} height={H}>
        {[0, 0.25, 0.5, 0.75, 1].map(frac => (
          <Line key={frac} x1={PAD_L} y1={PAD_T + chartH * (1 - frac)} x2={screenW - PAD_R} y2={PAD_T + chartH * (1 - frac)} stroke="#1a1a1a" strokeWidth="1" />
        ))}
        {zeroInView && (
          <Line x1={PAD_L} y1={zeroY} x2={screenW - PAD_R} y2={zeroY} stroke="#555555" strokeWidth="1" strokeDasharray="4,3" />
        )}
        <Polyline points={lineA} fill="none" stroke={colorA} strokeWidth="1.5" />
        <Polyline points={lineB} fill="none" stroke={colorB} strokeWidth="1.5" />
        <SvgText x={PAD_L - 4} y={PAD_T + 3} textAnchor="end" fill="#666666" fontSize="9" fontFamily={fonts.mono!}>{dom.max.toFixed(decimals)}{unit}</SvgText>
        <SvgText x={PAD_L - 4} y={PAD_T + chartH / 2 + 3} textAnchor="end" fill="#666666" fontSize="9" fontFamily={fonts.mono!}>{((dom.max + dom.min) / 2).toFixed(decimals)}{unit}</SvgText>
        <SvgText x={PAD_L - 4} y={PAD_T + chartH + 3} textAnchor="end" fill="#666666" fontSize="9" fontFamily={fonts.mono!}>{dom.min.toFixed(decimals)}{unit}</SvgText>
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

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  section: { marginHorizontal: 12, marginTop: 10, marginBottom: 4 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 },
  sectionTitle: { fontFamily: fonts.monoBold, fontSize: 10, color: colors.accent },
  chevron: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted },
  statusText: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted, paddingVertical: 8 },
  legend: { flexDirection: 'row', gap: 16, marginTop: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  legendText: { fontFamily: fonts.mono, fontSize: 9, color: colors.textMuted },
  caption: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted, lineHeight: 15, marginTop: 6 },
  footerNote: { fontFamily: fonts.mono, fontSize: 9, color: colors.textMuted, textAlign: 'center', paddingVertical: 16, paddingHorizontal: 12 },
});
