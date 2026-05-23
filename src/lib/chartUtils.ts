export function padDomain(min: number, max: number, fraction = 0.12): { min: number; max: number; range: number } {
  const raw = max - min;
  const pad = raw > 0 ? raw * fraction : 0.5;
  return { min: min - pad, max: max + pad, range: raw + pad * 2 };
}
