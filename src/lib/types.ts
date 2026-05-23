export interface Indicator {
  series_id: string;
  name: string;
  category: string;
  value: number | null;
  previous: number | null;
  change: number | null;
  change_pct: number | null;
  direction: 'up' | 'down' | 'flat';
  unit: string;
  frequency: string;
  date: string | null;
  invert_sentiment: boolean;
  source: string;
  error?: string;
  dgs10_value?: number;
  dgs2_value?: number;
}

export interface CategoryGroup {
  name: string;
  indicators: Indicator[];
}

export interface FedComm {
  title: string;
  link: string;
  date: string | null;
  summary: string;
  type: string;
  feed: string;
}

export interface NewsItem {
  title: string;
  link: string;
  date: string | null;
  source: string;
  description?: string;
}

export interface ResearchItem {
  title: string;
  link: string;
  date: string | null;
  description: string;
  source: string;
  feedName: string;
}

export interface SparkItem {
  title: string;
  link: string;
  date: string | null;
  description: string;
  imageUrl: string | null;
  source: string;
  feedName: string;
}

export interface Observation {
  date: string;
  value: number;
}

export interface YieldCurvePoint {
  date: string;
  spread: number;
}

export interface Filing {
  form: string;
  filingDate: string;
  accessionNumber: string;
  primaryDocument: string;
  reportDate: string;
  documentUrl: string;
}

export interface TickerEntry {
  cik: number;
  ticker: string;
  title: string;
}

export interface SparkResponse {
  date: string;
  title: string;
  body: string;
  sources: string | null;
  chartImageUrl: string | null;
  apolloLinks: Array<{ title: string; url: string }>;
  fetchedAt: string;
}

export interface CompanyNewsItem {
  ticker: string;
  title: string;
  link: string;
  date: string | null;
  source: string;
}

export interface Quote {
  c: number;
  d: number;
  dp: number;
  h: number;
  l: number;
  o: number;
  pc: number;
  t: number;
}

export interface StockProfile {
  name: string;
  ticker: string;
  exchange: string;
  finnhubIndustry: string;
  marketCapitalization: number;
  ipo: string;
  logo: string;
  weburl: string;
}

export interface TickerDetails {
  name: string;
  market_cap: number | null;
  description: string | null;
  homepage_url: string | null;
  locale: string | null;
  sic_description: string | null;
  branding: { logo_url: string; icon_url: string } | null;
  cik: string | null;
  share_class_shares_outstanding: number | null;
  total_employees: number | null;
  list_date: string | null;
  primary_exchange: string | null;
}

export interface Dividend {
  ex_dividend_date: string | null;
  cash_amount: number | null;
  frequency: number | null;
  pay_date: string | null;
  declaration_date: string | null;
}

export interface MarketMover {
  ticker: string;
  price: number | null;
  change: number | null;
  change_percent: number | null;
  volume: number | null;
}

export interface Candle {
  s: string;
  t: number[];
  o: number[];
  h: number[];
  l: number[];
  c: number[];
}
