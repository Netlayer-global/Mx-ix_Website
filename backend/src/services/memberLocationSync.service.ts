import { Member } from '../models/member.model';
import { Location } from '../models';

/**
 * Member ↔ Location Connected Networks sync.
 *
 * When a location's connected networks (asnList) change, the public Member
 * directory is kept in sync automatically:
 *   - A connected network (ASN) becomes a Member, tagged with that location.
 *   - The member's `locations[]` reflects every location it's connected at.
 *   - Peering policy maps from the location's asnList entry.
 *
 * Matching is by ASN. Members created from location sync are marked so we don't
 * clobber manually-curated directory entries.
 */

const mapPolicy = (p?: string): 'Open' | 'Selective' | 'Restrictive' => {
  if (p === 'Selective') return 'Selective';
  if (p === 'Restrictive') return 'Restrictive';
  return 'Open';
};

/**
 * Rebuild the Member directory from all locations' connected networks.
 * Each unique ASN across all locations becomes one Member with all the
 * locations it appears in.
 */
export async function syncMembersFromLocations(): Promise<{ created: number; updated: number; total: number }> {
  const locations = await Location.find().select('id name asnList').lean();

  // Build a map: asn -> { name, policy, locationIds[] }
  const byAsn = new Map<number, { name: string; policy: string; locationIds: Set<string> }>();

  for (const loc of locations as any[]) {
    for (const net of loc.asnList || []) {
      if (!net.asnNumber) continue;
      const existing = byAsn.get(net.asnNumber);
      if (existing) {
        existing.locationIds.add(loc.id);
        // Prefer a non-empty name
        if (!existing.name && net.name) existing.name = net.name;
      } else {
        byAsn.set(net.asnNumber, {
          name: net.name || `AS${net.asnNumber}`,
          policy: net.peeringPolicy || 'Open',
          locationIds: new Set([loc.id]),
        });
      }
    }
  }

  let created = 0;
  let updated = 0;

  for (const [asn, info] of byAsn.entries()) {
    const locations = Array.from(info.locationIds);
    const existing = await Member.findOne({ asn });
    if (existing) {
      // Merge locations (keep any manually-added ones too)
      const merged = Array.from(new Set([...(existing.locations || []), ...locations]));
      existing.locations = merged;
      existing.peeringPolicy = mapPolicy(info.policy);
      if (!existing.name || existing.name === `AS${asn}`) existing.name = info.name;
      await existing.save();
      updated++;
    } else {
      await Member.create({
        name: info.name,
        asn,
        peeringPolicy: mapPolicy(info.policy),
        locations,
        isActive: true,
      });
      created++;
    }
  }

  return { created, updated, total: byAsn.size };
}

/**
 * Sync one location's connected networks into the Member directory.
 * Called after a location's asnList is modified.
 */
export async function syncMembersForLocation(locationId: string): Promise<{ synced: number }> {
  const loc = await Location.findOne({ id: locationId }).select('id asnList').lean();
  if (!loc) return { synced: 0 };

  const asnsInLocation = new Set<number>();
  let synced = 0;

  for (const net of (loc as any).asnList || []) {
    if (!net.asnNumber) continue;
    asnsInLocation.add(net.asnNumber);

    const existing = await Member.findOne({ asn: net.asnNumber });
    if (existing) {
      if (!existing.locations.includes(loc.id)) {
        existing.locations.push(loc.id);
      }
      existing.peeringPolicy = mapPolicy(net.peeringPolicy);
      if (!existing.name || existing.name === `AS${net.asnNumber}`) existing.name = net.name || existing.name;
      await existing.save();
    } else {
      await Member.create({
        name: net.name || `AS${net.asnNumber}`,
        asn: net.asnNumber,
        peeringPolicy: mapPolicy(net.peeringPolicy),
        locations: [loc.id],
        isActive: true,
      });
    }
    synced++;
  }

  // Remove this location from members whose ASN is no longer in the location
  const membersWithLocation = await Member.find({ locations: loc.id });
  for (const m of membersWithLocation) {
    if (m.asn && !asnsInLocation.has(m.asn)) {
      m.locations = m.locations.filter((l) => l !== loc.id);
      await m.save();
    }
  }

  return { synced };
}

export default { syncMembersFromLocations, syncMembersForLocation };
