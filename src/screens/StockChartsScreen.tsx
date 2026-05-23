import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, Dimensions, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import Svg, { Polyline, Polygon, Line, Text as SvgText } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, fonts } from '../config/theme';
import { getCandle } from '../lib/prices';
import type { CandleResult } from '../lib/prices';
import { padDomain } from '../lib/chartUtils';

const STORAGE_KEY = 'watchlist_tickers';

interface ChartEntry {
  symbol: string;
  result: CandleResult | null;
  loading: boolean;
}

export default function StockChartsScreen() {
  const [entries, setEntries] = useState<ChartEntry[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingIdx, setLoadingIdx] = useState(0);

  const loadTickers = useCallback(async () => {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    const tickers: string[] = raw ? JSON.parse(raw) : [];
    setEntries(tickers.map(symbol => ({ symbol, result: null, loading: true })));
    setLoadingIdx(0);
  }, []);

  useEffect(() => { loadTickers(); }, [loadTickers]);

  useEffect(() => {
    if (entries.length === 0 || loadingIdx >= entries.length) return;
    const entry = entries[loadingIdx];
    if (!entry.loading) { setLoadingIdx(i => i + 1); return; }

    let cancelled = false;
    const delay = loadingIdx === 0 ? 0 : 1200;
    const timer = setTimeout(async () => {
      const result = await getCandle(entry.symbol);
      if (cancelled) return;
      setEntries(prev => prev.map((e, i) =>
        i === loadingIdx ? { ...e, result, loading: false } : e
      ));
      setLoadingIdx(i => i + 1);
    }, delay);

    return () => { cancelled = true; clearTimeout(timer); };
  }, [loadingIdx, entries.length]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadTickers().then(() => setRefreshing(false));
  }, [loadTickers]);

  if (entries.length === 0) {
    return (
      <View style={s.center}>
        <Text style={s.emptyText}>ADD TICKERS TO WATCHLIST TO SEE CHARTS</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={s.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.amber}
          colors={[colors.amber]}
          progressBackgroundColor={colors.surface}
        />
      }
    >
      {entries.map((entry, idx) => (
        <MiniChart key={entry.symbol} entry={entry} index={idx} total={entries.length} currentIdx={loadingIdx} />
      ))}
      <Text style={s.footer}>
        DAILY OHLCV · LOADED SEQUENTIALLY (5/MIN LIMIT) · MASSIVE
      </Text>
    </ScrollView>
  );
}

function MiniChart({ entry, index, total, currentIdx }: {
  entry: ChartEntry; index: number; total: number; currentIdx: number;
}) {
  const { symbol, result, loading } = entry;

  const sliced = useMemo(() => {
    if (!result || result.status !== 'ok') return null;
    const { candle } = result;
    const days = Math.min(252, candle.c.length);
    const start = Math.max(0, candle.c.length - days);
    return {
      t: candle.t.slice(start),
      c: candle.c.slice(start),
    };
  }, [result]);

  const lastPrice = sliced ? sliced.c[sliced.c.length - 1] : null;
  const firstPrice = sliced ? sliced.c[0] : null;
  const change = lastPrice !== null && firstPrice !== null ? lastPrice - firstPrice : 0;
  const changePct = firstPrice ? (change / firstPrice) * 100 : 0;
  const chartColor = change >= 0 ? colors.positive : colors.negative;

  const screenW = Dimensions.get('window').width;
  const H = 120;
  const PAD_L = 48;
  const PAD_R = 8;
  const PAD_T = 6;
  const PAD_B = 18;
  const chartW = screenW - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  return (
    <View style={s.chartCard}>
      <View style={s.chartHeader}>
        <Text style={s.chartSymbol}>{symbol}</Text>
        {lastPrice !== null && (
          <View style={s.chartPriceRow}>
            <Text style={s.chartPrice}>{lastPrice.toFixed(2)}</Text>
            <Text style={[s.chartChange, { color: chartColor }]}>
              {change >= 0 ? '+' : ''}{changePct.toFixed(2)}%
            </Text>
          </View>
        )}
      </View>

      {loading && (
        <View style={[s.chartBox, { height: H }]}>
          <ActivityIndicator color={colors.amber} size="small" />
          {index > currentIdx && (
            <Text style={s.queueText}>QUEUED ({index - currentIdx} AHEAD)</Text>
          )}
        </View>
      )}

      {!loading && result?.status === 'rate_limited' && (
        <View style={[s.chartBox, { height: H }]}>
          <Text style={s.chartMsg}>RATE LIMITED - TRY AGAIN LATER</Text>
        </View>
      )}

      {!loading && (result?.status === 'error' || (!sliced || (sliced && sliced.c.length < 2))) && result?.status !== 'rate_limited' && (
        <View style={[s.chartBox, { height: H }]}>
          <Text style={s.chartMsg}>CHART UNAVAILABLE</Text>
        </View>
      )}

      {!loading && sliced && sliced.c.length >= 2 && (() => {
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

        const labelCount = 4;
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
          { value: minVal, y: toY(minVal) },
        ];

        return (
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
        );
      })()}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.surface },
  emptyText: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted },
  chartCard: {
    marginHorizontal: 0,
    marginTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  chartSymbol: { fontFamily: fonts.monoBold, fontSize: 13, color: colors.accent },
  chartPriceRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chartPrice: { fontFamily: fonts.monoBold, fontSize: 13, color: colors.textPrimary },
  chartChange: { fontFamily: fonts.mono, fontSize: 11 },
  chartBox: {
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  chartMsg: { fontFamily: fonts.mono, fontSize: 10, color: colors.textMuted },
  queueText: { fontFamily: fonts.mono, fontSize: 8, color: colors.textMuted, marginTop: 4 },
  footer: {
    fontFamily: fonts.mono,
    fontSize: 8,
    color: colors.textMuted,
    textAlign: 'center',
    paddingVertical: 16,
    letterSpacing: 1,
  },
});
