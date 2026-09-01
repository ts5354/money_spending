const yenFormatter = new Intl.NumberFormat("ja-JP", {
  style: "currency",
  currency: "JPY",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function formatYen(amount: number): string {
  return yenFormatter.format(amount);
}

export function formatPeriodDate(date: string): string {
  return date.replaceAll("-", "/");
}

export function formatPercentage(percentage: number): string {
  return `${percentage.toFixed(1)}%`;
}

export function formatChartDate(date: string): string {
  return date.slice(5).replace("-", "/");
}
