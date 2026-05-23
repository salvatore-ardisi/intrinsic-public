import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import { useNavigation } from '@react-navigation/native';
import { colors, fonts } from '../config/theme';

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

function SectionHeader({ title }: { title: string }) {
  return <Text style={s.sectionHeader}>{title}</Text>;
}

function Row({ label, right, onPress }: {
  label: string;
  right?: React.ReactNode;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      style={s.row}
      activeOpacity={onPress ? 0.6 : 1}
      onPress={onPress}
      disabled={!onPress}
    >
      <Text style={s.rowLabel}>{label}</Text>
      {right}
    </TouchableOpacity>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [cacheCleared, setCacheCleared] = useState(false);

  const handleClearCache = useCallback(async () => {
    try {
      await AsyncStorage.clear();
      setCacheCleared(true);
      setTimeout(() => setCacheCleared(false), 2000);
    } catch {
      Alert.alert('Error', 'Failed to clear cache');
    }
  }, []);

  const handleViewGithub = useCallback(() => {
    WebBrowser.openBrowserAsync('https://github.com/salvatore-ardisi/intrinsic-public');
  }, []);

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={20} color={colors.accent} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>SETTINGS</Text>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
        <SectionHeader title="ACCOUNT" />
        <Row
          label="SIGN IN / CREATE ACCOUNT"
          right={<Text style={s.comingSoon}>COMING SOON</Text>}
        />
        <Row
          label="STATUS"
          right={<Text style={s.valueText}>FREE TIER</Text>}
        />

        <SectionHeader title="SUBSCRIPTION" />
        <View style={s.planCard}>
          <View style={s.planRow}>
            <View style={s.planCol}>
              <Text style={s.planHeader}>FREE</Text>
              <Text style={s.planItem}>Basic Indicators</Text>
              <Text style={s.planItem}>EDGAR Search</Text>
              <Text style={s.planItem}>RSS News</Text>
              <Text style={s.planItem}>Fed Comms</Text>
            </View>
            <View style={s.planDivider} />
            <View style={s.planCol}>
              <Text style={s.planHeaderPro}>PRO</Text>
              <Text style={s.planItem}>AI Analysis</Text>
              <Text style={s.planItem}>Custom Indicators</Text>
              <Text style={s.planItem}>Chart Overlays</Text>
              <Text style={s.planItem}>Cross-Device Sync</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity style={s.upgradeBtn} activeOpacity={0.6}>
          <Text style={s.upgradeBtnText}>UPGRADE TO PRO</Text>
          <Text style={s.comingSoon}>  COMING SOON</Text>
        </TouchableOpacity>

        <SectionHeader title="PREFERENCES" />
        <Row
          label="DEFAULT FLOOR"
          right={<Text style={s.valueText}>ECONOMY</Text>}
        />
        <Row
          label="MANAGE WATCHLIST"
          right={<Ionicons name="chevron-forward" size={14} color={colors.textMuted} />}
        />

        <SectionHeader title="DATA" />
        <Row
          label="CLEAR CACHE"
          right={
            cacheCleared
              ? <Text style={s.confirmText}>CLEARED</Text>
              : <Ionicons name="trash-outline" size={14} color={colors.textMuted} />
          }
          onPress={handleClearCache}
        />
        <View style={s.row}>
          <Text style={s.rowLabel}>API STATUS</Text>
          <View style={s.statusDots}>
            <View style={s.statusItem}>
              <View style={s.dotGreen} />
              <Text style={s.statusLabel}>FRED</Text>
            </View>
            <View style={s.statusItem}>
              <View style={s.dotGreen} />
              <Text style={s.statusLabel}>BLS</Text>
            </View>
            <View style={s.statusItem}>
              <View style={s.dotGreen} />
              <Text style={s.statusLabel}>EDGAR</Text>
            </View>
          </View>
        </View>

        <SectionHeader title="ABOUT" />
        <Row
          label="VERSION"
          right={<Text style={s.valueText}>{APP_VERSION}</Text>}
        />
        <Row
          label="LICENSE"
          right={<Text style={s.valueText}>GPL-3.0</Text>}
        />
        <Row
          label="VIEW ON GITHUB"
          right={<Ionicons name="open-outline" size={14} color={colors.accent} />}
          onPress={handleViewGithub}
        />
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 44,
    backgroundColor: colors.surfaceAlt,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    paddingLeft: 16,
    paddingRight: 12,
  },
  headerTitle: {
    fontFamily: fonts.monoBold,
    fontSize: 14,
    color: colors.accent,
  },
  scroll: {
    flex: 1,
  },
  sectionHeader: {
    fontFamily: fonts.monoSemiBold,
    fontSize: 11,
    color: colors.accent,
    letterSpacing: 2,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  rowLabel: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textPrimary,
    letterSpacing: 0.5,
  },
  valueText: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textMuted,
  },
  comingSoon: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: '#444444',
    letterSpacing: 0.5,
  },
  confirmText: {
    fontFamily: fonts.monoSemiBold,
    fontSize: 10,
    color: colors.positive,
    letterSpacing: 0.5,
  },
  planCard: {
    marginHorizontal: 16,
    marginTop: 4,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceAlt,
  },
  planRow: {
    flexDirection: 'row',
  },
  planCol: {
    flex: 1,
    padding: 12,
  },
  planDivider: {
    width: 1,
    backgroundColor: colors.border,
  },
  planHeader: {
    fontFamily: fonts.monoSemiBold,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 1,
    marginBottom: 8,
  },
  planHeaderPro: {
    fontFamily: fonts.monoSemiBold,
    fontSize: 10,
    color: colors.accent,
    letterSpacing: 1,
    marginBottom: 8,
  },
  planItem: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.textSecondary,
    lineHeight: 16,
  },
  upgradeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  upgradeBtnText: {
    fontFamily: fonts.monoSemiBold,
    fontSize: 11,
    color: colors.accent,
    letterSpacing: 1,
  },
  statusDots: {
    flexDirection: 'row',
    gap: 12,
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dotGreen: {
    width: 6,
    height: 6,
    backgroundColor: colors.positive,
  },
  statusLabel: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.textMuted,
  },
});
