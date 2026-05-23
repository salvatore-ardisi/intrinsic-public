import { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Dimensions, StyleSheet } from 'react-native';
import Svg, { Polyline, Line, Text as SvgText } from 'react-native-svg';
import { colors, fonts } from '../config/theme';
import { fetchSeriesHistory } from '../lib/api';
import type { Observation } from '../lib/types';
import { padDomain } from '../lib/chartUtils';

type Status = 'loading' | 'ready' | 'error';

export default function MacroPulseChart() {
  const [collapsed, setCollapsed] = useState(false);
  const [status, setStatus] = useState<Status>('loading');
  const [unrateData, setUnrateData] = useState<Observation[]>([]);
  const [fedData, setFedData] = useState<Observation[]>([]);

  useEffect(() => {
    Promise.all([
      fetchSeriesHistory('UNRATE'),
      fetchSeriesHistory('FEDFUNDS'),
    ])
      .then(([u, f]) => {
        if (u.length < 2 || f.length < 2) {
          setStatus('error');
          return;
        }
        setUnrateData(u);
        setFedData(f);
        setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, []);

  return (
    <View style={s.container}>
      <TouchableOpacity onPress={() => setCollapsed(c => !c)} activeOpacity={0.7} style={s.toggle}>
        <Text style={s.toggleLabel}>MACRO PULSE</Text>
        <Text style={s.chevron}>{collapsed ? '▶' : '▼'}</Text>
      </TouchableOpacity>

      {!collapsed && (
        <>
          {status === 'loading' && (
            <Text style={s.statusText}>LOADING MACRO PULSE...</Text>
          )}
          {status === 'error' && (
            <Text style={s.statusText}>MACRO PULSE UNAVAILABLE</Text>
          )}
          {status === 'ready' && (
            <ChartBody unrateData={unrateData} fedData={fedData} />
          )}
        </>
      )}
    </View>
  );
}

function ChartBody({ unrateData, fedData }: { unrateData: Observation[]; fedData: Observation[] }) {
  const screenW = Dimensions.get('window').width - 24;
  const H = 180;
  const PAD_L = 42;
  const PAD_R = 42;
  const PAD_T = 8;
  const PAD_B = 22;
  const chartW = screenW - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  const allDates = [...new Set([...unrateData.map(o => o.date), ...fedData.map(o => o.date)])].sort();

  const unrateMap: Record<string, number> = {};
  for (const o of unrateData) unrateMap[o.date] = o.value;
  const fedMap: Record<string, number> = {};
  for (const o of fedData) fedMap[o.date] = o.value;

  const commonDates = allDates.filter(d => unrateMap[d] !== undefined && fedMap[d] !== undefined);
  if (commonDates.length < 2) return null;

  const uVals = commonDates.map(d => unrateMap[d]);
  const fVals = commonDates.map(d => fedMap[d]);

  const uMin = Math.min(...uVals);
  const uMax = Math.max(...uVals);
  const fMin = Math.min(...fVals);
  const fMax = Math.max(...fVals);
  const uDom = padDomain(uMin, uMax);
  const fDom = padDomain(fMin, fMax);

  const toX = (i: number) => PAD_L + (i / (commonDates.length - 1)) * chartW;
  const toYU = (v: number) => PAD_T + chartH - ((v - uDom.min) / uDom.range) * chartH;
  const toYF = (v: number) => PAD_T + chartH - ((v - fDom.min) / fDom.range) * chartH;

  const uLine = commonDates.map((_, i) => `${toX(i).toFixed(1)},${toYU(uVals[i]).toFixed(1)}`).join(' ');
  const fLine = commonDates.map((_, i) => `${toX(i).toFixed(1)},${toYF(fVals[i]).toFixed(1)}`).join(' ');

  const labelCount = 5;
  const dateLabels: { label: string; x: number }[] = [];
  for (let i = 0; i < labelCount; i++) {
    const idx = Math.round((i / (labelCount - 1)) * (commonDates.length - 1));
    const d = new Date(commonDates[idx]);
    dateLabels.push({
      label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      x: toX(idx),
    });
  }

  return (
    <View>
      <View style={{ backgroundColor: '#000000' }}>
        <Svg width={screenW} height={H}>
          {/* Grid */}
          {[0, 0.25, 0.5, 0.75, 1].map(frac => (
            <Line key={frac} x1={PAD_L} y1={PAD_T + chartH * (1 - frac)} x2={screenW - PAD_R} y2={PAD_T + chartH * (1 - frac)} stroke="#1a1a1a" strokeWidth="1" />
          ))}

          {/* UNRATE line */}
          <Polyline points={uLine} fill="none" stroke={colors.negative} strokeWidth="1.5" />

          {/* FEDFUNDS line */}
          <Polyline points={fLine} fill="none" stroke={colors.cyan} strokeWidth="1.5" />

          {/* Left Y-axis - UNRATE */}
          <SvgText x={PAD_L - 4} y={toYU(uMax) + 3} textAnchor="end" fill={colors.negative} fontSize="9" fontFamily={fonts.mono!}>{uMax.toFixed(1)}%</SvgText>
          <SvgText x={PAD_L - 4} y={toYU(uMin) + 3} textAnchor="end" fill={colors.negative} fontSize="9" fontFamily={fonts.mono!}>{uMin.toFixed(1)}%</SvgText>

          {/* Right Y-axis - FEDFUNDS */}
          <SvgText x={screenW - PAD_R + 4} y={toYF(fMax) + 3} textAnchor="start" fill={colors.cyan} fontSize="9" fontFamily={fonts.mono!}>{fMax.toFixed(2)}%</SvgText>
          <SvgText x={screenW - PAD_R + 4} y={toYF(fMin) + 3} textAnchor="start" fill={colors.cyan} fontSize="9" fontFamily={fonts.mono!}>{fMin.toFixed(2)}%</SvgText>

          {/* X-axis */}
          {dateLabels.map((dl, i) => (
            <SvgText key={i} x={dl.x} y={H - 4} textAnchor="middle" fill="#666666" fontSize="9" fontFamily={fonts.mono!}>{dl.label}</SvgText>
          ))}
        </Svg>
      </View>

      {/* Legend */}
      <View style={s.legend}>
        <View style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: colors.negative }]} />
          <Text style={s.legendText}>UNEMPLOYMENT</Text>
        </View>
        <View style={s.legendItem}>
          <View style={[s.legendDot, { backgroundColor: colors.cyan }]} />
          <Text style={s.legendText}>FED FUNDS</Text>
        </View>
      </View>

      <Text style={s.caption}>
        Unemployment and the fed funds rate are the two sides of the Fed's policy equation. Rising unemployment pressures the FOMC to cut; a tight labor market gives room to hold or hike. The lag between turns in each series reflects the transmission delay of monetary policy.
      </Text>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    marginHorizontal: 12,
    marginTop: 6,
    marginBottom: 6,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  toggleLabel: {
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
});
