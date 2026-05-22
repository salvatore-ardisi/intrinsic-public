import { EDGAR_USER_AGENT } from '../config/env';
import type { Filing, TickerEntry } from './types';

const cache: Record<string, { data: unknown; ts: number }> = {};
const TICKER_MAP_TTL = 60 * 60 * 1000;
const SUBMISSIONS_TTL = 5 * 60 * 1000;

function getCached<T>(key: string, ttl: number): T | null {
  const entry = cache[key];
  if (entry && Date.now() - entry.ts < ttl) return entry.data as T;
  return null;
}

function setCache(key: string, data: unknown) {
  cache[key] = { data, ts: Date.now() };
}

async function edgarFetch(url: string): Promise<Response> {
  return fetch(url, {
    headers: { 'User-Agent': EDGAR_USER_AGENT, Accept: 'application/json' },
  });
}

type TickerMap = Record<string, TickerEntry>;

export async function loadTickerMap(): Promise<TickerMap> {
  const cacheKey = 'edgar_ticker_map';
  const cached = getCached<TickerMap>(cacheKey, TICKER_MAP_TTL);
  if (cached) return cached;

  const resp = await edgarFetch('https://www.sec.gov/files/company_tickers.json');
  if (!resp.ok) throw new Error(`Ticker map HTTP ${resp.status}`);
  const raw: Record<string, { cik_str: number; ticker: string; title: string }> = await resp.json();

  const map: TickerMap = {};
  for (const entry of Object.values(raw)) {
    map[entry.ticker.toUpperCase()] = {
      cik: entry.cik_str,
      ticker: entry.ticker.toUpperCase(),
      title: entry.title,
    };
  }

  setCache(cacheKey, map);
  return map;
}

export async function resolveCik(
  ticker: string,
): Promise<{ cik: string; title: string } | null> {
  const map = await loadTickerMap();
  const entry = map[ticker.toUpperCase()];
  if (!entry) return null;
  return {
    cik: String(entry.cik).padStart(10, '0'),
    title: entry.title,
  };
}

export async function getFilings(cik: string): Promise<Filing[]> {
  const cacheKey = `edgar_filings_${cik}`;
  const cached = getCached<Filing[]>(cacheKey, SUBMISSIONS_TTL);
  if (cached) return cached;

  const resp = await edgarFetch(
    `https://data.sec.gov/submissions/CIK${cik}.json`,
  );
  if (!resp.ok) throw new Error(`Submissions HTTP ${resp.status}`);
  const json = await resp.json();

  const recent = json?.filings?.recent;
  if (!recent) return [];

  const cikNoZeros = String(parseInt(cik, 10));
  const forms: string[] = recent.form ?? [];
  const dates: string[] = recent.filingDate ?? [];
  const accessions: string[] = recent.accessionNumber ?? [];
  const docs: string[] = recent.primaryDocument ?? [];
  const reportDates: string[] = recent.reportDate ?? [];

  const count = Math.min(forms.length, dates.length, accessions.length, docs.length);
  const filings: Filing[] = [];

  for (let i = 0; i < count; i++) {
    const accNoDashes = accessions[i].replace(/-/g, '');
    filings.push({
      form: forms[i],
      filingDate: dates[i],
      accessionNumber: accessions[i],
      primaryDocument: docs[i],
      reportDate: reportDates[i] ?? '',
      documentUrl: `https://www.sec.gov/Archives/edgar/data/${cikNoZeros}/${accNoDashes}/${docs[i]}`,
    });
  }

  setCache(cacheKey, filings);
  return filings;
}
