import { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, RefreshControl, Dimensions, StyleSheet, ActivityIndicator,
} from 'react-native';
import Svg, { Polyline, Line, Circle, Text as SvgText } from 'react-native-svg';
import { colors, fonts } from '../../config/theme';
import { BOND_YIELD_SERIES, BOND_MATURITY_LABELS } from '../../config/series';
import { fetchBondYields } from '../../lib/api';
import type { Indicator } from '../../lib/types';

const MATURITY_ORDER = [
  'DGS1MO', 'DGS3MO', 'DGS6MO', 'DGS1',
  'DGS2', 'DGS3', 'DGS5', 'DGS7',
  'DGS10', 'DGS20', 'DGS30',
];

export default function BondCurveScreen() {
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

  if (loading) {
    return <View style={s.center}><ActivityIndicator color={colors.amber} /></View>;
  }

  const curvePoints = MATURITY_ORDER
    .map(id => {
      const ind = indicators.find(i => i.series_id === id);
      if (!ind || ind.value === null) return null;
      return { label: BOND_MATURITY_LABELS[id], value: ind.value, id };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  return (
    <ScrollView
      style={s.container}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh}
          tintColor={colors.amber} colors={[colors.amber]} progressBackgroundColor={colors.surface} />
      }
    >
      <View style={s.chartBlock}>
        <Text style={s.chartTitle}>U.S. TREASURY YIELD CURVE</Text>
        {curvePoints.length >= 2 ? (
          <YieldCurveChart points={curvePoints} />
        ) : (
          <Text style={s.statusText}>YIELD CURVE UNAVAILABLE</Text>
        )}
      </View>

      <View style={s.tableBlock}>
        <Text style={s.tableTitle}>CURRENT YIELDS</Text>
        {curvePoints.map(p => (
          <View key={p.id} style={s.tableRow}>
            <Text style={s.tableLabel}>{p.label}</Text>
            <Text style={s.tableValue}>{p.value.toFixed(2)}%</Text>
          </View>
        ))}
      </View>

      <Text style={s.caption}>
        The yield curve plots Treasury yields across maturities. A normal upward slope reflects term premium - investors demand higher compensation for longer duration. Inversion (short rates above long rates) has historically signaled economic stress.
      </Text>
    </ScrollView>
  );
}

function YieldCurveChart({ points }: { points: { label: string; value: number }[] }) {
  const screenW = Dimensions.get('window').width - 24;
  const H = 240;
  const PAD_L = 42;
  const PAD_R = 12;
  const PAD_T = 16;
  const PAD_B = 32;
  const chartW = screenW - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  const vals = points.map(p => p.value);
  const minVal = Math.min(...vals);
  const maxVal = Math.max(...vals);
  const range = maxVal - minVal || 1;
  const pad = range * 0.15;
  const domMin = minVal - pad;
  const domMax = maxVal + pad;
  const domRange = domMax - domMin;

  const toX = (i: number) => PAD_L + (i / (points.length - 1)) * chartW;
  const toY = (v: number) => PAD_T + chartH - ((v - domMin) / domRange) * chartH;

  const pts = points.map((p, i) => `${toX(i).toFixed(1)},${toY(p.value).toFixed(1)}`).join(' ');

  const gridLines = 5;
  const gridVals: number[] = [];
  for (let i = 0; i < gridLines; i++) {
    gridVals.push(domMin + (i / (gridLines - 1)) * domRange);
  }

  return (
    <View style={{ backgroundColor: '#000000' }}>
      <Svg width={screenW} height={H}>
        {gridVals.map((v, i) => (
          <Line key={i} x1={PAD_L} y1={toY(v)} x2={screenW - PAD_R} y2={toY(v)} stroke="#1a1a1a" strokeWidth="1" />
        ))}
        {[gridVals[0], gridVals[Math.floor(gridLines / 2)], gridVals[gridLines - 1]].map((v, i) => (
          <SvgText key={i} x={PAD_L - 4} y={toY(v) + 3} textAnchor="end" fill="#666666" fontSize="9" fontFamily={fonts.mono!}>
            {v.toFixed(2)}%
          </SvgText>
        ))}

        <Polyline points={pts} fill="none" stroke={colors.accent} strokeWidth="2" />

        {points.map((p, i) => (
          <Circle key={i} cx={toX(i)} cy={toY(p.value)} r="3" fill={colors.accent} />
        ))}

        {points.map((p, i) => (
          <SvgText key={i} x={toX(i)} y={H - 8}
            textAnchor="middle" fill="#999999" fontSize="9" fontFamily={fonts.mono!}>
            {p.label}
          </SvgText>
        ))}
      </Svg>
    </View>
  );
}

const s = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface },
  container: { flex: 1, backgroundColor: colors.surface },
  chartBlock: { marginHorizontal: 12, marginTop: 12 },
  chartTitle: { fontFamily: fonts.monoBold, fontSize: 10, color: colors.accent, marginBottom: 8 },
  statusText: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted, paddingVertical: 8 },
  tableBlock: { marginHorizontal: 12, marginTop: 16 },
  tableTitle: { fontFamily: fonts.monoBold, fontSize: 10, color: colors.accent, marginBottom: 6 },
  tableRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: colors.borderSubtle,
  },
  tableLabel: { fontFamily: fonts.monoBold, fontSize: 12, color: colors.textSecondary },
  tableValue: { fontFamily: fonts.monoBold, fontSize: 12, color: colors.textPrimary },
  caption: {
    fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted, lineHeight: 15,
    marginHorizontal: 12, marginTop: 16, marginBottom: 24,
  },
});
