import { useCallback, useEffect, useState, useMemo } from 'react';
import {
  View, Text, SectionList, TouchableOpacity, RefreshControl,
  StyleSheet, ActivityIndicator, Dimensions,
} from 'react-native';
import Svg, { Polyline, Line, Text as SvgText } from 'react-native-svg';
import { colors, fonts } from '../../config/theme';
import { BOND_YIELD_SERIES, BOND_MATURITY_LABELS, EXPLAINERS } from '../../config/series';
import { fetchBondYields, fetchSeriesHistory } from '../../lib/api';
import { formatValue, formatChange, directionColor, directionArrow } from '../../lib/format';
import type { Indicator, Observation } from '../../lib/types';

const CATEGORY_ORDER = ['Short-Term', 'Medium-Term', 'Long-Term'];

export default function BondYieldsScreen() {
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (force = false) => {
    try {
      const data = await fetchBondYields(force);
      setIndicators(data);
    } catch {}
  }, []);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(true);
    setRefreshing(false);
  }, [load]);

  const sections = useMemo(() => {
    const grouped: Record<string, Indicator[]> = {};
    for (const ind of indicators) {
      if (!grouped[ind.category]) grouped[ind.category] = [];
      grouped[ind.category].push(ind);
    }
    return CATEGORY_ORDER
      .filter(cat => grouped[cat])
      .map(cat => ({ title: cat.toUpperCase(), data: grouped[cat] }));
  }, [indicators]);

  if (loading) {
    return <View style={s.center}><ActivityIndicator color={colors.amber} /></View>;
  }

  return (
    <SectionList
      sections={sections}
      keyExtractor={item => item.series_id}
      style={s.list}
      stickySectionHeadersEnabled={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
          tintColor={colors.amber} colors={[colors.amber]} progressBackgroundColor={colors.surface} />
      }
      renderSectionHeader={({ section }) => (
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>{section.title}</Text>
        </View>
      )}
      renderItem={({ item }) => <YieldRow indicator={item} />}
    />
  );
}

function YieldRow({ indicator }: { indicator: Indicator }) {
  const [expanded, setExpanded] = useState(false);
  const sentiment = directionColor(indicator.direction, indicator.invert_sentiment);
  const arrow = directionArrow(indicator.direction);
  const changeColor = sentiment === 'positive' ? colors.positive
    : sentiment === 'negative' ? colors.negative : colors.textMuted;
  const label = BOND_MATURITY_LABELS[indicator.series_id] || indicator.series_id;

  return (
    <TouchableOpacity onPress={() => setExpanded(e => !e)} activeOpacity={0.7}
      style={[s.row, expanded && s.rowExpanded]}>
      <View style={s.rowMain}>
        <View style={s.rowLeft}>
          <Text style={s.maturityLabel}>{label}</Text>
          <Text style={s.name} numberOfLines={1}>{indicator.name}</Text>
        </View>
        {!expanded && <MiniSparkline seriesId={indicator.series_id} />}
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
      {expanded && <ExpandedDetail indicator={indicator} />}
    </TouchableOpacity>
  );
}

function MiniSparkline({ seriesId }: { seriesId: string }) {
  const [data, setData] = useState<Observation[]>([]);
  useEffect(() => {
    fetchSeriesHistory(seriesId).then(obs => setData(obs.slice(-60)));
  }, [seriesId]);

  if (data.length < 2) return <View style={s.sparkPlaceholder} />;

  const W = 60;
  const H = 24;
  const vals = data.map(d => d.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;

  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * W;
    const y = H - ((d.value - min) / range) * H;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  return (
    <View style={s.sparkContainer}>
      <Svg width={W} height={H}>
        <Polyline points={pts} fill="none" stroke={colors.accent} strokeWidth="1" />
      </Svg>
    </View>
  );
}

function ExpandedDetail({ indicator }: { indicator: Indicator }) {
  const [history, setHistory] = useState<Observation[]>([]);
  const [loaded, setLoaded] = useState(false);
  const explainer = EXPLAINERS[indicator.series_id];

  useEffect(() => {
    fetchSeriesHistory(indicator.series_id)
      .then(obs => { setHistory(obs); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, [indicator.series_id]);

  const sentiment = directionColor(indicator.direction, indicator.invert_sentiment);
  const arrow = directionArrow(indicator.direction);
  const changeColor = sentiment === 'positive' ? colors.positive
    : sentiment === 'negative' ? colors.negative : colors.textMuted;

  return (
    <View style={s.detail}>
      <View style={s.detailHeader}>
        <Text style={s.detailValue}>{formatValue(indicator.value, indicator.unit)}</Text>
        <Text style={[s.detailChange, { color: changeColor }]}>
          {indicator.change !== null ? `${arrow} ${formatChange(indicator.change, indicator.unit)}` : '--'}
        </Text>
      </View>
      {explainer && <Text style={s.explainer}>{explainer}</Text>}
      {loaded && history.length >= 2 && <HistoryChart observations={history} />}
    </View>
  );
}

function HistoryChart({ observations }: { observations: Observation[] }) {
  const screenW = Dimensions.get('window').width - 24;
  const H = 120;
  const PAD_L = 40;
  const PAD_R = 8;
  const PAD_T = 8;
  const PAD_B = 22;
  const chartW = screenW - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  const vals = observations.map(o => o.value);
  const minVal = Math.min(...vals);
  const maxVal = Math.max(...vals);
  const range = maxVal - minVal || 1;
  const pad = range * 0.1;

  const toX = (i: number) => PAD_L + (i / (observations.length - 1)) * chartW;
  const toY = (v: number) => PAD_T + chartH - ((v - (minVal - pad)) / (range + pad * 2)) * chartH;

  const pts = observations.map((o, i) => `${toX(i).toFixed(1)},${toY(o.value).toFixed(1)}`).join(' ');

  const labelCount = 4;
  const dateLabels: { label: string; x: number }[] = [];
  for (let i = 0; i < labelCount; i++) {
    const idx = Math.round((i / (labelCount - 1)) * (observations.length - 1));
    const d = new Date(observations[idx].date);
    dateLabels.push({
      label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      x: toX(idx),
    });
  }

  return (
    <View style={{ backgroundColor: '#000000', marginTop: 8 }}>
      <Svg width={screenW} height={H}>
        {[0, 0.5, 1].map(frac => (
          <Line key={frac} x1={PAD_L} y1={PAD_T + chartH * (1 - frac)} x2={screenW - PAD_R} y2={PAD_T + chartH * (1 - frac)} stroke="#1a1a1a" strokeWidth="1" />
        ))}
        <Polyline points={pts} fill="none" stroke={colors.accent} strokeWidth="1.5" />
        <SvgText x={PAD_L - 4} y={PAD_T + 3} textAnchor="end" fill="#666666" fontSize="9" fontFamily={fonts.mono!}>{(maxVal + pad).toFixed(2)}%</SvgText>
        <SvgText x={PAD_L - 4} y={PAD_T + chartH + 3} textAnchor="end" fill="#666666" fontSize="9" fontFamily={fonts.mono!}>{(minVal - pad).toFixed(2)}%</SvgText>
        {dateLabels.map((dl, i) => (
          <SvgText key={i} x={dl.x} y={H - 4} textAnchor={i === 0 ? 'start' : i === dateLabels.length - 1 ? 'end' : 'middle'} fill="#666666" fontSize="9" fontFamily={fonts.mono!}>{dl.label}</SvgText>
        ))}
      </Svg>
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface },
  list: { flex: 1, backgroundColor: colors.surface },
  sectionHeader: {
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: colors.surfaceAlt, borderTopWidth: 1, borderTopColor: colors.border,
  },
  sectionTitle: { fontFamily: fonts.monoBold, fontSize: 11, color: colors.accent },
  row: { borderBottomWidth: 1, borderBottomColor: colors.borderSubtle, paddingHorizontal: 12, paddingVertical: 8 },
  rowExpanded: { backgroundColor: colors.hoverRow },
  rowMain: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowLeft: { width: 80 },
  maturityLabel: { fontFamily: fonts.monoBold, fontSize: 14, color: colors.textPrimary },
  name: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted, marginTop: 1 },
  rowRight: { alignItems: 'flex-end' },
  value: { fontFamily: fonts.monoBold, fontSize: 13, color: colors.textPrimary },
  change: { fontFamily: fonts.monoBold, fontSize: 11, marginTop: 2 },
  sparkContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', marginHorizontal: 8 },
  sparkPlaceholder: { flex: 1, height: 24, marginHorizontal: 8 },
  detail: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  detailHeader: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 8 },
  detailValue: { fontFamily: fonts.monoBold, fontSize: 18, color: colors.textPrimary },
  detailChange: { fontFamily: fonts.monoBold, fontSize: 14 },
  explainer: {
    fontFamily: fonts.mono, fontSize: 11, color: colors.textSecondary,
    lineHeight: 17, marginBottom: 10,
  },
});
