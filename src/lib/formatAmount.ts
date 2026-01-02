export function formatAmount(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? Number(value) : (value ?? 0);
  if (!Number.isFinite(n)) return "0";

  const fixed = n.toFixed(2); // always two decimals, then trim
  const [intPart, decPart = "00"] = fixed.split(".");

  const intFormatted = Number(intPart).toLocaleString("en-US");

  if (decPart === "00") return intFormatted;
  if (decPart.endsWith("0")) return `${intFormatted}.${decPart[0]}`;
  return `${intFormatted}.${decPart}`;
}

