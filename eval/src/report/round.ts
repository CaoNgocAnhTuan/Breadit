// Rounding for the report (design "Report", F12). It works on the decimal string of the CSV cell, not on a float, so a table and a
// macro that show the same cell show the same text. Half goes away from zero. A negative zero prints without the sign.

const DECIMAL = /^(-?)(0|[1-9][0-9]*)(?:\.([0-9]+))?$/;

/** The cell rounded to `places` decimals (always printed with that many). Half away from zero. */
export function roundDecimal(cell: string, places: number): string {
  if (!Number.isInteger(places) || places < 0) throw new Error(`places must be an integer >= 0, got ${places}`);
  const m = DECIMAL.exec(cell);
  if (m === null) throw new Error(`"${cell}" is not a decimal number (digits, an optional minus sign and an optional fraction)`);
  const negative = m[1] === "-";
  const frac = (m[3] ?? "").padEnd(places + 1, "0");
  const kept = (m[2] as string) + frac.slice(0, places);
  const roundUp = (frac.charCodeAt(places) - 48) >= 5;
  // add one unit in the last kept place, on the digit string
  const digits = kept.split("").map((c) => c.charCodeAt(0) - 48);
  if (roundUp) {
    let i = digits.length - 1;
    while (i >= 0 && digits[i] === 9) digits[i--] = 0;
    if (i < 0) digits.unshift(1);
    else digits[i] = (digits[i] as number) + 1;
  }
  const text = digits.join("");
  const intPart = text.slice(0, text.length - places);
  const fracPart = text.slice(text.length - places);
  const body = places === 0 ? intPart : `${intPart}.${fracPart}`;
  const isZero = /^0(\.0*)?$/.test(body);
  return negative && !isZero ? `-${body}` : body;
}

/** A p-value: `<0.001` when the cell is under 0.001 (exact, on the string), else three decimals. */
export function formatP(cell: string): string {
  const m = DECIMAL.exec(cell);
  if (m === null || m[1] === "-") throw new Error(`"${cell}" is not a p-value (a decimal number from 0 to 1)`);
  if (Number(cell) > 1) throw new Error(`"${cell}" is not a p-value (a decimal number from 0 to 1)`);
  const frac = (m[3] ?? "").padEnd(3, "0");
  if (m[2] === "0" && frac.startsWith("000")) return "<0.001";
  return roundDecimal(cell, 3);
}

/** A tuning grid value as written: one decimal number or two joined by "/" (0.0625, 720000, 1024/1024). It is not rounded. */
export function gridValue(cell: string): string {
  const parts = cell.split("/");
  const ok = parts.length <= 2 && parts.every((p) => DECIMAL.exec(p)?.[1] === "");
  if (!ok) throw new Error(`"${cell}" is not a grid value (one decimal number, or two joined by "/", with no sign)`);
  return cell;
}
