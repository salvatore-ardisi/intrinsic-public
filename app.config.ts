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
  plugins: ['expo-web-browser', 'expo-font'],
  extra: {
    fredApiKey: process.env.FRED_API_KEY || '',
    blsApiKey: process.env.BLS_API_KEY || '',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
    enableAi: process.env.ENABLE_AI === 'true',
    sparkFeedUrl: process.env.SPARK_FEED_URL || '',
    edgarUserAgent: process.env.EDGAR_USER_AGENT || '',
    priceProxyUrl: process.env.PRICE_PROXY_URL || '',
  },
});
