import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, fonts } from '../config/theme';
import { ENABLE_AI, ANTHROPIC_API_KEY } from '../config/env';
import { generateMacroSummary, clearMacroSummaryCache } from '../lib/api';
import type { Indicator } from '../lib/types';

interface Props {
  indicators: Indicator[];
}

export default function MacroSummary({ indicators }: Props) {
  const [collapsed, setCollapsed] = useState(true);
  const [summary, setSummary] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const aiActive = ENABLE_AI && !!ANTHROPIC_API_KEY;

  const fetchSummary = useCallback(async (force = false) => {
    if (!aiActive || indicators.length === 0) return;
    if (force) clearMacroSummaryCache();
    setLoading(true);
    setError(null);
    try {
      const text = await generateMacroSummary(indicators);
      setSummary(text);
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
        <View style={s.headerRight}>
          {aiActive && !collapsed && summary && !loading && (
            <TouchableOpacity onPress={() => fetchSummary(true)} activeOpacity={0.5} style={s.refreshBtn}>
              <Text style={s.refreshIcon}>↻</Text>
            </TouchableOpacity>
          )}
          <Text style={s.chevron}>{collapsed ? '▶' : '▼'}</Text>
        </View>
      </TouchableOpacity>

      {!collapsed && (
        <>
          {aiActive && loading && (
            <Text style={s.analyzing}>ANALYZING...</Text>
          )}
          {aiActive && !loading && summary && (
            <Text style={s.summaryText}>{summary}</Text>
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
            <Text style={s.body}>
              COMING SOON — AI-powered synthesis of all indicators into a cohesive economic outlook.
            </Text>
          )}
          <Text style={s.footer}>Powered by Claude API</Text>
        </>
      )}
    </View>
  );
}

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
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
  refreshBtn: {
    padding: 2,
  },
  refreshIcon: {
    fontFamily: fonts.mono,
    fontSize: 14,
    color: colors.accent,
  },
  analyzing: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.accent,
    marginTop: 8,
  },
  summaryText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: '#cccccc',
    lineHeight: 17,
    marginTop: 8,
  },
  body: {
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
