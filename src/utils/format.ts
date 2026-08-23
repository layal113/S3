export function formatNumber(value: number, maximumFractionDigits = 1): string {
  return new Intl.NumberFormat('en-EG', { maximumFractionDigits }).format(
    value,
  );
}

export function formatEgp(value: number): string {
  return `${formatNumber(value, 2)} EGP`;
}

export function formatUpdatedTime(value: string): string {
  return new Intl.DateTimeFormat('en-EG', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}
