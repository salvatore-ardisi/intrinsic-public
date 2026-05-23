import { useCallback, useEffect, useState, useMemo } from 'react';
import {
  View, Text, SectionList, TouchableOpacity, RefreshControl,
  StyleSheet, ActivityIndicator, Dimensions,
} from 'react-native';
import Svg, { Polyline, Line, Text as SvgText } from 'react-native-svg';
import { colors, fonts } from '../../config/theme';
import { EXPLAINERS } from '../../config/series';
import { fetchBondSpreads, fetchSeriesHistory } from '../../lib/api';
import { formatValue, formatChange, directionColor, directionArrow } from '../../lib/format';
import type { Indicator, Observation } from '../../lib/types';

const SPREAD_CATEGORIES: Record<string, string> = {
  YIELD_SPREAD: 'Term Spreads',
  T10Y3M: 'Term Spreads',
  BAA10Y: 'Credit Spreads',
  AAA10Y: 'Credit Spreads',
  MORTGAGE_SPREAD: 'Credit Spreads',
  DFII10: 'Real Yields',
};

const CATEGORY_ORDER = ['Term Spreads', 'Credit Spreads', 'Real Yields'];

export default function BondSpreadsScreen() {
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    try {
      const data = await fetchBondSpreads(force);
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
      const cat = SPREAD_CATEGORIES[ind.series_id] || ind.category;
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(ind);
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
      renderItem={({ item }) => (
        <SpreadRow
          indicator={item}
          isExpanded={expanded === item.series_id}
          onPress={() => setExpanded(prev => prev === item.series_id ? null : item.series_id)}
        />
      )}
    />
  );
}

function SpreadRow({ indicator, isExpanded, onPress }: {
  indicator: Indicator; isExpanded: boolean; onPress: () => void;
}) {
  const sentiment = directionColor(indicator.direction, indicator.invert_sentiment);
  const arrow = directionArrow(indicator.direction);
  const changeColor = sentiment === 'positive' ? colors.positive
    : sentiment === 'negative' ? colors.negative : colors.textMuted;

  const isInversion = (indicator.series_id === 'YIELD_SPREAD' || indicator.series_id === 'T10Y3M')
    && indicator.value !== null && indicator.value < 0;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}
      style={[s.row, isExpanded && s.rowExpanded]}>
      <View style={s.rowMain}>
        <View style={s.rowLeft}>
          <Text style={s.seriesId}>{indicator.series_id}</Text>
          <Text style={s.name} numberOfLines={1}>{indicator.name}</Text>
        </View>
        <View style={s.rowRight}>
          <Text style={[s.value, isInversion && s.inversionValue]}>
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
      {isInversion && (
        <Text style={s.inversionBadge}>INVERTED</Text>
      )}
      {isExpanded && <SpreadDetail indicator={indicator} />}
    </TouchableOpacity>
  );
}

function SpreadDetail({ indicator }: { indicator: Indicator }) {
  const [history, setHistory] = useState<Observation[]>([]);
  const [loaded, setLoaded] = useState(false);
  const explainer = EXPLAINERS[indicator.series_id];
  const isComputed = indicator.source === 'COMPUTED';

  useEffect(() => {
    if (indicator.series_id === 'YIELD_SPREAD') {
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
        setLoaded(true);
      });
    } else if (indicator.series_id === 'MORTGAGE_SPREAD') {
      Promise.all([fetchSeriesHistory('MORTGAGE30US'), fetchSeriesHistory('DGS10')]).then(([obsM, obs10]) => {
        const map10: Record<string, number> = {};
        for (const o of obs10) map10[o.date] = o.value;
        const spreadObs: Observation[] = [];
        for (const o of obsM) {
          if (map10[o.date] !== undefined) {
            spreadObs.push({ date: o.date, value: parseFloat((o.value - map10[o.date]).toFixed(2)) });
          }
        }
        setHistory(spreadObs);
        setLoaded(true);
      });
    } else {
      fetchSeriesHistory(indicator.series_id)
        .then(obs => { setHistory(obs); setLoaded(true); })
        .catch(() => setLoaded(true));
    }
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
      {indicator.invert_sentiment && (
        <Text style={s.invertedNote}>INVERTED SENTIMENT - increase is negative for markets</Text>
      )}
      {loaded && history.length >= 2 && <SpreadChart observations={history} hasZeroLine={
        indicator.series_id === 'YIELD_SPREAD' || indicator.series_id === 'T10Y3M'
      } />}
    </View>
  );
}

function SpreadChart({ observations, hasZeroLine }: { observations: Observation[]; hasZeroLine: boolean }) {
  const screenW = Dimensions.get('window').width - 24;
  const H = 130;
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
  const domMin = minVal - pad;
  const domMax = maxVal + pad;
  const domRange = domMax - domMin;

  const toX = (i: number) => PAD_L + (i / (observations.length - 1)) * chartW;
  const toY = (v: number) => PAD_T + chartH - ((v - domMin) / domRange) * chartH;

  const zeroY = toY(0);
  const zeroInView = hasZeroLine && domMin <= 0 && domMax >= 0;

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
        {zeroInView && (
          <Line x1={PAD_L} y1={zeroY} x2={screenW - PAD_R} y2={zeroY} stroke="#555555" strokeWidth="1" strokeDasharray="4,3" />
        )}
        <Polyline points={pts} fill="none" stroke={colors.amber} strokeWidth="1.5" />
        <SvgText x={PAD_L - 4} y={PAD_T + 3} textAnchor="end" fill="#666666" fontSize="9" fontFamily={fonts.mono!}>{domMax.toFixed(2)}</SvgText>
        <SvgText x={PAD_L - 4} y={PAD_T + chartH + 3} textAnchor="end" fill="#666666" fontSize="9" fontFamily={fonts.mono!}>{domMin.toFixed(2)}</SvgText>
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
  rowLeft: { flex: 1, marginRight: 12 },
  seriesId: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted },
  name: { fontFamily: fonts.mono, fontSize: 12, color: colors.textPrimary, marginTop: 1 },
  rowRight: { alignItems: 'flex-end' },
  value: { fontFamily: fonts.monoBold, fontSize: 13, color: colors.textPrimary },
  inversionValue: { color: colors.negative },
  change: { fontFamily: fonts.monoBold, fontSize: 11, marginTop: 2 },
  inversionBadge: {
    fontFamily: fonts.monoBold, fontSize: 9, color: colors.negative,
    marginTop: 4, letterSpacing: 1,
  },
  detail: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  detailHeader: { flexDirection: 'row', alignItems: 'baseline', gap: 10, marginBottom: 8 },
  detailValue: { fontFamily: fonts.monoBold, fontSize: 18, color: colors.textPrimary },
  detailChange: { fontFamily: fonts.monoBold, fontSize: 14 },
  explainer: {
    fontFamily: fonts.mono, fontSize: 11, color: colors.textSecondary,
    lineHeight: 17, marginBottom: 10,
  },
  invertedNote: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted, marginTop: 4, marginBottom: 8 },
});
