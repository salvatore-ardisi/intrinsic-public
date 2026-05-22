import { useState, useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, fonts } from '../config/theme';
import { ENABLE_AI, ANTHROPIC_API_KEY } from '../config/env';
import { generateMacroSummary, clearMacroSummaryCache } from '../lib/api';
import type { Indicator } from '../lib/types';

interface Props {
  indicators: Indicator[];
}

const SECTION_LABELS = ['MARKET INTERPRETATION', 'WHY THIS MATTERS', 'WHAT TO WATCH'] as const;

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `macro_ai_${y}-${m}-${day}`;
}

function renderStyledSummary(text: string) {
  const parts: Array<{ type: 'label' | 'body'; text: string }> = [];
  let remaining = text;

  while (remaining.length > 0) {
    let earliest = -1;
    let earliestLabel = '';
    for (const label of SECTION_LABELS) {
      const idx = remaining.indexOf(label);
      if (idx !== -1 && (earliest === -1 || idx < earliest)) {
        earliest = idx;
        earliestLabel = label;
      }
    }

    if (earliest === -1) {
      parts.push({ type: 'body', text: remaining });
      break;
    }

    if (earliest > 0) {
      parts.push({ type: 'body', text: remaining.slice(0, earliest) });
    }
    parts.push({ type: 'label', text: earliestLabel });
    remaining = remaining.slice(earliest + earliestLabel.length);
  }

  return parts.map((part, i) =>
    part.type === 'label' ? (
      <Text key={i} style={si.label}>{part.text}</Text>
    ) : (
      <Text key={i} style={si.body}>{part.text}</Text>
    ),
  );
}

export default function MacroSummary({ indicators }: Props) {
  const [collapsed, setCollapsed] = useState(true);
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const aiActive = ENABLE_AI && !!ANTHROPIC_API_KEY;

  useEffect(() => {
    if (!aiActive) return;
    AsyncStorage.getItem(todayKey()).then(cached => {
      if (cached) setSummary(cached);
    }).catch(() => {});
  }, [aiActive]);

  const fetchSummary = useCallback(async (force = false) => {
    if (!aiActive || indicators.length === 0) return;
    if (force) clearMacroSummaryCache();
    setLoading(true);
    setError(null);
    try {
      const text = await generateMacroSummary(indicators);
      setSummary(text);
      await AsyncStorage.setItem(todayKey(), text);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setError(msg);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, [aiActive, indicators]);

  return (
    <View style={s.card}>
      <TouchableOpacity
        onPress={() => setCollapsed(c => !c)}
        activeOpacity={0.7}
        style={s.headerRow}
      >
        <View style={s.headerLeft}>
          <Text style={s.headerText}>MACRO SUMMARY</Text>
          <View style={s.aiBadge}>
            <Text style={s.aiBadgeText}>AI</Text>
          </View>
        </View>
        <Text style={s.chevron}>{collapsed ? '▶' : '▼'}</Text>
      </TouchableOpacity>

      {!collapsed && (
        <>
          {aiActive && loading && (
            <Text style={s.analyzing}>ANALYZING...</Text>
          )}
          {aiActive && !loading && summary && (
            <>
              <View style={s.summaryBlock}>
                <Text>{renderStyledSummary(summary)}</Text>
              </View>
              <View style={s.analyzePrompt}>
                <TouchableOpacity onPress={() => fetchSummary(true)} activeOpacity={0.7} style={s.analyzeBtn}>
                  <Text style={s.analyzeBtnText}>REGENERATE</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
          {aiActive && !loading && error && (
            <>
              <TouchableOpacity onPress={() => fetchSummary()} activeOpacity={0.7} style={s.analyzeBtn}>
                <Text style={s.analyzeBtnText}>RETRY</Text>
              </TouchableOpacity>
              <Text style={s.errorNote}>API ERROR: {error}</Text>
            </>
          )}
          {aiActive && !loading && !summary && !error && (
            <View style={s.analyzePrompt}>
              <TouchableOpacity onPress={() => fetchSummary()} activeOpacity={0.7} style={s.analyzeBtn}>
                <Text style={s.analyzeBtnText}>ANALYZE</Text>
              </TouchableOpacity>
              <Text style={s.analyzeHint}>AI-powered synthesis of all economic indicators</Text>
            </View>
          )}
          {!aiActive && (
            <Text style={s.bodyText}>
              COMING SOON — AI-powered synthesis of all indicators into a cohesive economic outlook.
            </Text>
          )}
          <Text style={s.footer}>Powered by Claude API</Text>
        </>
      )}
    </View>
  );
}

const si = StyleSheet.create({
  label: {
    fontFamily: fonts.monoBold,
    fontSize: 11,
    color: colors.accent,
    lineHeight: 17,
  },
  body: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: '#cccccc',
    lineHeight: 17,
  },
});

const s = StyleSheet.create({
  card: {
    marginHorizontal: 12,
    marginTop: 10,
    marginBottom: 6,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1a1a1a',
    backgroundColor: '#0a0a0a',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerText: {
    fontFamily: fonts.monoBold,
    fontSize: 11,
    color: colors.accent,
  },
  aiBadge: {
    marginLeft: 8,
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 9,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  aiBadgeText: {
    fontFamily: fonts.monoBold,
    fontSize: 8,
    color: colors.accent,
  },
  chevron: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
  },
  analyzing: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.accent,
    marginTop: 8,
  },
  summaryBlock: {
    marginTop: 8,
    borderLeftWidth: 2,
    borderLeftColor: colors.accent,
    backgroundColor: '#0d0800',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  bodyText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: '#666666',
    lineHeight: 17,
    marginTop: 8,
  },
  analyzePrompt: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  analyzeBtn: {
    borderWidth: 1,
    borderColor: colors.accent,
    paddingHorizontal: 24,
    paddingVertical: 8,
  },
  analyzeBtnText: {
    fontFamily: fonts.monoBold,
    fontSize: 12,
    color: colors.accent,
  },
  analyzeHint: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 8,
  },
  errorNote: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.negative,
    marginTop: 4,
    textAlign: 'center',
  },
  footer: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: '#666666',
    marginTop: 8,
  },
});
