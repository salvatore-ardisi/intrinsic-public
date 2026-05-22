import type { Observation } from './types';

export interface AnalysisResult {
  avg12m: number;
  min12m: number;
  max12m: number;
  percentile: number;
  trend: 'rising' | 'falling' | 'stable';
  momentum: 'accelerating' | 'decelerating' | 'steady';
  avg3m: number;
  avg6m: number;
}

export interface DynamicReading {
  text: string;
  isInversionWarning: boolean;
}

function getRecentObs(observations: Observation[], months: number): Observation[] {
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - months);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return observations.filter(o => o.date >= cutoffStr);
}

export function analyzeIndicator(
  seriesId: string,
  currentValue: number,
  previousValue: number | null,
  direction: 'up' | 'down' | 'flat',
  observations: Observation[],
): AnalysisResult | null {
  const obs12m = getRecentObs(observations, 12);
  if (obs12m.length < 3) return null;

  const obs3m = getRecentObs(observations, 3);
  const obs6m = getRecentObs(observations, 6);

  const useChanges = seriesId === 'CES0000000001';

  let values12m: number[];
  let values3m: number[];
  let values6m: number[];

  if (useChanges) {
    const toChanges = (obs: Observation[]) => {
      const changes: number[] = [];
      for (let i = 1; i < obs.length; i++) {
        changes.push(obs[i].value - obs[i - 1].value);
      }
      return changes;
    };
    values12m = toChanges(obs12m);
    values3m = toChanges(obs3m);
    values6m = toChanges(obs6m);
    if (values12m.length < 2) return null;
  } else {
    values12m = obs12m.map(o => o.value);
    values3m = obs3m.map(o => o.value);
    values6m = obs6m.map(o => o.value);
  }

  const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const avg12m = avg(values12m);
  const avg3m = avg(values3m.length ? values3m : values12m);
  const avg6m = avg(values6m.length ? values6m : values12m);
  const min12m = Math.min(...values12m);
  const max12m = Math.max(...values12m);

  const sorted = [...values12m].sort((a, b) => a - b);
  const currentVal = useChanges && previousValue !== null ? currentValue - previousValue : currentValue;
  const belowCount = sorted.filter(v => v < currentVal).length;
  const percentile = Math.round((belowCount / sorted.length) * 100);

  const firstHalf = values12m.slice(0, Math.floor(values12m.length / 2));
  const secondHalf = values12m.slice(Math.floor(values12m.length / 2));
  const avgFirst = avg(firstHalf);
  const avgSecond = avg(secondHalf);
  const trendDiff = avgSecond - avgFirst;
  const trendThreshold = Math.abs(avg12m) * 0.02 || 0.01;
  const trend: AnalysisResult['trend'] = trendDiff > trendThreshold ? 'rising' : trendDiff < -trendThreshold ? 'falling' : 'stable';

  const recentSlice = values12m.slice(-Math.max(3, Math.floor(values12m.length * 0.25)));
  const priorSlice = values12m.slice(-Math.max(6, Math.floor(values12m.length * 0.5)), -Math.max(3, Math.floor(values12m.length * 0.25)));
  const recentAvg = avg(recentSlice);
  const priorAvg = avg(priorSlice.length ? priorSlice : recentSlice);
  const momDiff = recentAvg - priorAvg;
  const momThreshold = Math.abs(avg12m) * 0.01 || 0.005;
  const momentum: AnalysisResult['momentum'] = momDiff > momThreshold ? 'accelerating' : momDiff < -momThreshold ? 'decelerating' : 'steady';

  return { avg12m, min12m, max12m, percentile, trend, momentum, avg3m, avg6m };
}

function fmt(v: number, decimals = 2): string {
  return v.toFixed(decimals);
}

function pctRank(percentile: number): string {
  if (percentile >= 90) return 'near the top of its 12-month range';
  if (percentile >= 75) return 'in the upper quartile of its 12-month range';
  if (percentile >= 50) return 'above its 12-month midpoint';
  if (percentile >= 25) return 'below its 12-month midpoint';
  if (percentile >= 10) return 'in the lower quartile of its 12-month range';
  return 'near the bottom of its 12-month range';
}

function trendWord(trend: AnalysisResult['trend']): string {
  return trend === 'rising' ? 'trending higher' : trend === 'falling' ? 'trending lower' : 'relatively stable';
}

export function generateDynamicReading(
  seriesId: string,
  analysis: AnalysisResult,
  currentValue: number,
  previousValue: number | null,
  change: number | null,
  changePct: number | null,
): DynamicReading {
  const { avg12m, min12m, max12m, percentile, trend, momentum } = analysis;

  if (seriesId === 'YIELD_SPREAD' && currentValue < 0) {
    return {
      text: `THE YIELD CURVE IS INVERTED at ${fmt(currentValue)}%. The 12-month average spread is ${fmt(avg12m)}%, ranging from ${fmt(min12m)}% to ${fmt(max12m)}%. Every U.S. recession since 1955 has been preceded by an inversion. The curve has been ${trendWord(trend)} and is ${pctRank(percentile)}.`,
      isInversionWarning: true,
    };
  }

  const parts: string[] = [];

  switch (seriesId) {
    case 'UNRATE': {
      parts.push(`Unemployment at ${fmt(currentValue, 1)}% is ${pctRank(percentile)} (12m avg: ${fmt(avg12m, 1)}%, range: ${fmt(min12m, 1)}–${fmt(max12m, 1)}%).`);
      if (trend === 'rising') parts.push('The trend is upward, suggesting the labor market is loosening.');
      else if (trend === 'falling') parts.push('The trend is downward, signaling continued labor market tightening.');
      else parts.push('The rate has been stable, suggesting a steady-state labor market.');
      if (momentum === 'accelerating') parts.push('The pace of change is accelerating — watch for rapid deterioration.');
      else if (momentum === 'decelerating') parts.push('The pace of change is slowing.');
      break;
    }
    case 'CES0000000001': {
      const chg = change !== null ? change : 0;
      parts.push(`The economy added ${Math.abs(chg).toFixed(0)}K jobs. The 12-month average monthly change is ${fmt(avg12m, 0)}K (range: ${fmt(min12m, 0)}K to ${fmt(max12m, 0)}K).`);
      if (chg > avg12m) parts.push(`This is above the recent average — ${chg > 200 ? 'strong' : 'solid'} job growth.`);
      else parts.push(`This is below the recent average${chg < 100 ? ' and signals a cooldown in hiring' : ''}.`);
      if (trend === 'falling') parts.push('The 12-month trend in job gains is declining.');
      break;
    }
    case 'LNS11300000': {
      parts.push(`Participation at ${fmt(currentValue, 1)}% is ${pctRank(percentile)} (12m avg: ${fmt(avg12m, 1)}%, range: ${fmt(min12m, 1)}–${fmt(max12m, 1)}%).`);
      if (trend !== 'stable') parts.push(`The rate has been ${trendWord(trend)}, ${trend === 'rising' ? 'suggesting more workers are entering the labor force' : 'which may indicate discouragement or demographic shifts'}.`);
      break;
    }
    case 'CPIAUCSL': {
      const annualized = changePct !== null ? (changePct * 12) : null;
      parts.push(`CPI at ${fmt(currentValue, 1)} is ${pctRank(percentile)} (12m range: ${fmt(min12m, 1)}–${fmt(max12m, 1)}).`);
      if (annualized !== null) parts.push(`The latest month-over-month change annualizes to ${fmt(annualized, 1)}%.`);
      if (trend === 'rising') parts.push('The index is trending higher — inflation pressure persists.');
      else if (trend === 'falling') parts.push('The trend is easing — disinflationary progress is underway.');
      if (momentum === 'decelerating') parts.push('Price increases are decelerating, a positive signal for the Fed.');
      break;
    }
    case 'PCEPI': {
      const annualized = changePct !== null ? (changePct * 12) : null;
      parts.push(`PCE index at ${fmt(currentValue, 1)} is ${pctRank(percentile)} (12m range: ${fmt(min12m, 1)}–${fmt(max12m, 1)}).`);
      if (annualized !== null) parts.push(`Month-over-month change annualizes to ${fmt(annualized, 1)}% — ${annualized > 2.5 ? 'above' : annualized < 1.5 ? 'below' : 'near'} the Fed\'s 2% target.`);
      if (momentum === 'decelerating') parts.push('Momentum is easing, which supports the case for rate cuts.');
      else if (momentum === 'accelerating') parts.push('Inflation momentum is reaccelerating — the Fed will take notice.');
      break;
    }
    case 'T10YIE': {
      parts.push(`10Y breakeven inflation at ${fmt(currentValue)}% is ${pctRank(percentile)} (12m avg: ${fmt(avg12m)}%, range: ${fmt(min12m)}–${fmt(max12m)}%).`);
      if (currentValue > 2.5) parts.push('Above 2.5% signals the bond market sees elevated inflation risk.');
      else if (currentValue < 2.0) parts.push('Below 2% suggests the market sees inflation as contained.');
      if (trend !== 'stable') parts.push(`Expectations have been ${trendWord(trend)}.`);
      break;
    }
    case 'GDPC1': {
      const annualized = changePct !== null ? (changePct * 4) : null;
      parts.push(`Real GDP at $${fmt(currentValue, 1)}B is ${pctRank(percentile)} (12m range: $${fmt(min12m, 1)}B–$${fmt(max12m, 1)}B).`);
      if (annualized !== null) parts.push(`Quarter-over-quarter growth annualizes to ${fmt(annualized, 1)}%.`);
      if (trend === 'rising') parts.push('The economy continues to expand.');
      else if (trend === 'falling') parts.push('Output is contracting — recession risk is elevated.');
      break;
    }
    case 'FEDFUNDS': {
      const yearAgoObs = analysis.avg12m;
      parts.push(`Fed funds rate at ${fmt(currentValue)}% is ${pctRank(percentile)} (12m avg: ${fmt(avg12m)}%, range: ${fmt(min12m)}–${fmt(max12m)}%).`);
      if (currentValue > yearAgoObs) parts.push('The rate is above its 12-month average — policy remains restrictive.');
      else if (currentValue < yearAgoObs) parts.push('The rate is below its 12-month average — the Fed has been easing.');
      else parts.push('The rate is at its 12-month average — the Fed is holding steady.');
      if (trend === 'falling') parts.push('The trend is toward easing.');
      else if (trend === 'rising') parts.push('The trend is toward tightening.');
      break;
    }
    case 'DGS10': {
      parts.push(`The 10-year yield at ${fmt(currentValue)}% is ${pctRank(percentile)} (12m avg: ${fmt(avg12m)}%, range: ${fmt(min12m)}–${fmt(max12m)}%).`);
      if (trend !== 'stable') parts.push(`Yields have been ${trendWord(trend)}, ${trend === 'rising' ? 'tightening financial conditions' : 'easing borrowing costs'}.`);
      if (momentum === 'accelerating' && trend === 'rising') parts.push('The move higher is accelerating — mortgage and corporate rates will follow.');
      break;
    }
    case 'DGS2': {
      parts.push(`The 2-year yield at ${fmt(currentValue)}% is ${pctRank(percentile)} (12m avg: ${fmt(avg12m)}%, range: ${fmt(min12m)}–${fmt(max12m)}%).`);
      if (trend !== 'stable') parts.push(`The trend is ${trendWord(trend)}, reflecting shifting expectations for ${trend === 'rising' ? 'tighter' : 'easier'} Fed policy.`);
      break;
    }
    case 'MORTGAGE30US': {
      parts.push(`30-year mortgage rate at ${fmt(currentValue)}% is ${pctRank(percentile)} (12m avg: ${fmt(avg12m)}%, range: ${fmt(min12m)}–${fmt(max12m)}%).`);
      if (currentValue > 7) parts.push('Above 7% severely constrains housing affordability.');
      else if (currentValue > 6) parts.push('Rates in the 6-7% range are restrictive for housing demand.');
      else if (currentValue < 5) parts.push('Below 5% is stimulative for the housing market.');
      if (trend !== 'stable') parts.push(`Mortgage rates have been ${trendWord(trend)}.`);
      break;
    }
    case 'YIELD_SPREAD': {
      parts.push(`The 10Y-2Y spread at ${fmt(currentValue)}% is ${pctRank(percentile)} (12m avg: ${fmt(avg12m)}%, range: ${fmt(min12m)}–${fmt(max12m)}%).`);
      if (currentValue > 0 && min12m < 0) parts.push('The curve has un-inverted — historically this can precede the onset of recession as the Fed begins cutting.');
      else if (currentValue > 0) parts.push('A positive spread is the normal state, signaling growth expectations.');
      if (trend !== 'stable') parts.push(`The curve has been ${trend === 'rising' ? 'steepening' : 'flattening'}.`);
      break;
    }
    default: {
      parts.push(`Current value ${fmt(currentValue)} is ${pctRank(percentile)} (12m avg: ${fmt(avg12m)}, range: ${fmt(min12m)}–${fmt(max12m)}).`);
      if (trend !== 'stable') parts.push(`The series has been ${trendWord(trend)}.`);
    }
  }

  return { text: parts.join(' '), isInversionWarning: false };
}
