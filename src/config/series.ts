export interface SeriesConfig {
  series_id: string;
  name: string;
  category: string;
  unit: string;
  frequency: string;
  invert_sentiment: boolean;
  decimals: number;
  source: 'fred' | 'bls';
}

export const FRED_SERIES: SeriesConfig[] = [
  { series_id: 'UNRATE', name: 'Unemployment Rate', category: 'Labor Market', unit: '%', frequency: 'monthly', invert_sentiment: true, decimals: 1, source: 'fred' },
  { series_id: 'CPIAUCSL', name: 'CPI (All Urban)', category: 'Inflation', unit: 'index', frequency: 'monthly', invert_sentiment: true, decimals: 1, source: 'fred' },
  { series_id: 'PCEPI', name: 'PCE Price Index', category: 'Inflation', unit: 'index', frequency: 'monthly', invert_sentiment: true, decimals: 1, source: 'fred' },
  { series_id: 'T10YIE', name: '10Y Breakeven Inflation', category: 'Inflation', unit: '%', frequency: 'daily', invert_sentiment: true, decimals: 2, source: 'fred' },
  { series_id: 'GDPC1', name: 'Real GDP', category: 'Growth', unit: 'B$', frequency: 'quarterly', invert_sentiment: false, decimals: 1, source: 'fred' },
  { series_id: 'FEDFUNDS', name: 'Fed Funds Rate', category: 'Interest Rates', unit: '%', frequency: 'monthly', invert_sentiment: false, decimals: 2, source: 'fred' },
  { series_id: 'DGS10', name: '10Y Treasury Yield', category: 'Interest Rates', unit: '%', frequency: 'daily', invert_sentiment: false, decimals: 2, source: 'fred' },
  { series_id: 'DGS2', name: '2Y Treasury Yield', category: 'Interest Rates', unit: '%', frequency: 'daily', invert_sentiment: false, decimals: 2, source: 'fred' },
  { series_id: 'MORTGAGE30US', name: '30Y Mortgage Rate', category: 'Interest Rates', unit: '%', frequency: 'weekly', invert_sentiment: true, decimals: 2, source: 'fred' },
];

export const BLS_SERIES: SeriesConfig[] = [
  { series_id: 'CES0000000001', name: 'Nonfarm Payrolls', category: 'Labor Market', unit: 'K', frequency: 'monthly', invert_sentiment: false, decimals: 0, source: 'bls' },
  { series_id: 'LNS11300000', name: 'Labor Force Participation', category: 'Labor Market', unit: '%', frequency: 'monthly', invert_sentiment: false, decimals: 1, source: 'bls' },
];

export const ALL_SERIES: SeriesConfig[] = [...FRED_SERIES, ...BLS_SERIES];

export const CATEGORY_ORDER = ['Labor Market', 'Inflation', 'Growth', 'Interest Rates'];

export const FRED_CHART_MAP: Record<string, string> = {
  CES0000000001: 'PAYEMS',
  LNS11300000: 'CIVPART',
};

export const SERIES_CHART_MAP: Record<string, string> = {
  UNRATE: 'macro-pulse',
  FEDFUNDS: 'macro-pulse',
  CES0000000001: 'macro-pulse',
  LNS11300000: 'macro-pulse',
  CPIAUCSL: 'inflation-policy',
  PCEPI: 'inflation-policy',
  T10YIE: 'inflation-policy',
  GDPC1: 'inflation-policy',
  DGS10: 'rates-transmission',
  MORTGAGE30US: 'rates-transmission',
  DGS2: 'yield-curve',
  YIELD_SPREAD: 'yield-curve',
};

export const CHART_SERIES: Record<string, string[]> = {
  'macro-pulse': ['UNRATE', 'FEDFUNDS'],
  'inflation-policy': ['CPIAUCSL', 'FEDFUNDS'],
  'rates-transmission': ['DGS10', 'MORTGAGE30US'],
  'yield-curve': ['DGS10', 'DGS2', 'YIELD_SPREAD'],
};

export { FRED_API_KEY, BLS_API_KEY } from './env';

export const FED_RSS_FEEDS = [
  { url: 'https://www.federalreserve.gov/feeds/press_monetary.xml', type: 'monetary' },
  { url: 'https://www.federalreserve.gov/feeds/press_other.xml', type: 'other' },
];

export const RESEARCH_FEEDS = [
  { name: 'FRED BLOG', url: 'https://fredblog.stlouisfed.org/feed/', source: 'FRED BLOG' as const },
  { name: 'BLS JOBS', url: 'https://www.bls.gov/feed/empsit.rss', source: 'BLS' as const },
  { name: 'BLS CPI', url: 'https://www.bls.gov/feed/cpi.rss', source: 'BLS' as const },
  { name: 'BLS ALL', url: 'https://www.bls.gov/feed/bls_latest.rss', source: 'BLS' as const },
];

export const NEWS_FEEDS = [
  { name: 'CNBC', url: 'https://www.cnbc.com/id/20910258/device/rss/rss.html' },
  { name: 'Bloomberg', url: 'https://feeds.bloomberg.com/markets/news.rss' },
  { name: 'FT', url: 'https://www.ft.com/markets?format=rss' },
  { name: 'Yahoo Finance', url: 'https://feeds.finance.yahoo.com/rss/2906723' },
];

export const EXPLAINERS: Record<string, string> = {
  UNRATE: 'The unemployment rate is the percentage of the labor force that is jobless and actively seeking employment. It is the most widely watched indicator of labor market health. Rising unemployment signals economic weakness; falling unemployment signals strength, but very low levels can signal overheating and wage pressure.',
  CES0000000001: 'Total nonfarm payrolls is the count of all jobs in the U.S. economy excluding farm workers. The month-over-month change is the headline number from the monthly jobs report and is often the single most market-moving economic data release.',
  LNS11300000: 'The labor force participation rate is the share of the working-age population either employed or actively looking for work. A declining rate can mean workers are discouraged and dropping out of the labor force, which masks true unemployment.',
  CPIAUCSL: 'The Consumer Price Index tracks the average change in prices paid by urban consumers for a basket of goods and services. It is the most commonly cited measure of inflation and directly affects cost-of-living adjustments, wage negotiations, and Fed policy decisions.',
  PCEPI: 'The Personal Consumption Expenditures Price Index is the Federal Reserve preferred inflation measure. Unlike CPI, it accounts for consumers substituting cheaper alternatives when prices rise, making it a more comprehensive inflation gauge.',
  T10YIE: 'The 10-year breakeven inflation rate represents the market expectation for average annual inflation over the next decade. It is derived from the spread between nominal Treasury yields and TIPS. Rising breakevens signal the bond market expects higher inflation ahead.',
  GDPC1: 'Real Gross Domestic Product is the inflation-adjusted value of all goods and services produced in the U.S. It is the broadest measure of economic output and the official benchmark for determining whether the economy is in recession (commonly cited as a recession signal, though the NBER uses broader criteria to make the official call).',
  FEDFUNDS: 'The effective federal funds rate is the interest rate banks charge each other for overnight lending. It is the primary tool the Federal Reserve uses to implement monetary policy. Changes ripple through every interest rate in the economy, from mortgages to corporate bonds to savings accounts.',
  DGS10: 'The 10-year Treasury yield is the benchmark interest rate for the U.S. economy. It directly influences mortgage rates, corporate borrowing costs, and stock valuations. It also reflects market expectations about future growth and inflation.',
  DGS2: 'The 2-year Treasury yield reflects market expectations for Fed policy over the next two years. It moves more directly with expected Fed rate changes than the 10-year, making it a purer read on near-term monetary policy expectations.',
  MORTGAGE30US: 'The 30-year fixed mortgage rate is the average rate offered to homebuyers for a standard 30-year loan. It is the most important rate for the housing market and is closely tied to the 10-year Treasury yield.',
  YIELD_SPREAD: 'The spread between 10-year and 2-year Treasury yields is the most-discussed recession predictor in finance. When the spread goes negative (inverts), it means short-term rates exceed long-term rates - a signal that markets expect economic weakness ahead. An inverted yield curve has preceded every U.S. recession since 1955, though the lead time varies from 6 to 24 months.',
};
