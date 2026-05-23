export interface AuctionResult {
  cusip: string;
  securityType: string;
  securityTerm: string;
  auctionDate: string;
  highYield: string | null;
  bidToCoverRatio: string | null;
  totalAccepted: number | null;
  announcementDate: string | null;
}

const cache: Record<string, { data: unknown; ts: number }> = {};
const CACHE_TTL = 15 * 60 * 1000;

function getCached<T>(key: string): T | null {
  const entry = cache[key];
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data as T;
  return null;
}

function setCache(key: string, data: unknown) {
  cache[key] = { data, ts: Date.now() };
}

const TYPE_MAP: Record<string, string> = {
  ALL: '',
  BILLS: 'Bill',
  NOTES: 'Note',
  BONDS: 'Bond',
  TIPS: 'TIPS',
  FRN: 'FRN',
};

function buildUrl(endpoint: string, type: string): string {
  const base = `https://www.treasurydirect.gov/TA_WS/securities/${endpoint}?format=json&pagesize=50`;
  const mapped = TYPE_MAP[type] || '';
  return mapped ? `${base}&type=${mapped}` : base;
}

function parseAuction(item: Record<string, unknown>): AuctionResult {
  const totalAccepted = item.totalAccepted;
  return {
    cusip: String(item.cusip || ''),
    securityType: String(item.securityType || ''),
    securityTerm: String(item.securityTerm || ''),
    auctionDate: String(item.auctionDate || ''),
    highYield: item.highYield ? String(item.highYield) : null,
    bidToCoverRatio: item.bidToCoverRatio ? String(item.bidToCoverRatio) : null,
    totalAccepted: typeof totalAccepted === 'number' ? totalAccepted
      : typeof totalAccepted === 'string' && totalAccepted ? parseFloat(totalAccepted) : null,
    announcementDate: item.announcementDate ? String(item.announcementDate) : null,
  };
}

export async function fetchUpcomingAuctions(type = 'ALL', force = false): Promise<AuctionResult[]> {
  const cacheKey = `upcoming_${type}`;
  if (!force) {
    const cached = getCached<AuctionResult[]>(cacheKey);
    if (cached) return cached;
  }

  try {
    const resp = await fetch(buildUrl('announced', type), {
      headers: { 'User-Agent': 'Intrinsic/1.0' },
    });
    if (!resp.ok) return [];
    const json = await resp.json();
    const items = Array.isArray(json) ? json : [];
    const results = items.map(parseAuction);
    setCache(cacheKey, results);
    return results;
  } catch {
    return [];
  }
}

export async function fetchAuctionResults(type = 'ALL', force = false): Promise<AuctionResult[]> {
  const cacheKey = `auctioned_${type}`;
  if (!force) {
    const cached = getCached<AuctionResult[]>(cacheKey);
    if (cached) return cached;
  }

  try {
    const resp = await fetch(buildUrl('auctioned', type), {
      headers: { 'User-Agent': 'Intrinsic/1.0' },
    });
    if (!resp.ok) return [];
    const json = await resp.json();
    const items = Array.isArray(json) ? json : [];
    const results = items.map(parseAuction);
    setCache(cacheKey, results);
    return results;
  } catch {
    return [];
  }
}
