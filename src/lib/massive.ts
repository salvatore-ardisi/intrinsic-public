import { PRICE_PROXY_URL } from '../config/env';
import type { TickerDetails, Dividend, MarketMover } from './types';

const cache: Record<string, { data: unknown; ts: number }> = {};
const DETAILS_TTL = 24 * 60 * 60 * 1000;
const DIVIDENDS_TTL = 24 * 60 * 60 * 1000;
const RELATED_TTL = 24 * 60 * 60 * 1000;
const MOVERS_TTL = 5 * 60 * 1000;
const PREV_TTL = 12 * 60 * 60 * 1000;

function getCached<T>(key: string, ttl: number): T | null {
  const entry = cache[key];
  if (entry && Date.now() - entry.ts < ttl) return entry.data as T;
  return null;
}

function setCache(key: string, data: unknown) {
  cache[key] = { data, ts: Date.now() };
}

export async function getTickerDetails(ticker: string): Promise<TickerDetails | null> {
  const upper = ticker.toUpperCase();
  const cacheKey = `td_${upper}`;
  const cached = getCached<TickerDetails>(cacheKey, DETAILS_TTL);
  if (cached) return cached;

  try {
    const resp = await fetch(
      `${PRICE_PROXY_URL}/ticker-details?symbol=${encodeURIComponent(upper)}`,
    );
    if (!resp.ok) return null;
    const data: TickerDetails = await resp.json();
    if (!data.name) return null;
    setCache(cacheKey, data);
    return data;
  } catch {
    return null;
  }
}

export async function getRelatedTickers(ticker: string): Promise<string[]> {
  const upper = ticker.toUpperCase();
  const cacheKey = `rel_${upper}`;
  const cached = getCached<string[]>(cacheKey, RELATED_TTL);
  if (cached) return cached;

  try {
    const resp = await fetch(
      `${PRICE_PROXY_URL}/related?symbol=${encodeURIComponent(upper)}`,
    );
    if (!resp.ok) return [];
    const data = await resp.json();
    const results: string[] = Array.isArray(data.results) ? data.results : [];
    setCache(cacheKey, results);
    return results;
  } catch {
    return [];
  }
}

export async function getMarketMovers(direction: 'gainers' | 'losers'): Promise<MarketMover[]> {
  const cacheKey = `movers_${direction}`;
  const cached = getCached<MarketMover[]>(cacheKey, MOVERS_TTL);
  if (cached) return cached;

  try {
    const resp = await fetch(
      `${PRICE_PROXY_URL}/movers?direction=${encodeURIComponent(direction)}`,
    );
    if (!resp.ok) return [];
    const data = await resp.json();
    const results: MarketMover[] = Array.isArray(data.results) ? data.results : [];
    setCache(cacheKey, results);
    return results;
  } catch {
    return [];
  }
}

export interface PrevDayBar {
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export async function getPrevDayBar(ticker: string): Promise<PrevDayBar | null> {
  const upper = ticker.toUpperCase();
  const cacheKey = `prev_${upper}`;
  const cached = getCached<PrevDayBar>(cacheKey, PREV_TTL);
  if (cached) return cached;

  try {
    const resp = await fetch(
      `${PRICE_PROXY_URL}/prev?symbol=${encodeURIComponent(upper)}`,
    );
    if (!resp.ok) return null;
    const data: PrevDayBar = await resp.json();
    setCache(cacheKey, data);
    return data;
  } catch {
    return null;
  }
}

export async function getDividends(ticker: string): Promise<Dividend[]> {
  const upper = ticker.toUpperCase();
  const cacheKey = `div_${upper}`;
  const cached = getCached<Dividend[]>(cacheKey, DIVIDENDS_TTL);
  if (cached) return cached;

  try {
    const resp = await fetch(
      `${PRICE_PROXY_URL}/dividends?symbol=${encodeURIComponent(upper)}`,
    );
    if (!resp.ok) return [];
    const data = await resp.json();
    const results: Dividend[] = Array.isArray(data.results) ? data.results : [];
    setCache(cacheKey, results);
    return results;
  } catch {
    return [];
  }
}
