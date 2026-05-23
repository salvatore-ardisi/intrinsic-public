import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  initializeAuth,
  type User,
} from 'firebase/auth';
// @ts-expect-error Metro resolves the RN entry point which exports this, but TS sees the default types
import { getReactNativePersistence } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  FIREBASE_API_KEY,
  FIREBASE_AUTH_DOMAIN,
  FIREBASE_PROJECT_ID,
  FIREBASE_STORAGE_BUCKET,
  FIREBASE_MESSAGING_SENDER_ID,
  FIREBASE_APP_ID,
} from '../config/env';

const firebaseConfig = {
  apiKey: FIREBASE_API_KEY,
  authDomain: FIREBASE_AUTH_DOMAIN,
  projectId: FIREBASE_PROJECT_ID,
  storageBucket: FIREBASE_STORAGE_BUCKET,
  messagingSenderId: FIREBASE_MESSAGING_SENDER_ID,
  appId: FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

const db = getFirestore(app);

// --- Auth ---

export async function signUp(email: string, password: string) {
  return createUserWithEmailAndPassword(auth, email, password);
}

export async function signIn(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function signOut() {
  return firebaseSignOut(auth);
}

export function onAuthChanged(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

// --- Firestore types ---

export interface UserPreferences {
  defaultFloor: string;
}

export interface UserSubscription {
  plan: 'free' | 'pro';
  status: 'active' | 'expired' | 'cancelled';
  expiry: Date | null;
}

export interface UserDocument {
  watchlist: string[];
  preferences: UserPreferences;
  subscription: UserSubscription;
  createdAt: any;
  updatedAt: any;
}

// --- Firestore helpers ---

function userRef(uid: string) {
  return doc(db, 'users', uid);
}

export async function createUserDocument(uid: string, initialWatchlist: string[] = []) {
  await setDoc(userRef(uid), {
    watchlist: initialWatchlist,
    preferences: { defaultFloor: 'stocks' },
    subscription: { plan: 'free', status: 'active', expiry: null },
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function getUserDocument(uid: string): Promise<UserDocument | null> {
  const snap = await getDoc(userRef(uid));
  return snap.exists() ? (snap.data() as UserDocument) : null;
}

export async function updateWatchlist(uid: string, watchlist: string[]) {
  await updateDoc(userRef(uid), {
    watchlist,
    updatedAt: serverTimestamp(),
  });
}

export async function updatePreferences(uid: string, preferences: Partial<UserPreferences>) {
  await updateDoc(userRef(uid), {
    preferences,
    updatedAt: serverTimestamp(),
  });
}

export { auth, db };
export type { User };
