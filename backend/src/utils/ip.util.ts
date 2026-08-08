/**
 * IPv4/IPv6 helpers for IPAM and route-server config generation.
 *
 * Deliberately dependency-free: the backend has no IP library and pulling one
 * in for a handful of conversions is not worth the supply-chain surface.
 * BigInt is used for v6 so /64-and-larger prefixes are handled exactly.
 */

// ── IPv4 ──

const IPV4_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

export const isIpv4 = (addr: string): boolean => {
  const m = IPV4_RE.exec(String(addr).trim());
  if (!m) return false;
  return m.slice(1).every((o) => {
    const n = Number(o);
    // Reject leading zeros ("01") — they are ambiguous and some parsers read
    // them as octal.
    return n >= 0 && n <= 255 && String(n) === o;
  });
};

export const ipv4ToInt = (addr: string): number => {
  const m = IPV4_RE.exec(String(addr).trim());
  if (!m) throw new Error(`Invalid IPv4 address: ${addr}`);
  return (
    ((Number(m[1]) << 24) >>> 0) + (Number(m[2]) << 16) + (Number(m[3]) << 8) + Number(m[4])
  );
};

export const intToIpv4 = (n: number): string => {
  const v = n >>> 0;
  return [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255].join('.');
};

// ── IPv6 ──

/** Expand any valid IPv6 form to 8 colon-separated 4-digit hex groups. */
export const expandIpv6 = (addr: string): string => {
  let s = String(addr).trim().toLowerCase();
  if (!s) throw new Error('Invalid IPv6 address: empty');

  // Drop a scope/zone id ("fe80::1%eth0") — irrelevant for peering addresses.
  if (s.includes('%')) s = s.split('%')[0];

  // Handle an embedded IPv4 suffix (::ffff:1.2.3.4).
  const v4Match = /(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(s);
  if (v4Match) {
    const v4 = ipv4ToInt(v4Match[1]);
    const hi = ((v4 >>> 16) & 0xffff).toString(16);
    const lo = (v4 & 0xffff).toString(16);
    s = s.slice(0, v4Match.index) + `${hi}:${lo}`;
  }

  // Reject malformed colon runs before splitting. Filtering empty groups after
  // a naive split would otherwise silently accept "2001:db8:::1" and
  // ":1:2:3:4:5:6:7" as valid, which would let a bad address reach the
  // route-server config.
  if (s.includes(':::')) throw new Error(`Invalid IPv6 address: ${addr}`);
  if ((s.match(/::/g) || []).length > 1) throw new Error(`Invalid IPv6 address: ${addr}`);

  const parts = s.split('::');
  if (parts.length > 2) throw new Error(`Invalid IPv6 address: ${addr}`);

  if (parts.length === 1) {
    if (s.startsWith(':') || s.endsWith(':')) throw new Error(`Invalid IPv6 address: ${addr}`);
  } else {
    if (parts[0].endsWith(':') || parts[1].startsWith(':')) {
      throw new Error(`Invalid IPv6 address: ${addr}`);
    }
  }

  const head = parts[0] ? parts[0].split(':') : [];
  const tail = parts.length === 2 && parts[1] ? parts[1].split(':') : [];

  let groups: string[];
  if (parts.length === 2) {
    const fill = 8 - head.length - tail.length;
    if (fill < 0) throw new Error(`Invalid IPv6 address: ${addr}`);
    groups = [...head, ...Array(fill).fill('0'), ...tail];
  } else {
    groups = head;
  }

  if (groups.length !== 8) throw new Error(`Invalid IPv6 address: ${addr}`);
  return groups
    .map((g) => {
      if (!/^[0-9a-f]{1,4}$/.test(g)) throw new Error(`Invalid IPv6 group "${g}" in ${addr}`);
      return g.padStart(4, '0');
    })
    .join(':');
};

export const isIpv6 = (addr: string): boolean => {
  try {
    expandIpv6(addr);
    return true;
  } catch {
    return false;
  }
};

/** RFC 5952 canonical short form (lowercase, longest zero-run collapsed). */
export const compressIpv6 = (addr: string): string => {
  const groups = expandIpv6(addr).split(':').map((g) => g.replace(/^0+(?=.)/, ''));

  let bestStart = -1;
  let bestLen = 0;
  let curStart = -1;
  let curLen = 0;
  groups.forEach((g, i) => {
    if (g === '0') {
      if (curStart < 0) curStart = i;
      curLen++;
      if (curLen > bestLen) {
        bestLen = curLen;
        bestStart = curStart;
      }
    } else {
      curStart = -1;
      curLen = 0;
    }
  });

  // A single zero group is written as "0", not "::".
  if (bestLen < 2) return groups.join(':');

  const head = groups.slice(0, bestStart).join(':');
  const tail = groups.slice(bestStart + bestLen).join(':');
  return `${head}::${tail}`;
};

export const ipv6ToBigInt = (addr: string): bigint =>
  BigInt('0x' + expandIpv6(addr).split(':').join(''));

export const bigIntToIpv6 = (n: bigint): string => {
  if (n < 0n || n > (1n << 128n) - 1n) throw new Error('IPv6 value out of range');
  const hex = n.toString(16).padStart(32, '0');
  const groups: string[] = [];
  for (let i = 0; i < 8; i++) groups.push(hex.slice(i * 4, i * 4 + 4));
  return compressIpv6(groups.join(':'));
};

// ── CIDR ──

export interface ParsedCidr {
  family: 4 | 6;
  /** Network address, normalized. */
  network: string;
  prefixLength: number;
  /** Total addresses in the block. */
  size: bigint;
  /** First and last address as integers (BigInt for both families). */
  first: bigint;
  last: bigint;
}

export const parseCidr = (cidr: string): ParsedCidr => {
  const raw = String(cidr).trim();
  const slash = raw.lastIndexOf('/');
  if (slash < 0) throw new Error(`Missing prefix length in "${cidr}"`);
  const addr = raw.slice(0, slash);
  const prefixLength = Number(raw.slice(slash + 1));

  if (!Number.isInteger(prefixLength)) throw new Error(`Invalid prefix length in "${cidr}"`);

  if (isIpv4(addr)) {
    if (prefixLength < 0 || prefixLength > 32) throw new Error(`IPv4 prefix length must be 0-32 ("${cidr}")`);
    const bits = 32n;
    const value = BigInt(ipv4ToInt(addr));
    const mask = prefixLength === 0 ? 0n : ((1n << BigInt(prefixLength)) - 1n) << (bits - BigInt(prefixLength));
    const first = value & mask;
    const size = 1n << (bits - BigInt(prefixLength));
    return {
      family: 4,
      network: intToIpv4(Number(first)),
      prefixLength,
      size,
      first,
      last: first + size - 1n,
    };
  }

  if (isIpv6(addr)) {
    if (prefixLength < 0 || prefixLength > 128) throw new Error(`IPv6 prefix length must be 0-128 ("${cidr}")`);
    const bits = 128n;
    const value = ipv6ToBigInt(addr);
    const mask = prefixLength === 0 ? 0n : ((1n << BigInt(prefixLength)) - 1n) << (bits - BigInt(prefixLength));
    const first = value & mask;
    const size = 1n << (bits - BigInt(prefixLength));
    return {
      family: 6,
      network: bigIntToIpv6(first),
      prefixLength,
      size,
      first,
      last: first + size - 1n,
    };
  }

  throw new Error(`Invalid IP address in "${cidr}"`);
};

export const formatAddress = (value: bigint, family: 4 | 6): string =>
  family === 4 ? intToIpv4(Number(value)) : bigIntToIpv6(value);

export const addressToBigInt = (addr: string, family: 4 | 6): bigint =>
  family === 4 ? BigInt(ipv4ToInt(addr)) : ipv6ToBigInt(addr);

/**
 * Lexically sortable key for an address, so Mongo can return "the next free
 * address" with a plain sort instead of loading the pool into memory.
 * v4 → 8 hex chars, v6 → 32 hex chars.
 */
export const sortKeyFor = (addr: string, family: 4 | 6): string =>
  family === 4
    ? BigInt(ipv4ToInt(addr)).toString(16).padStart(8, '0')
    : ipv6ToBigInt(addr).toString(16).padStart(32, '0');

/** True when `addr` sits inside `cidr`. */
export const isInCidr = (addr: string, cidr: string): boolean => {
  try {
    const net = parseCidr(cidr);
    const family: 4 | 6 = isIpv4(addr) ? 4 : 6;
    if (family !== net.family) return false;
    const value = addressToBigInt(addr, family);
    return value >= net.first && value <= net.last;
  } catch {
    return false;
  }
};

/** Normalize for storage/comparison: v6 gets compressed, v4 passes through. */
export const normalizeAddress = (addr: string): string => {
  const s = String(addr).trim();
  if (isIpv4(s)) return s;
  if (isIpv6(s)) return compressIpv6(s);
  throw new Error(`Invalid IP address: ${addr}`);
};

/** Validates a `prefix` or `prefix/len` string and returns the normalized form. */
export const normalizeCidr = (cidr: string): string => {
  const p = parseCidr(cidr);
  return `${p.network}/${p.prefixLength}`;
};

export default {
  isIpv4,
  isIpv6,
  ipv4ToInt,
  intToIpv4,
  expandIpv6,
  compressIpv6,
  ipv6ToBigInt,
  bigIntToIpv6,
  parseCidr,
  formatAddress,
  addressToBigInt,
  sortKeyFor,
  isInCidr,
  normalizeAddress,
  normalizeCidr,
};
