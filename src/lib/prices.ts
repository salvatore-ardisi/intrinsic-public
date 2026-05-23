import { PRICE_PROXY_URL } from '../config/env';
import type { Quote, StockProfile, Candle } from './types';

const cache: Record<string, { data: unknown; ts: number }> = {};
const QUOTE_TTL = 60 * 1000;
const PROFILE_TTL = 60 * 60 * 1000;
const CANDLE_TTL = 6 * 60 * 60 * 1000;

function getCached<T>(key: string, ttl: number): T | null {
  const entry = cache[key];
  if (entry && Date.now() - entry.ts < ttl) return entry.data as T;
  return null;
}

function setCache(key: string, data: unknown) {
  cache[key] = { data, ts: Date.now() };
}

export async function getQuote(symbol: string): Promise<Quote | null> {
  const upper = symbol.toUpperCase();
  const cacheKey = `quote_${upper}`;
  const cached = getCached<Quote>(cacheKey, QUOTE_TTL);
  if (cached) return cached;

  try {
    const resp = await fetch(
      `${PRICE_PROXY_URL}/quote?symbol=${encodeURIComponent(upper)}`,
    );
    if (!resp.ok) return null;
    const data: Quote = await resp.json();
    if (data.c === 0 && data.d === 0 && data.dp === 0) return null;
    setCache(cacheKey, data);
    return data;
  } catch {
    return null;
  }
}

export type CandleResult =
  | { status: 'ok'; candle: Candle }
  | { status: 'rate_limited' }
  | { status: 'error' };

export async function getCandle(symbol: string): Promise<CandleResult> {
  const upper = symbol.toUpperCase();
  const cacheKey = `candle_${upper}`;
  const cached = getCached<CandleResult>(cacheKey, CANDLE_TTL);
  if (cached) return cached;

  try {
    const resp = await fetch(
      `${PRICE_PROXY_URL}/candle?symbol=${encodeURIComponent(upper)}`,
    );
    if (resp.status === 429) {
      const result: CandleResult = { status: 'rate_limited' };
      setCache(cacheKey, result);
      return result;
    }
    if (!resp.ok) return { status: 'error' };
    const data = await resp.json();
    if (data.s === 'rate_limited') {
      const result: CandleResult = { status: 'rate_limited' };
      setCache(cacheKey, result);
      return result;
    }
    if (data.s !== 'ok' || !Array.isArray(data.t) || data.t.length === 0) {
      return { status: 'error' };
    }
    const result: CandleResult = { status: 'ok', candle: data as Candle };
    setCache(cacheKey, result);
    return result;
  } catch {
    return { status: 'error' };
  }
}

export function calculateBeta(stockCandles: Candle, marketCandles: Candle): number | null {
  const stockCloses = stockCandles.c;
  const marketCloses = marketCandles.c;
  const len = Math.min(stockCloses.length, marketCloses.length);
  if (len < 31) return null;

  const stockReturns: number[] = [];
  const marketReturns: number[] = [];
  for (let i = 1; i < len; i++) {
    stockReturns.push((stockCloses[i] - stockCloses[i - 1]) / stockCloses[i - 1]);
    marketReturns.push((marketCloses[i] - marketCloses[i - 1]) / marketCloses[i - 1]);
  }

  const n = stockReturns.length;
  let sumS = 0, sumM = 0;
  for (let i = 0; i < n; i++) { sumS += stockReturns[i]; sumM += marketReturns[i]; }
  const meanS = sumS / n;
  const meanM = sumM / n;

  let cov = 0, varM = 0;
  for (let i = 0; i < n; i++) {
    const ds = stockReturns[i] - meanS;
    const dm = marketReturns[i] - meanM;
    cov += ds * dm;
    varM += dm * dm;
  }

  if (varM === 0) return null;
  return Math.round((cov / varM) * 100) / 100;
}

export async function getProfile(symbol: string): Promise<StockProfile | null> {
  const upper = symbol.toUpperCase();
  const cacheKey = `profile_${upper}`;
  const cached = getCached<StockProfile>(cacheKey, PROFILE_TTL);
  if (cached) return cached;

  try {
    const resp = await fetch(
      `${PRICE_PROXY_URL}/profile?symbol=${encodeURIComponent(upper)}`,
    );
    if (!resp.ok) return null;
    const data: StockProfile = await resp.json();
    if (!data.name) return null;
    setCache(cacheKey, data);
    return data;
  } catch {
    return null;
  }
}
