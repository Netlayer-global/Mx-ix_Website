// Looking Glass helper utilities

const WELL_KNOWN: Record<string, string> = {
  '65535:0': 'GRACEFUL_SHUTDOWN',
  '65535:666': 'BLACKHOLE',
  '65535:65281': 'NO_EXPORT',
  '65535:65282': 'NO_ADVERTISE',
  '65535:65283': 'NO_EXPORT_SUBCONFED',
  '65535:65284': 'NO_PEER',
};

/** Format a single community tuple, with a well-known label when available. */
export function formatCommunity(c: number[]): { value: string; label?: string } {
  const value = c.join(':');
  return { value, label: WELL_KNOWN[value] };
}

export function formatCommunities(comms?: number[][]): string {
  if (!comms || !comms.length) return '—';
  return comms.map((c) => c.join(':')).join('  ');
}

export function formatLargeCommunities(comms?: number[][]): string {
  if (!comms || !comms.length) return '—';
  return comms.map((c) => c.join(':')).join('  ');
}

export function formatAsPath(path?: number[]): string {
  return path && path.length ? path.join(' ') : '—';
}

/** Copy text to clipboard (best-effort). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/** Build a CSV string from rows and trigger a download. */
export function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]): void {
  const escape = (v: string | number) => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers, ...rows].map((r) => r.map(escape).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
