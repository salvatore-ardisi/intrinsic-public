import * as dotenv from 'dotenv';
import * as path from 'path';
import type { ExpoConfig, ConfigContext } from 'expo/config';

dotenv.config({ path: path.resolve(__dirname, '.env') });

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Intrinsic',
  slug: 'Intrinsic',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'light',
  newArchEnabled: true,
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#000000',
  },
  ios: {
    bundleIdentifier: 'com.intrinsicmobile.app',
    supportsTablet: true,
    infoPlist: {
      LSApplicationCategoryType: 'public.app-category.finance',
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#000000',
    },
  },
  web: {
    favicon: './assets/favicon.png',
  },
  plugins: ['expo-web-browser', 'expo-font', 'expo-splash-screen', 'expo-status-bar'],
  extra: {
    fredApiKey: process.env.FRED_API_KEY || '',
    blsApiKey: process.env.BLS_API_KEY || '',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    enableAi: process.env.ENABLE_AI === 'true',
    sparkFeedUrl: process.env.SPARK_FEED_URL || '',
    edgarUserAgent: process.env.EDGAR_USER_AGENT || '',
    priceProxyUrl: process.env.PRICE_PROXY_URL || '',
    massiveApiKey: process.env.MASSIVE_API_KEY || '',
    firebaseApiKey: process.env.FIREBASE_API_KEY || '',
    firebaseAuthDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
    firebaseProjectId: process.env.FIREBASE_PROJECT_ID || '',
    firebaseStorageBucket: process.env.FIREBASE_STORAGE_BUCKET || '',
    firebaseMessagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '',
    firebaseAppId: process.env.FIREBASE_APP_ID || '',
  },
});
