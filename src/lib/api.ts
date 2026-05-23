import { XMLParser } from 'fast-xml-parser';
import {
  FRED_SERIES, BLS_SERIES, FRED_API_KEY, BLS_API_KEY,
  CATEGORY_ORDER, FED_RSS_FEEDS, NEWS_FEEDS, RESEARCH_FEEDS,
} from '../config/series';
import type { SeriesConfig } from '../config/series';
import type { Indicator, CategoryGroup, FedComm, NewsItem, ResearchItem, SparkItem, YieldCurvePoint, Observation, CompanyNewsItem, SparkResponse } from './types';
import { decodeHTMLEntities } from './html';

const cache: Record<string, { data: unknown; ts: number }> = {};
const CACHE_TTL = 5 * 60 * 1000;

function getCached<T>(key: string): T | null {
  const entry = cache[key];
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data as T;
  return null;
}

export function getCachedResearch(): ResearchItem[] | null {
  return getCached<ResearchItem[]>('research');
}

export function getCachedNews(): NewsItem[] | null {
  return getCached<NewsItem[]>('news');
}

function setCache(key: string, data: unknown) {
  cache[key] = { data, ts: Date.now() };
}

function buildIndicator(cfg: SeriesConfig, value: number, prevValue: number | null, date: string): Indicator {
  const rounded = parseFloat(value.toFixed(cfg.decimals));
  const prevRounded = prevValue !== null ? parseFloat(prevValue.toFixed(cfg.decimals)) : null;
  const change = prevRounded !== null ? parseFloat((rounded - prevRounded).toFixed(cfg.decimals)) : null;
  const change_pct = change !== null && prevRounded !== null && prevRounded !== 0
    ? parseFloat(((change / Math.abs(prevRounded)) * 100).toFixed(2))
    : null;
  const direction: Indicator['direction'] =
    change !== null ? (change > 0 ? 'up' : change < 0 ? 'down' : 'flat') : 'flat';

  return {
    series_id: cfg.series_id,
    name: cfg.name,
    category: cfg.category,
    value: rounded,
    previous: prevRounded,
    change,
    change_pct,
    direction,
    unit: cfg.unit,
    frequency: cfg.frequency,
    date,
    invert_sentiment: cfg.invert_sentiment,
    source: cfg.source.toUpperCase(),
  };
}

function errorIndicator(cfg: SeriesConfig, msg: string): Indicator {
  return {
    series_id: cfg.series_id,
    name: cfg.name,
    category: cfg.category,
    value: null,
    previous: null,
    change: null,
    change_pct: null,
    direction: 'flat',
    unit: cfg.unit,
    frequency: cfg.frequency,
    date: null,
    invert_sentiment: cfg.invert_sentiment,
    source: cfg.source.toUpperCase(),
    error: msg,
  };
}

async function fetchFredSeries(cfg: SeriesConfig): Promise<Indicator> {
  try {
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${cfg.series_id}&api_key=${FRED_API_KEY}&file_type=json&limit=2&sort_order=desc`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = await resp.json();
    const obs = (json.observations || []).filter((o: { value: string }) => o.value !== '.');
    if (obs.length === 0) throw new Error('No observations');
    const latest = obs[0];
    const previous = obs.length > 1 ? obs[1] : null;
    return buildIndicator(
      cfg,
      parseFloat(latest.value),
      previous ? parseFloat(previous.value) : null,
      latest.date,
    );
  } catch {
    return errorIndicator(cfg, 'FRED API unavailable');
  }
}

async function fetchBlsSeries(): Promise<Indicator[]> {
  const currentYear = new Date().getFullYear();
  try {
    const resp = await fetch('https://api.bls.gov/publicAPI/v2/timeseries/data/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        seriesid: BLS_SERIES.map(s => s.series_id),
        startyear: String(currentYear - 1),
        endyear: String(currentYear),
        registrationkey: BLS_API_KEY,
      }),
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = await resp.json();
    if (json.status !== 'REQUEST_SUCCEEDED') throw new Error('BLS error');

    const seriesMap: Record<string, Array<{ year: string; period: string; value: string }>> = {};
    for (const s of json.Results?.series || []) {
      seriesMap[s.seriesID] = s.data;
    }

    return BLS_SERIES.map(cfg => {
      const raw = seriesMap[cfg.series_id] || [];
      const monthly = raw
        .filter(d => d.period.startsWith('M') && d.period !== 'M13')
        .sort((a, b) => {
          const ka = `${a.year}${a.period}`;
          const kb = `${b.year}${b.period}`;
          return kb.localeCompare(ka);
        });

      if (monthly.length === 0) return errorIndicator(cfg, 'No BLS data');

      const latest = monthly[0];
      const previous = monthly.length > 1 ? monthly[1] : null;
      const month = parseInt(latest.period.replace('M', ''), 10);
      const dateStr = `${latest.year}-${String(month).padStart(2, '0')}-01`;

      return buildIndicator(
        cfg,
        parseFloat(latest.value),
        previous ? parseFloat(previous.value) : null,
        dateStr,
      );
    });
  } catch {
    return BLS_SERIES.map(cfg => errorIndicator(cfg, 'BLS API unavailable'));
  }
}

function computeYieldSpread(fredResults: Indicator[]): Indicator {
  const dgs10 = fredResults.find(i => i.series_id === 'DGS10');
  const dgs2 = fredResults.find(i => i.series_id === 'DGS2');

  if (!dgs10 || !dgs2 || dgs10.value === null || dgs2.value === null) {
    return {
      series_id: 'YIELD_SPREAD', name: '10Y-2Y Yield Spread', category: 'Interest Rates',
      value: null, previous: null, change: null, change_pct: null, direction: 'flat',
      unit: '%', frequency: 'daily', date: null, invert_sentiment: false, source: 'COMPUTED',
      error: 'Missing DGS10 or DGS2 data',
    };
  }

  const spread = parseFloat((dgs10.value - dgs2.value).toFixed(2));
  const prevSpread = (dgs10.previous !== null && dgs2.previous !== null)
    ? parseFloat((dgs10.previous - dgs2.previous).toFixed(2)) : null;
  const change = prevSpread !== null ? parseFloat((spread - prevSpread).toFixed(2)) : null;
  const change_pct = change !== null && prevSpread !== null && prevSpread !== 0
    ? parseFloat(((change / Math.abs(prevSpread)) * 100).toFixed(2)) : null;
  const direction: Indicator['direction'] =
    change !== null ? (change > 0 ? 'up' : change < 0 ? 'down' : 'flat') : 'flat';

  return {
    series_id: 'YIELD_SPREAD', name: '10Y-2Y Yield Spread', category: 'Interest Rates',
    value: spread, previous: prevSpread, change, change_pct, direction,
    unit: '%', frequency: 'daily', date: dgs10.date, invert_sentiment: false, source: 'COMPUTED',
    dgs10_value: dgs10.value, dgs2_value: dgs2.value,
  };
}

export async function fetchIndicators(force = false): Promise<CategoryGroup[]> {
  const cacheKey = 'indicators';
  if (!force) {
    const cached = getCached<CategoryGroup[]>(cacheKey);
    if (cached) return cached;
  }

  const [fredResults, blsResults] = await Promise.all([
    Promise.all(FRED_SERIES.map(fetchFredSeries)),
    fetchBlsSeries(),
  ]);

  const yieldSpread = computeYieldSpread(fredResults);
  const all: Indicator[] = [...fredResults, ...blsResults, yieldSpread];

  const grouped: Record<string, Indicator[]> = {};
  for (const ind of all) {
    if (!grouped[ind.category]) grouped[ind.category] = [];
    grouped[ind.category].push(ind);
  }

  const categories: CategoryGroup[] = CATEGORY_ORDER
    .filter(cat => grouped[cat])
    .map(cat => ({ name: cat, indicators: grouped[cat] }));

  setCache(cacheKey, categories);
  return categories;
}

export async function fetchYieldCurveHistory(force = false): Promise<YieldCurvePoint[]> {
  const cacheKey = 'yield_curve_history';
  if (!force) {
    const cached = getCached<YieldCurvePoint[]>(cacheKey);
    if (cached) return cached;
  }

  try {
    const endDate = new Date().toISOString().slice(0, 10);
    const startDate = new Date(Date.now() - 5 * 365.25 * 24 * 3600 * 1000).toISOString().slice(0, 10);

    const [resp10, resp2] = await Promise.all([
      fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=DGS10&api_key=${FRED_API_KEY}&file_type=json&observation_start=${startDate}&observation_end=${endDate}&sort_order=asc`),
      fetch(`https://api.stlouisfed.org/fred/series/observations?series_id=DGS2&api_key=${FRED_API_KEY}&file_type=json&observation_start=${startDate}&observation_end=${endDate}&sort_order=asc`),
    ]);

    if (!resp10.ok || !resp2.ok) throw new Error('FRED fetch failed');
    const [json10, json2] = await Promise.all([resp10.json(), resp2.json()]);

    const map2: Record<string, number> = {};
    for (const obs of json2.observations || []) {
      if (obs.value !== '.') map2[obs.date] = parseFloat(obs.value);
    }

    const points: YieldCurvePoint[] = [];
    for (const obs of json10.observations || []) {
      if (obs.value === '.') continue;
      const val2 = map2[obs.date];
      if (val2 === undefined) continue;
      points.push({ date: obs.date, spread: parseFloat((parseFloat(obs.value) - val2).toFixed(2)) });
    }

    setCache(cacheKey, points);
    return points;
  } catch {
    return [];
  }
}

export async function fetchSeriesHistory(seriesId: string, force = false): Promise<Observation[]> {
  const cacheKey = `history_${seriesId}`;
  if (!force) {
    const cached = getCached<Observation[]>(cacheKey);
    if (cached) return cached;
  }

  try {
    const endDate = new Date().toISOString().slice(0, 10);
    const startDate = new Date(Date.now() - 3 * 365.25 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const url = `https://api.stlouisfed.org/fred/series/observations?series_id=${seriesId}&api_key=${FRED_API_KEY}&file_type=json&observation_start=${startDate}&observation_end=${endDate}&sort_order=asc`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = await resp.json();
    const observations: Observation[] = [];
    for (const obs of json.observations || []) {
      if (obs.value === '.') continue;
      observations.push({ date: obs.date, value: parseFloat(obs.value) });
    }
    setCache(cacheKey, observations);
    return observations;
  } catch {
    return [];
  }
}

function classifyFedComm(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes('fomc statement') || lower.includes('federal open market')) return 'FOMC';
  if (lower.includes('minutes')) return 'MINUTES';
  if (lower.includes('projection') || lower.includes('summary of economic')) return 'PROJECTIONS';
  if (lower.includes('speech') || lower.includes('testimony')) return 'SPEECH';
  return 'OTHER';
}

function parseRssDate(dateStr: string): string | null {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch {
    return null;
  }
}

const xmlParser = new XMLParser({ ignoreAttributes: true, trimValues: true });

export async function fetchFedComms(force = false): Promise<FedComm[]> {
  const cacheKey = 'fedcomms';
  if (!force) {
    const cached = getCached<FedComm[]>(cacheKey);
    if (cached) return cached;
  }

  const items: FedComm[] = [];

  await Promise.all(FED_RSS_FEEDS.map(async (feed) => {
    try {
      const resp = await fetch(feed.url);
      if (!resp.ok) return;
      const text = await resp.text();
      const parsed = xmlParser.parse(text);
      const rssItems = parsed?.rss?.channel?.item || parsed?.feed?.entry || [];
      const arr = Array.isArray(rssItems) ? rssItems : [rssItems];

      for (const item of arr) {
        const title = (item.title || '').toString().trim();
        if (!title) continue;
        items.push({
          title,
          link: (item.link || '').toString().trim(),
          date: parseRssDate(item.pubDate || item.published || item.updated || ''),
          summary: (item.description || item.summary || '').toString().trim(),
          type: classifyFedComm(title),
          feed: feed.type,
        });
      }
    } catch { /* skip failed feeds */ }
  }));

  items.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  setCache(cacheKey, items);
  return items;
}

export async function fetchResearch(force = false): Promise<ResearchItem[]> {
  const cacheKey = 'research';
  if (!force) {
    const cached = getCached<ResearchItem[]>(cacheKey);
    if (cached) return cached;
  }

  const items: ResearchItem[] = [];

  await Promise.all(RESEARCH_FEEDS.map(async (feed) => {
    try {
      const resp = await fetch(feed.url);
      if (!resp.ok) return;
      const text = await resp.text();
      const parsed = xmlParser.parse(text);
      const rssItems = parsed?.rss?.channel?.item || parsed?.feed?.entry || [];
      const arr = Array.isArray(rssItems) ? rssItems : [rssItems];

      for (const item of arr) {
        const title = (item.title || '').toString().trim();
        if (!title) continue;
        items.push({
          title,
          link: (item.link || '').toString().trim(),
          date: parseRssDate(item.pubDate || item.published || item.updated || ''),
          description: (item.description || item.summary || item['content:encoded'] || '').toString().trim(),
          source: feed.source,
          feedName: feed.name,
        });
      }
    } catch { /* skip failed feeds */ }
  }));

  items.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  setCache(cacheKey, items);
  return items;
}

export async function fetchNews(force = false): Promise<NewsItem[]> {
  const cacheKey = 'news';
  if (!force) {
    const cached = getCached<NewsItem[]>(cacheKey);
    if (cached) return cached;
  }

  const items: NewsItem[] = [];
  const seenTitles = new Set<string>();

  await Promise.all(NEWS_FEEDS.map(async (feed) => {
    try {
      const resp = await fetch(feed.url);
      if (!resp.ok) return;
      const text = await resp.text();
      const parsed = xmlParser.parse(text);
      const rssItems = parsed?.rss?.channel?.item || parsed?.feed?.entry || [];
      const arr = Array.isArray(rssItems) ? rssItems : [rssItems];

      for (const item of arr) {
        const title = (item.title || '').toString().trim();
        if (!title || seenTitles.has(title.toLowerCase())) continue;
        seenTitles.add(title.toLowerCase());

        items.push({
          title,
          link: (item.link || '').toString().trim(),
          date: parseRssDate(item.pubDate || item.published || item.updated || ''),
          source: feed.name,
        });
      }
    } catch { /* skip failed feeds */ }
  }));

  items.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  setCache(cacheKey, items);
  return items;
}

export async function fetchDailySpark(force = false): Promise<SparkResponse | null> {
  const cacheKey = 'daily_spark';
  if (!force) {
    const entry = cache[cacheKey];
    if (entry && Date.now() - entry.ts < 30 * 60 * 1000) return entry.data as SparkResponse;
  }

  const { PRICE_PROXY_URL } = await import('../config/env');
  if (!PRICE_PROXY_URL) return null;

  try {
    const resp = await fetch(`${PRICE_PROXY_URL}/spark`);
    if (!resp.ok) return null;
    const json = await resp.json();
    if (json.error) return null;

    const data: SparkResponse = {
      date: decodeHTMLEntities(json.date ?? ''),
      title: decodeHTMLEntities(json.title ?? ''),
      body: decodeHTMLEntities(json.body ?? ''),
      sources: json.sources ? decodeHTMLEntities(json.sources) : null,
      chartImageUrl: json.chartImageUrl ?? null,
      apolloLinks: Array.isArray(json.apolloLinks) ? json.apolloLinks : [],
      fetchedAt: json.fetchedAt ?? new Date().toISOString(),
    };

    cache[cacheKey] = { data, ts: Date.now() };
    return data;
  } catch {
    return null;
  }
}

export async function fetchSpark(force = false): Promise<SparkItem[]> {
  const { SPARK_FEED_URL } = await import('../config/env');
  if (!SPARK_FEED_URL) return [];

  const cacheKey = 'spark';
  if (!force) {
    const cached = getCached<SparkItem[]>(cacheKey);
    if (cached) return cached;
  }

  try {
    const resp = await fetch(SPARK_FEED_URL);
    if (!resp.ok) return [];
    const text = await resp.text();
    const parsed = xmlParser.parse(text);
    const rssItems = parsed?.rss?.channel?.item || parsed?.feed?.entry || [];
    const arr = Array.isArray(rssItems) ? rssItems : [rssItems];

    const items: SparkItem[] = [];
    for (const item of arr) {
      const title = (item.title || '').toString().trim();
      if (!title) continue;

      let imageUrl: string | null = null;
      const desc = (item.description || item.summary || item['content:encoded'] || '').toString();
      const imgMatch = desc.match(/<img[^>]+src=["']([^"']+)["']/);
      if (imgMatch) imageUrl = imgMatch[1];
      if (!imageUrl && item.enclosure) {
        const enc = typeof item.enclosure === 'string' ? item.enclosure : (item.enclosure?.url || '');
        if (enc) imageUrl = enc;
      }

      items.push({
        title,
        link: (item.link || '').toString().trim(),
        date: parseRssDate(item.pubDate || item.published || item.updated || ''),
        description: desc.trim(),
        imageUrl,
        source: 'DAILY SPARK',
        feedName: 'DAILY SPARK',
      });
    }

    items.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    setCache(cacheKey, items);
    return items;
  } catch {
    return [];
  }
}

const SUMMARY_CACHE_TTL = 30 * 60 * 1000;

export async function generateMacroSummary(indicators: Indicator[]): Promise<string> {
  const cacheKey = 'macro_summary';
  const entry = cache[cacheKey];
  if (entry && Date.now() - entry.ts < SUMMARY_CACHE_TTL) return entry.data as string;

  const { ANTHROPIC_API_KEY } = await import('../config/env');
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured');

  const indicatorLines = indicators.map(ind => {
    const dir = ind.direction === 'up' ? '▲' : ind.direction === 'down' ? '▼' : '◆';
    const val = ind.value !== null ? `${ind.value}${ind.unit === '%' ? '%' : ''}` : 'N/A';
    const chg = ind.change !== null ? ` (${ind.change > 0 ? '+' : ''}${ind.change})` : '';
    return `${ind.name} (${ind.series_id}): ${val}${chg} ${dir}`;
  }).join('\n');

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: 'You are a macroeconomic analyst. Given the current values of key U.S. economic indicators, provide a concise 3-4 sentence synthesis of current economic conditions. Be specific with numbers. Note any tensions between indicators (e.g. strong employment but rising inflation). Flag any warning signals. Do not give investment advice. Do not use markdown formatting, asterisks, bold, headers, or bullet points. Use plain text only. Use line breaks to separate sections.',
      messages: [{ role: 'user', content: indicatorLines }],
    }),
  });

  if (!resp.ok) throw new Error(`Anthropic API ${resp.status}`);
  const json = await resp.json();
  const text = json.content?.[0]?.text ?? 'No summary generated.';

  setCache(cacheKey, text);
  return text;
}

export function clearMacroSummaryCache() {
  delete cache['macro_summary'];
}

const SPARK_INTERP_TTL = 60 * 60 * 1000;

export async function generateSparkInterpretation(title: string, body: string, sources?: string | null): Promise<string> {
  const cacheKey = `spark_interp_${title}`;
  const entry = cache[cacheKey];
  if (entry && Date.now() - entry.ts < SPARK_INTERP_TTL) return entry.data as string;

  const { ANTHROPIC_API_KEY } = await import('../config/env');
  if (!ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not configured');

  const userContent = `Title: ${title}\n\n${body}${sources ? `\n\nSources: ${sources}` : ''}`;

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 300,
      system: 'You are a macro analyst. Analyze this Daily Spark insight from Apollo\'s Chief Economist. Keep it concise and factual. No predictions, no hype, no investment advice. Do not use markdown formatting, asterisks, bold, headers, or bullet points. Use plain text only. Use line breaks to separate sections. Label sections as MARKET INTERPRETATION, WHY THIS MATTERS, and WHAT TO WATCH on their own lines.',
      messages: [{ role: 'user', content: userContent }],
    }),
  });

  if (!resp.ok) throw new Error(`Anthropic API ${resp.status}`);
  const json = await resp.json();
  const text = json.content?.[0]?.text ?? 'No interpretation generated.';

  setCache(cacheKey, text);
  return text;
}

const COMPANY_NEWS_TTL = 15 * 60 * 1000;
const COMPANY_NEWS_PER_TICKER = 10;

async function fetchTickerNews(ticker: string): Promise<CompanyNewsItem[]> {
  const upper = ticker.toUpperCase();
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(upper)}+stock&hl=en-US&gl=US&ceid=US:en`;

  try {
    const resp = await fetch(url);
    if (!resp.ok) return [];
    const text = await resp.text();
    const parsed = xmlParser.parse(text);
    const rssItems = parsed?.rss?.channel?.item || [];
    const arr = Array.isArray(rssItems) ? rssItems : [rssItems];

    const items: CompanyNewsItem[] = [];
    for (const item of arr) {
      if (items.length >= COMPANY_NEWS_PER_TICKER) break;
      const title = (item.title || '').toString().trim();
      if (!title) continue;
      items.push({
        ticker: upper,
        title: decodeHTMLEntities(title),
        link: (item.link || '').toString().trim(),
        date: parseRssDate(item.pubDate || ''),
        source: (item.source || '').toString().trim(),
      });
    }
    return items;
  } catch {
    return [];
  }
}

export async function fetchCompanyNews(tickers: string[], force = false): Promise<CompanyNewsItem[]> {
  const cacheKey = `company_news_${tickers.map(t => t.toUpperCase()).sort().join(',')}`;
  if (!force) {
    const entry = cache[cacheKey];
    if (entry && Date.now() - entry.ts < COMPANY_NEWS_TTL) return entry.data as CompanyNewsItem[];
  }

  const results = await Promise.allSettled(tickers.map(t => fetchTickerNews(t)));
  const all: CompanyNewsItem[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') all.push(...r.value);
  }

  const seen = new Map<string, CompanyNewsItem>();
  for (const item of all) {
    const key = item.title.toLowerCase();
    if (!seen.has(key)) {
      seen.set(key, item);
    } else {
      const existing = seen.get(key)!;
      if (!existing.ticker.includes(item.ticker)) {
        existing.ticker = `${existing.ticker},${item.ticker}`;
      }
    }
  }

  const deduped = Array.from(seen.values());
  deduped.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  setCache(cacheKey, deduped);
  return deduped;
}
