import { useState, useCallback, useEffect, useImperativeHandle, forwardRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Image } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { colors, fonts } from '../config/theme';
import { ENABLE_AI, ANTHROPIC_API_KEY } from '../config/env';
import { fetchDailySpark, generateSparkInterpretation } from '../lib/api';
import type { SparkResponse } from '../lib/types';

export interface DailySparkHandle {
  refresh: () => Promise<void>;
}

const DailySpark = forwardRef<DailySparkHandle>(function DailySpark(_props, ref) {
  const [spark, setSpark] = useState<SparkResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [interpretation, setInterpretation] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  const aiActive = ENABLE_AI && !!ANTHROPIC_API_KEY;

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError(false);
    try {
      const data = await fetchDailySpark(force);
      if (data) {
        setSpark(data);
        setInterpretation(null);
        setImageError(false);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useImperativeHandle(ref, () => ({ refresh: () => load(true) }), [load]);

  const fetchInterpretation = useCallback(async () => {
    if (!aiActive || !spark) return;
    if (interpretation) return;
    setAiLoading(true);
    setAiError(null);
    try {
      const text = await generateSparkInterpretation(spark.title, spark.body, spark.sources);
      setInterpretation(text);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Unknown error';
      setAiError(msg);
    } finally {
      setAiLoading(false);
    }
  }, [aiActive, interpretation, spark]);

  if (loading) {
    return (
      <View style={s.card}>
        <View style={s.loadingContainer}>
          <ActivityIndicator color={colors.amber} size="small" />
          <Text style={s.loadingText}>LOADING DAILY SPARK...</Text>
        </View>
      </View>
    );
  }

  if (error || !spark) {
    return (
      <View style={s.card}>
        <Text style={s.errorTitle}>DAILY SPARK UNAVAILABLE</Text>
        <TouchableOpacity onPress={() => load(true)} activeOpacity={0.7} style={s.retryBtn}>
          <Text style={s.retryBtnText}>RETRY</Text>
        </TouchableOpacity>
      </View>
    );
  }

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
            <Text style={s.sourcePillText}>APOLLO</Text>
          </View>
        </View>
        <View style={s.headerRight}>
          <Text style={s.date}>{spark.date.toUpperCase()}</Text>
          <Text style={s.chevron}>{expanded ? '▼' : '▶'}</Text>
        </View>
      </TouchableOpacity>

      {!expanded && (
        <Text style={s.collapsedHint} numberOfLines={1}>
          {spark.title} · tap to read
        </Text>
      )}

      {expanded && (
        <View style={s.body}>
          <Text style={s.title}>{spark.title}</Text>
          <Text style={s.bodyText}>{spark.body}</Text>

          {spark.sources && (
            <Text style={s.sourcesText}>{spark.sources}</Text>
          )}

          {spark.chartImageUrl && !imageError && (
            <Image
              source={{ uri: spark.chartImageUrl }}
              style={s.chartImage}
              resizeMode="contain"
              onError={() => setImageError(true)}
            />
          )}

          {spark.apolloLinks.length > 0 && (
            <View style={s.linksSection}>
              <Text style={s.linksSectionTitle}>WHAT'S NEW AT APOLLO</Text>
              {spark.apolloLinks.map((link, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => WebBrowser.openBrowserAsync(link.url)}
                  activeOpacity={0.7}
                  style={s.linkRow}
                >
                  <Text style={s.linkText} numberOfLines={2}>{link.title}</Text>
                  <Text style={s.linkArrow}>→</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

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
            Apollo · interpretation by Claude API
          </Text>
        </View>
      )}
    </View>
  );
});

export default DailySpark;

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
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.amber,
  },
  errorTitle: {
    fontFamily: fonts.monoBold,
    fontSize: 11,
    color: colors.textMuted,
  },
  retryBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 8,
  },
  retryBtnText: {
    fontFamily: fonts.monoBold,
    fontSize: 10,
    color: colors.accent,
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
    color: colors.accent,
    lineHeight: 18,
  },
  bodyText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textSecondary,
    lineHeight: 17,
    marginTop: 8,
  },
  sourcesText: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.textMuted,
    lineHeight: 15,
    marginTop: 8,
  },
  chartImage: {
    width: '100%',
    height: 200,
    marginTop: 10,
  },
  linksSection: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
    paddingTop: 8,
  },
  linksSectionTitle: {
    fontFamily: fonts.monoBold,
    fontSize: 9,
    color: colors.textMuted,
    marginBottom: 4,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 5,
  },
  linkText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textSecondary,
    flex: 1,
    marginRight: 8,
  },
  linkArrow: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textMuted,
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
