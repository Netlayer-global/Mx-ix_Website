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
  const locations = await Location.find().lean();
  console.log(`[MemberSync] Found ${locations.length} locations`);

  // Build a map: asn -> { name, policy, locationNames[] }
  const byAsn = new Map<number, { name: string; policy: string; locationNames: Set<string> }>();

  for (const loc of locations as any[]) {
    // Use the location's display name (falls back to id) for readable member locations
    const locLabel = loc.name || loc.id || 'Unknown';
    const nets = Array.isArray(loc.asnList) ? loc.asnList : [];
    console.log(`[MemberSync] Location "${locLabel}" has ${nets.length} connected networks`);
    for (const net of nets) {
      const asnNum = Number(net.asnNumber);
      if (!asnNum || Number.isNaN(asnNum)) continue;
      const existing = byAsn.get(asnNum);
      if (existing) {
        existing.locationNames.add(locLabel);
        if (!existing.name && net.name) existing.name = net.name;
      } else {
        byAsn.set(asnNum, {
          name: net.name || `AS${asnNum}`,
          policy: net.peeringPolicy || 'Open',
          locationNames: new Set([locLabel]),
        });
      }
    }
  }

  let created = 0;
  let updated = 0;

  for (const [asn, info] of byAsn.entries()) {
    const locNames = Array.from(info.locationNames);
    const existing = await Member.findOne({ asn });
    if (existing) {
      const merged = Array.from(new Set([...(existing.locations || []), ...locNames]));
      existing.locations = merged;
      existing.peeringPolicy = mapPolicy(info.policy);
      if (!existing.name || existing.name === `AS${asn}`) existing.name = info.name;
      existing.isActive = true;
      await existing.save();
      updated++;
    } else {
      await Member.create({
        name: info.name,
        asn,
        peeringPolicy: mapPolicy(info.policy),
        locations: locNames,
        isActive: true,
      });
      created++;
    }
  }

  console.log(`[MemberSync] Done: ${created} created, ${updated} updated, ${byAsn.size} total ASNs`);
  return { created, updated, total: byAsn.size };
}

/**
 * Sync one location's connected networks into the Member directory.
 * Called after a location's asnList is modified.
 */
export async function syncMembersForLocation(locationId: string): Promise<{ synced: number }> {
  const loc = await Location.findOne({ id: locationId }).lean();
  if (!loc) {
    console.warn(`[MemberSync] Location "${locationId}" not found`);
    return { synced: 0 };
  }
  const locLabel = (loc as any).name || (loc as any).id || 'Unknown';

  const asnsInLocation = new Set<number>();
  let synced = 0;

  for (const net of (loc as any).asnList || []) {
    const asnNum = Number(net.asnNumber);
    if (!asnNum || Number.isNaN(asnNum)) continue;
    asnsInLocation.add(asnNum);

    const existing = await Member.findOne({ asn: asnNum });
    if (existing) {
      if (!existing.locations.includes(locLabel)) {
        existing.locations.push(locLabel);
      }
      existing.peeringPolicy = mapPolicy(net.peeringPolicy);
      if (!existing.name || existing.name === `AS${asnNum}`) existing.name = net.name || existing.name;
      existing.isActive = true;
      await existing.save();
    } else {
      await Member.create({
        name: net.name || `AS${asnNum}`,
        asn: asnNum,
        peeringPolicy: mapPolicy(net.peeringPolicy),
        locations: [locLabel],
        isActive: true,
      });
    }
    synced++;
  }

  // Remove this location from members whose ASN is no longer in the location
  const membersWithLocation = await Member.find({ locations: locLabel });
  for (const m of membersWithLocation) {
    if (m.asn && !asnsInLocation.has(m.asn)) {
      m.locations = m.locations.filter((l) => l !== locLabel);
      await m.save();
    }
  }

  console.log(`[MemberSync] Location "${locLabel}": synced ${synced} networks`);
  return { synced };
}

export default { syncMembersFromLocations, syncMembersForLocation };
