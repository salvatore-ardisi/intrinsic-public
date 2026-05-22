export function formatValue(value: number | null, unit: string, decimals: number = 2): string {
  if (value === null) return '--';
  if (unit === 'B$') return `$${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}B`;
  if (unit === 'K') return `${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}K`;
  if (unit === '%') return `${value.toFixed(decimals)}%`;
  if (unit === 'index') return value.toFixed(decimals);
  return value.toFixed(decimals);
}

export function formatChange(change: number | null, unit: string, decimals: number = 2): string {
  if (change === null) return '--';
  const sign = change > 0 ? '+' : '';
  if (unit === 'K') return `${sign}${change.toLocaleString(undefined, { maximumFractionDigits: 0 })}K`;
  if (unit === '%') return `${sign}${change.toFixed(decimals)}pp`;
  if (unit === 'B$') return `${sign}$${change.toFixed(1)}B`;
  return `${sign}${change.toFixed(decimals)}`;
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '--';
  const parts = dateStr.slice(0, 10).split('-').map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function directionColor(direction: string, invert: boolean): 'positive' | 'negative' | 'muted' {
  if (direction === 'flat') return 'muted';
  const isPositive = direction === 'up';
  const isGood = invert ? !isPositive : isPositive;
  return isGood ? 'positive' : 'negative';
}

export function directionArrow(direction: string): string {
  if (direction === 'up') return '▲';
  if (direction === 'down') return '▼';
  return '◆';
}
