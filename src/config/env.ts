import Constants from 'expo-constants';

const extra = Constants.expoConfig?.extra ?? {};

export const FRED_API_KEY: string = extra.fredApiKey ?? '';
export const BLS_API_KEY: string = extra.blsApiKey ?? '';
export const ANTHROPIC_API_KEY: string = extra.anthropicApiKey ?? '';
export const ENABLE_AI: boolean = extra.enableAi ?? false;
export const SPARK_FEED_URL: string = extra.sparkFeedUrl ?? '';
export const EDGAR_USER_AGENT: string = extra.edgarUserAgent || '';
export const PRICE_PROXY_URL: string = extra.priceProxyUrl || '';
export const MASSIVE_API_KEY: string = extra.massiveApiKey || '';
export const FIREBASE_API_KEY: string = extra.firebaseApiKey || '';
export const FIREBASE_AUTH_DOMAIN: string = extra.firebaseAuthDomain || '';
export const FIREBASE_PROJECT_ID: string = extra.firebaseProjectId || '';
export const FIREBASE_STORAGE_BUCKET: string = extra.firebaseStorageBucket || '';
export const FIREBASE_MESSAGING_SENDER_ID: string = extra.firebaseMessagingSenderId || '';
export const FIREBASE_APP_ID: string = extra.firebaseAppId || '';
