function compareFrac(a: { frac: number; i: number }, b: { frac: number; i: number }): number {
  return b.frac - a.frac || a.i - b.i;
}

/**
 * Splits `total` into integers in proportion to `weights` (largest remainder, ties to the smaller index).
 * The sum is exactly `total`. Weights are summed in index order.
 */
export function allocate(total: number, weights: readonly number[]): number[] {
  let sum = 0;
  for (const w of weights) sum += w;
  const base: number[] = [];
  const parts: Array<{ frac: number; i: number }> = [];
  let used = 0;
  weights.forEach((w, i) => {
    const raw = (total * w) / sum;
    const b = Math.floor(raw);
    base.push(b);
    parts.push({ frac: raw - b, i });
    used += b;
  });
  let rest = total - used;
  parts.sort(compareFrac);
  for (let k = 0; rest > 0 && k < parts.length; k++, rest--) base[(parts[k] as { i: number }).i]!++;
  // Float error can make the bases add up to more than the total. Take the extra back from the smallest remainders.
  for (let k = parts.length - 1; rest < 0 && k >= 0; k--) {
    const i = (parts[k] as { i: number }).i;
    if ((base[i] as number) > 0) {
      base[i]!--;
      rest++;
    }
  }
  return base;
}
