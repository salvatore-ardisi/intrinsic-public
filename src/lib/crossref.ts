const KEYWORDS: Record<string, string[]> = {
  UNRATE: ['unemployment', 'jobless', 'labor market', 'employment situation'],
  CES0000000001: ['payroll', 'nonfarm', 'jobs report', 'employment situation', 'job gains', 'job losses'],
  LNS11300000: ['participation rate', 'labor force', 'workforce'],
  CPIAUCSL: ['consumer price', 'cpi', 'inflation', 'prices'],
  PCEPI: ['pce', 'personal consumption', 'inflation'],
  T10YIE: ['breakeven', 'inflation expectations', 'tips'],
  GDPC1: ['gdp', 'gross domestic', 'economic growth', 'recession', 'output'],
  FEDFUNDS: ['fed funds', 'federal funds', 'interest rate', 'fomc', 'monetary policy', 'rate hike', 'rate cut'],
  DGS10: ['10-year', 'ten-year', 'treasury yield', 'benchmark borrowing', 'long-term rate'],
  DGS2: ['2-year', 'two-year', 'short-term rate'],
  YIELD_SPREAD: ['yield curve', 'yield spread', 'inversion', 'inverted', '10y-2y', 'recession predictor'],
  MORTGAGE30US: ['mortgage', 'housing', 'home loan', '30-year'],
};

interface Article {
  title: string;
  description?: string;
  summary?: string;
  date: string | null;
  link: string;
  source: string;
}

function countHits(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  let hits = 0;
  for (const kw of keywords) {
    if (lower.includes(kw)) hits++;
  }
  return hits;
}

export function findRelatedArticles<T extends Article>(seriesId: string, articles: T[]): T[] {
  const keywords = KEYWORDS[seriesId];
  if (!keywords) return [];

  const scored: { article: T; score: number }[] = [];
  for (const article of articles) {
    const text = `${article.title} ${article.description || ''} ${article.summary || ''}`;
    const score = countHits(text, keywords);
    if (score > 0) scored.push({ article, score });
  }

  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return (b.article.date || '').localeCompare(a.article.date || '');
  });

  return scored.slice(0, 5).map(s => s.article);
}

export function findRelatedIndicators(title: string, description?: string): string[] {
  const text = `${title} ${description || ''}`;
  const matches: string[] = [];
  for (const [seriesId, keywords] of Object.entries(KEYWORDS)) {
    if (countHits(text, keywords) > 0) matches.push(seriesId);
  }
  return matches;
}
