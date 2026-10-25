/** Client-safe money helpers. Amounts are stored as integers in the currency's minor unit. */

function fractionDigits(currency: string): number {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}

/** "499.5" INR -> 49950. Returns NaN for non-numeric input so validation reports it. */
export function toMinor(major: string | number, currency: string): number {
  const n = typeof major === "number" ? major : Number(major);
  return Number.isFinite(n) ? Math.round(n * 10 ** fractionDigits(currency)) : Number.NaN;
}

/** 49950 INR -> "499.50" (no symbol; for inputs and CSV). */
export function fromMinor(minor: number, currency: string): string {
  const digits = fractionDigits(currency);
  return (minor / 10 ** digits).toFixed(digits);
}

export function formatMoney(minor: number, currency: string): string {
  if (minor === 0) return "Free";
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(minor / 10 ** fractionDigits(currency));
  } catch {
    return `${fromMinor(minor, currency)} ${currency}`;
  }
}
