import { EDGAR_USER_AGENT } from '../config/env';
import { resolveCik } from './edgar';

const factsCache: Record<string, { data: CompanyFacts; ts: number }> = {};
const FACTS_TTL = 24 * 60 * 60 * 1000;

interface XbrlEntry {
  val: number;
  end: string;
  accn: string;
  fy: number;
  fp: string;
  form: string;
  filed: string;
}

interface CompanyFacts {
  cik: number;
  entityName: string;
  facts: {
    'us-gaap'?: Record<string, { units: Record<string, XbrlEntry[]> }>;
  };
}

export interface AnnualMetrics {
  fy: number;
  endDate: string;
  revenue: number | null;
  netIncome: number | null;
  epsBasic: number | null;
  epsDiluted: number | null;
  operatingIncome: number | null;
  totalAssets: number | null;
  totalLiabilities: number | null;
  stockholdersEquity: number | null;
  cash: number | null;
  longTermDebt: number | null;
  operatingCashFlow: number | null;
  capex: number | null;
  dividendPerShare: number | null;
  sharesOutstanding: number | null;
}

const REVENUE_TAGS = [
  'Revenues',
  'RevenueFromContractWithCustomerExcludingAssessedTax',
  'SalesRevenueNet',
  'RevenueFromContractWithCustomerIncludingAssessedTax',
];

const NET_INCOME_TAGS = [
  'NetIncomeLoss',
  'NetIncomeLossAvailableToCommonStockholdersBasic',
];

const OPERATING_INCOME_TAGS = [
  'OperatingIncomeLoss',
];

const CASH_TAGS = [
  'CashAndCashEquivalentsAtCarryingValue',
  'CashCashEquivalentsAndShortTermInvestments',
];

const DEBT_TAGS = [
  'LongTermDebt',
  'LongTermDebtNoncurrent',
];

const OCF_TAGS = [
  'NetCashProvidedByUsedInOperatingActivities',
];

const CAPEX_TAGS = [
  'PaymentsToAcquirePropertyPlantAndEquipment',
];

const SHARES_TAGS = [
  'CommonStockSharesOutstanding',
  'WeightedAverageNumberOfShareOutstandingBasicAndDiluted',
  'WeightedAverageNumberOfDilutedSharesOutstanding',
];

export async function fetchCompanyFacts(ticker: string): Promise<{ facts: CompanyFacts; entityName: string } | null> {
  const resolved = await resolveCik(ticker);
  if (!resolved) return null;

  const cached = factsCache[resolved.cik];
  if (cached && Date.now() - cached.ts < FACTS_TTL) {
    return { facts: cached.data, entityName: cached.data.entityName };
  }

  const resp = await fetch(
    `https://data.sec.gov/api/xbrl/companyfacts/CIK${resolved.cik}.json`,
    { headers: { 'User-Agent': EDGAR_USER_AGENT, Accept: 'application/json' } },
  );
  if (!resp.ok) return null;

  const data: CompanyFacts = await resp.json();
  factsCache[resolved.cik] = { data, ts: Date.now() };
  return { facts: data, entityName: data.entityName };
}

function getAnnual10K(
  facts: CompanyFacts,
  conceptTags: string[],
  unitKey: string,
): XbrlEntry[] {
  const gaap = facts.facts['us-gaap'];
  if (!gaap) return [];

  let best: XbrlEntry[] = [];
  let bestDate = '';

  for (const tag of conceptTags) {
    const concept = gaap[tag];
    if (!concept) continue;
    const entries = concept.units[unitKey];
    if (!entries || entries.length === 0) continue;

    const filtered = entries
      .filter(e => e.form === '10-K' && e.fp === 'FY')
      .sort((a, b) => b.end.localeCompare(a.end));

    if (filtered.length === 0) continue;

    const newest = filtered[0].end;
    if (newest > bestDate) {
      best = filtered;
      bestDate = newest;
    }
  }
  return best;
}

function latestVal(
  facts: CompanyFacts,
  conceptTags: string[],
  unitKey: string,
): number | null {
  const entries = getAnnual10K(facts, conceptTags, unitKey);
  return entries.length > 0 ? entries[0].val : null;
}

export function extractAnnualMetrics(facts: CompanyFacts, years = 5): AnnualMetrics[] {
  const revenueEntries = getAnnual10K(facts, REVENUE_TAGS, 'USD');
  const netIncomeEntries = getAnnual10K(facts, NET_INCOME_TAGS, 'USD');
  const epsBasicEntries = getAnnual10K(facts, ['EarningsPerShareBasic'], 'USD/shares');
  const epsDilutedEntries = getAnnual10K(facts, ['EarningsPerShareDiluted'], 'USD/shares');
  const opIncomeEntries = getAnnual10K(facts, OPERATING_INCOME_TAGS, 'USD');
  const assetsEntries = getAnnual10K(facts, ['Assets'], 'USD');
  const liabEntries = getAnnual10K(facts, ['Liabilities'], 'USD');
  const equityEntries = getAnnual10K(facts, ['StockholdersEquity'], 'USD');
  const cashEntries = getAnnual10K(facts, CASH_TAGS, 'USD');
  const debtEntries = getAnnual10K(facts, DEBT_TAGS, 'USD');
  const ocfEntries = getAnnual10K(facts, OCF_TAGS, 'USD');
  const capexEntries = getAnnual10K(facts, CAPEX_TAGS, 'USD');
  const divEntries = getAnnual10K(facts, ['CommonStockDividendsPerShareDeclared'], 'USD/shares');
  const sharesEntries = getAnnual10K(facts, SHARES_TAGS, 'shares');

  const fySet = new Set<number>();
  for (const e of revenueEntries) fySet.add(e.fy);
  for (const e of netIncomeEntries) fySet.add(e.fy);
  for (const e of epsBasicEntries) fySet.add(e.fy);

  const sortedFy = [...fySet].sort((a, b) => b - a).slice(0, years);

  const findVal = (entries: XbrlEntry[], fy: number): number | null => {
    const match = entries.find(e => e.fy === fy);
    return match ? match.val : null;
  };

  return sortedFy.map(fy => ({
    fy,
    endDate: revenueEntries.find(e => e.fy === fy)?.end
      ?? netIncomeEntries.find(e => e.fy === fy)?.end
      ?? '',
    revenue: findVal(revenueEntries, fy),
    netIncome: findVal(netIncomeEntries, fy),
    epsBasic: findVal(epsBasicEntries, fy),
    epsDiluted: findVal(epsDilutedEntries, fy),
    operatingIncome: findVal(opIncomeEntries, fy),
    totalAssets: findVal(assetsEntries, fy),
    totalLiabilities: findVal(liabEntries, fy),
    stockholdersEquity: findVal(equityEntries, fy),
    cash: findVal(cashEntries, fy),
    longTermDebt: findVal(debtEntries, fy),
    operatingCashFlow: findVal(ocfEntries, fy),
    capex: findVal(capexEntries, fy),
    dividendPerShare: findVal(divEntries, fy),
    sharesOutstanding: findVal(sharesEntries, fy),
  }));
}

export interface LatestMetrics {
  epsDiluted: number | null;
  epsBasic: number | null;
  revenue: number | null;
  netIncome: number | null;
  operatingIncome: number | null;
  totalAssets: number | null;
  totalLiabilities: number | null;
  stockholdersEquity: number | null;
  cash: number | null;
  longTermDebt: number | null;
  operatingCashFlow: number | null;
  capex: number | null;
  sharesOutstanding: number | null;
  dividendPerShare: number | null;
}

export function extractLatestMetrics(facts: CompanyFacts): LatestMetrics {
  return {
    epsDiluted: latestVal(facts, ['EarningsPerShareDiluted'], 'USD/shares'),
    epsBasic: latestVal(facts, ['EarningsPerShareBasic'], 'USD/shares'),
    revenue: latestVal(facts, REVENUE_TAGS, 'USD'),
    netIncome: latestVal(facts, NET_INCOME_TAGS, 'USD'),
    operatingIncome: latestVal(facts, OPERATING_INCOME_TAGS, 'USD'),
    totalAssets: latestVal(facts, ['Assets'], 'USD'),
    totalLiabilities: latestVal(facts, ['Liabilities'], 'USD'),
    stockholdersEquity: latestVal(facts, ['StockholdersEquity'], 'USD'),
    cash: latestVal(facts, CASH_TAGS, 'USD'),
    longTermDebt: latestVal(facts, DEBT_TAGS, 'USD'),
    operatingCashFlow: latestVal(facts, OCF_TAGS, 'USD'),
    capex: latestVal(facts, CAPEX_TAGS, 'USD'),
    sharesOutstanding: latestVal(facts, SHARES_TAGS, 'shares'),
    dividendPerShare: latestVal(facts, ['CommonStockDividendsPerShareDeclared'], 'USD/shares'),
  };
}
