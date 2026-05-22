import { View, Text, Dimensions } from 'react-native';
import Svg, { Polyline, Line, Text as SvgText } from 'react-native-svg';
import { colors, fonts } from '../config/theme';
import type { Observation } from '../lib/types';
import { padDomain } from '../lib/chartUtils';

interface Props {
  observations: Observation[];
  unit: string;
  decimals?: number;
}

function fmtLabel(value: number, unit: string, decimals: number): string {
  if (unit === 'B$') return `$${value.toFixed(1)}B`;
  if (unit === 'K') return `${value.toFixed(0)}K`;
  if (unit === '%') return `${value.toFixed(decimals)}%`;
  if (unit === 'index') return value.toFixed(decimals);
  return value.toFixed(decimals);
}

export default function IndicatorChart({ observations, unit, decimals = 2 }: Props) {
  if (observations.length < 2) return null;

  const screenW = Dimensions.get('window').width - 24;
  const H = 150;
  const PAD_L = 48;
  const PAD_R = 8;
  const PAD_T = 8;
  const PAD_B = 22;
  const chartW = screenW - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  const values = observations.map(o => o.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const midVal = (maxVal + minVal) / 2;
  const dom = padDomain(minVal, maxVal);

  const toX = (i: number) => PAD_L + (i / (observations.length - 1)) * chartW;
  const toY = (v: number) => PAD_T + chartH - ((v - dom.min) / dom.range) * chartH;

  const linePoints = observations
    .map((o, i) => `${toX(i).toFixed(1)},${toY(o.value).toFixed(1)}`)
    .join(' ');

  const labelCount = 5;
  const dateLabels: { label: string; x: number }[] = [];
  for (let i = 0; i < labelCount; i++) {
    const idx = Math.round((i / (labelCount - 1)) * (observations.length - 1));
    const d = new Date(observations[idx].date);
    dateLabels.push({
      label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
      x: toX(idx),
    });
  }

  const yLabels = [
    { value: maxVal, y: toY(maxVal) },
    { value: midVal, y: toY(midVal) },
    { value: minVal, y: toY(minVal) },
  ];

  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ fontFamily: fonts.monoBold, fontSize: 10, color: colors.accent, marginBottom: 4 }}>
        3-YEAR HISTORY
      </Text>
      <View style={{ backgroundColor: '#000000' }}>
        <Svg width={screenW} height={H}>
          {/* Grid lines */}
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

          {/* Data line */}
          <Polyline points={linePoints} fill="none" stroke={colors.amber} strokeWidth="1.5" />

          {/* Y-axis labels */}
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
              {fmtLabel(yl.value, unit, decimals)}
            </SvgText>
          ))}

          {/* X-axis labels */}
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
    </View>
  );
}
