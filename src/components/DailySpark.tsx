import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, fonts } from '../config/theme';
import { ENABLE_AI, ANTHROPIC_API_KEY } from '../config/env';
import { generateSparkInterpretation } from '../lib/api';

const SPARK = {
  title: 'The Disconnect Between Hard and Soft Data',
  date: 'MAY 21',
  source: 'Apollo',
  author: 'Torsten Sløk',
  body: 'Soft data — surveys, sentiment — has rolled over while hard data — actual spending, output — stays firm. The gap is unusually wide.',
};

export default function DailySpark() {
  const [expanded, setExpanded] = useState(false);
  const [interpretation, setInterpretation] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const aiActive = ENABLE_AI && !!ANTHROPIC_API_KEY;

  const fetchInterpretation = useCallback(async () => {
    if (!aiActive) return;
    if (interpretation) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const text = await generateSparkInterpretation(SPARK.title, SPARK.body);
      setInterpretation(text);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setAiError(msg);
    } finally {
      setAiLoading(false);
    }
  }, [aiActive, interpretation]);

  return (
    <View style={s.card}>
      <TouchableOpacity
        onPress={() => setExpanded(e => !e)}
        activeOpacity={0.7}
        style={s.headerRow}
      >
        <View style={s.headerLeft}>
          <Text style={s.headerText}>DAILY SPARK</Text>
          <View style={s.sourcePill}>
            <Text style={s.sourcePillText}>{SPARK.source.toUpperCase()}</Text>
          </View>
        </View>
        <View style={s.headerRight}>
          <Text style={s.date}>{SPARK.date}</Text>
          <Text style={s.chevron}>{expanded ? '▼' : '▶'}</Text>
        </View>
      </TouchableOpacity>

      {!expanded && (
        <Text style={s.collapsedHint} numberOfLines={1}>
          {SPARK.title} · tap to read
        </Text>
      )}

      {expanded && (
        <View style={s.body}>
          <Text style={s.title}>{SPARK.title}</Text>
          <Text style={s.bodyText}>{SPARK.body}</Text>

          {/* AI interpretation */}
          {aiActive && !interpretation && !aiLoading && !aiError && (
            <TouchableOpacity onPress={fetchInterpretation} activeOpacity={0.7} style={s.aiBtn}>
              <Text style={s.aiBtnText}>WHAT THIS MEANS</Text>
              <View style={s.aiBadge}>
                <Text style={s.aiBadgeText}>AI</Text>
              </View>
            </TouchableOpacity>
          )}

          {aiActive && aiLoading && (
            <Text style={s.analyzing}>INTERPRETING...</Text>
          )}

          {aiActive && interpretation && (
            <View style={s.interpBlock}>
              <Text style={s.interpText}>{interpretation}</Text>
            </View>
          )}

          {aiActive && aiError && !interpretation && (
            <View>
              <TouchableOpacity
                onPress={() => { setAiError(null); setInterpretation(null); fetchInterpretation(); }}
                activeOpacity={0.7}
                style={s.aiBtn}
              >
                <Text style={s.aiBtnText}>RETRY</Text>
              </TouchableOpacity>
              <Text style={s.errorNote}>API ERROR: {aiError}</Text>
            </View>
          )}

          {!aiActive && (
            <Text style={s.aiDisabled}>AI INTERPRETATION UNAVAILABLE — SET ANTHROPIC_API_KEY + ENABLE_AI</Text>
          )}

          <Text style={s.footer}>
            {SPARK.author} · {SPARK.source} · interpretation by Claude API
          </Text>
        </View>
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
    borderColor: colors.accent,
    backgroundColor: colors.surfaceAlt,
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
  sourcePill: {
    marginLeft: 8,
    borderWidth: 1,
    borderColor: colors.amber,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  sourcePillText: {
    fontFamily: fonts.monoBold,
    fontSize: 8,
    color: colors.amber,
  },
  date: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
  },
  chevron: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
  },
  collapsedHint: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 6,
  },
  body: {
    marginTop: 10,
  },
  title: {
    fontFamily: fonts.monoBold,
    fontSize: 13,
    color: colors.textPrimary,
    lineHeight: 18,
  },
  bodyText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 17,
    marginTop: 8,
  },
  aiBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 12,
    gap: 8,
  },
  aiBtnText: {
    fontFamily: fonts.monoBold,
    fontSize: 10,
    color: colors.accent,
  },
  aiBadge: {
    borderWidth: 1,
    borderColor: colors.accent,
    borderRadius: 9,
    paddingHorizontal: 5,
    paddingVertical: 0,
  },
  aiBadgeText: {
    fontFamily: fonts.monoBold,
    fontSize: 8,
    color: colors.accent,
  },
  analyzing: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.accent,
    marginTop: 12,
  },
  interpBlock: {
    marginTop: 12,
    borderLeftWidth: 2,
    borderLeftColor: colors.accent,
    backgroundColor: '#0d0800',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  interpText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: '#cccccc',
    lineHeight: 17,
  },
  errorNote: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.negative,
    marginTop: 4,
  },
  aiDisabled: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 12,
  },
  footer: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.textMuted,
    marginTop: 10,
  },
});
