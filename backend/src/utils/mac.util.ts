/**
 * MAC address helpers for layer-2 address tracking.
 *
 * Addresses are stored bare (12 lowercase hex chars, no separators) so that
 * "aa:bb:cc:dd:ee:ff", "AA-BB-CC-DD-EE-FF" and "aabb.ccdd.eeff" all collapse to
 * one row and the unique index actually works.
 */

const BARE_RE = /^[0-9a-f]{12}$/;

/** Strip separators and lowercase. Throws when the result isn't 12 hex chars. */
export const normalizeMac = (mac: string): string => {
  const bare = String(mac).trim().toLowerCase().replace(/[\s:.-]/g, '');
  if (!BARE_RE.test(bare)) throw new Error(`Invalid MAC address: ${mac}`);
  return bare;
};

export const isMac = (mac: string): boolean => {
  try {
    normalizeMac(mac);
    return true;
  } catch {
    return false;
  }
};

/** Colon-separated display form: aa:bb:cc:dd:ee:ff */
export const formatMac = (mac: string, separator = ':'): string =>
  (normalizeMac(mac).match(/.{2}/g) || []).join(separator);

/** Cisco-style display form: aabb.ccdd.eeff */
export const formatMacCisco = (mac: string): string =>
  (normalizeMac(mac).match(/.{4}/g) || []).join('.');

/**
 * The 24-bit OUI (vendor prefix) as bare hex. Useful for spotting a member who
 * has swapped hardware without telling us.
 */
export const ouiOf = (mac: string): string => normalizeMac(mac).slice(0, 6);

/**
 * True for locally-administered addresses (second-least-significant bit of the
 * first octet). These are usually virtual/bonded interfaces rather than a real
 * NIC, which is worth flagging on a peering LAN.
 */
export const isLocallyAdministered = (mac: string): boolean => {
  const firstOctet = parseInt(normalizeMac(mac).slice(0, 2), 16);
  return (firstOctet & 0x02) === 0x02;
};

/** True for multicast/broadcast addresses, which must never be a peer's MAC. */
export const isMulticast = (mac: string): boolean => {
  const firstOctet = parseInt(normalizeMac(mac).slice(0, 2), 16);
  return (firstOctet & 0x01) === 0x01;
};

export default {
  normalizeMac,
  isMac,
  formatMac,
  formatMacCisco,
  ouiOf,
  isLocallyAdministered,
  isMulticast,
};
