import { useState, useCallback, useEffect } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Alert, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import Constants from 'expo-constants';
import { useNavigation } from '@react-navigation/native';
import { colors, fonts } from '../config/theme';
import { signUp, signIn, signOut, onAuthChanged } from '../lib/firebase';
import type { User } from '../lib/firebase';

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

function firebaseErrorMessage(code: string): string {
  switch (code) {
    case 'auth/invalid-email': return 'Invalid email address.';
    case 'auth/user-disabled': return 'This account has been disabled.';
    case 'auth/user-not-found': return 'No account found with this email.';
    case 'auth/wrong-password': return 'Incorrect password.';
    case 'auth/invalid-credential': return 'Incorrect email or password.';
    case 'auth/email-already-in-use': return 'An account with this email already exists.';
    case 'auth/weak-password': return 'Password must be at least 6 characters.';
    case 'auth/too-many-requests': return 'Too many attempts. Try again later.';
    case 'auth/network-request-failed': return 'Network error. Check your connection.';
    default: return 'Something went wrong. Try again.';
  }
}

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
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const unsub = onAuthChanged((u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  const handleSignIn = useCallback(async () => {
    setAuthError('');
    if (!email.trim() || !password) {
      setAuthError('Email and password are required.');
      return;
    }
    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
      setEmail('');
      setPassword('');
    } catch (e: any) {
      setAuthError(firebaseErrorMessage(e.code));
    } finally {
      setSubmitting(false);
    }
  }, [email, password]);

  const handleSignUp = useCallback(async () => {
    setAuthError('');
    if (!email.trim() || !password) {
      setAuthError('Email and password are required.');
      return;
    }
    if (password !== confirmPassword) {
      setAuthError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setAuthError('Password must be at least 6 characters.');
      return;
    }
    setSubmitting(true);
    try {
      await signUp(email.trim(), password);
      setEmail('');
      setPassword('');
      setConfirmPassword('');
    } catch (e: any) {
      setAuthError(firebaseErrorMessage(e.code));
    } finally {
      setSubmitting(false);
    }
  }, [email, password, confirmPassword]);

  const handleSignOut = useCallback(async () => {
    try {
      await signOut();
    } catch {
      Alert.alert('Error', 'Failed to sign out');
    }
  }, []);

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

  const renderAccountSection = () => {
    if (authLoading) {
      return (
        <View style={s.authContainer}>
          <ActivityIndicator color={colors.amber} />
        </View>
      );
    }

    if (user) {
      return (
        <>
          <Row
            label="SIGNED IN AS"
            right={<Text style={s.valueText} numberOfLines={1}>{user.email}</Text>}
          />
          <Row
            label="STATUS"
            right={<Text style={s.valueText}>FREE TIER</Text>}
          />
          <TouchableOpacity
            style={s.signOutBtn}
            activeOpacity={0.6}
            onPress={handleSignOut}
          >
            <Text style={s.signOutBtnText}>SIGN OUT</Text>
          </TouchableOpacity>
        </>
      );
    }

    return (
      <View style={s.authContainer}>
        <TextInput
          style={s.authInput}
          value={email}
          onChangeText={(t) => { setEmail(t); setAuthError(''); }}
          placeholder="EMAIL"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          selectionColor={colors.accent}
          returnKeyType="next"
        />
        <TextInput
          style={s.authInput}
          value={password}
          onChangeText={(t) => { setPassword(t); setAuthError(''); }}
          placeholder="PASSWORD"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          selectionColor={colors.accent}
          returnKeyType={authMode === 'signIn' ? 'go' : 'next'}
          onSubmitEditing={authMode === 'signIn' ? handleSignIn : undefined}
        />
        {authMode === 'signUp' && (
          <TextInput
            style={s.authInput}
            value={confirmPassword}
            onChangeText={(t) => { setConfirmPassword(t); setAuthError(''); }}
            placeholder="CONFIRM PASSWORD"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            selectionColor={colors.accent}
            returnKeyType="go"
            onSubmitEditing={handleSignUp}
          />
        )}
        {authError !== '' && (
          <Text style={s.authError}>{authError}</Text>
        )}
        <TouchableOpacity
          style={s.authBtn}
          activeOpacity={0.6}
          onPress={authMode === 'signIn' ? handleSignIn : handleSignUp}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color={colors.accent} size="small" />
          ) : (
            <Text style={s.authBtnText}>
              {authMode === 'signIn' ? 'SIGN IN' : 'CREATE ACCOUNT'}
            </Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.6}
          onPress={() => {
            setAuthMode(authMode === 'signIn' ? 'signUp' : 'signIn');
            setAuthError('');
            setConfirmPassword('');
          }}
          style={s.authToggle}
        >
          <Text style={s.authToggleText}>
            {authMode === 'signIn'
              ? "DON'T HAVE AN ACCOUNT? CREATE ONE"
              : 'ALREADY HAVE AN ACCOUNT? SIGN IN'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

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
        {renderAccountSection()}

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
    flexShrink: 1,
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
  authContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  authInput: {
    fontFamily: fonts.mono,
    fontSize: 12,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: colors.surfaceAlt,
    marginBottom: 8,
  },
  authError: {
    fontFamily: fonts.mono,
    fontSize: 10,
    color: colors.negative,
    marginBottom: 8,
  },
  authBtn: {
    borderWidth: 1,
    borderColor: colors.accent,
    paddingVertical: 10,
    alignItems: 'center',
  },
  authBtnText: {
    fontFamily: fonts.monoSemiBold,
    fontSize: 11,
    color: colors.accent,
    letterSpacing: 1,
  },
  authToggle: {
    marginTop: 10,
    alignItems: 'center',
  },
  authToggleText: {
    fontFamily: fonts.mono,
    fontSize: 9,
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  signOutBtn: {
    marginHorizontal: 16,
    marginTop: 8,
    borderWidth: 1,
    borderColor: colors.accent,
    paddingVertical: 10,
    alignItems: 'center',
  },
  signOutBtnText: {
    fontFamily: fonts.monoSemiBold,
    fontSize: 11,
    color: colors.accent,
    letterSpacing: 1,
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
