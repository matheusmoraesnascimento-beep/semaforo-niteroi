export function formatDistance(m: number): string {
  if (m < 1000) return `${Math.round(m / 5) * 5} m`;
  return `${(m / 1000).toFixed(1).replace('.', ',')} km`;
}

export function formatDuration(seconds: number): string {
  const min = Math.max(1, Math.round(seconds / 60));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
