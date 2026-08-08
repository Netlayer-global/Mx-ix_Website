import { Request, Response } from 'express';
import {
  Infrastructure,
  Vlan,
  VlanInterface,
  VirtualInterface,
  IpAddress,
  Organization,
} from '../models';

/**
 * Peering matrix — who-peers-with-whom grid.
 *
 * Every member with rsClient=true on a peeringMatrix-enabled VLAN is considered
 * to peer with every OTHER rsClient on the same VLAN (through the route server).
 * Bilateral peers (rsClient=false) are listed separately but not counted in the
 * matrix since we can't confirm whether a private session exists without sFlow.
 *
 * Public endpoint — the peering matrix is traditionally published openly.
 */

export interface MatrixMember {
  id: string;
  name: string;
  asn: number;
  type?: string;
  peeringPolicy?: string;
  ipv4?: string;
  ipv6?: string;
  rsClient: boolean;
}

export interface MatrixVlan {
  id: string;
  name: string;
  number: number;
  infrastructure: string;
  infrastructureName: string;
}

export const getPeeringMatrix = async (req: Request, res: Response): Promise<void> => {
  try {
    const infraId = req.query?.infrastructure;

    // Get VLANs that participate in the matrix
    const vlanFilter: any = { enabled: true, isPrivate: false, peeringMatrix: true };
    if (infraId) vlanFilter.infrastructure = infraId;

    const vlans = await Vlan.find(vlanFilter)
      .populate('infrastructure', 'name shortname')
      .sort({ number: 1 })
      .lean();

    if (!vlans.length) {
      res.json({ success: true, data: { vlans: [], members: [], matrix: {} } });
      return;
    }

    const vlanIds = vlans.map((v: any) => v._id);

    // All enabled peers on these VLANs
    const vlis = await VlanInterface.find({ vlan: { $in: vlanIds }, enabled: true })
      .select('virtualInterface vlan ipv4Address ipv6Address rsClient')
      .lean();

    // Resolve chain: VlanInterface -> VirtualInterface -> Organization
    const viIds = [...new Set(vlis.map((v: any) => String(v.virtualInterface)))];
    const vis = await VirtualInterface.find({ _id: { $in: viIds } }).select('organization').lean();
    const viById = new Map(vis.map((v: any) => [String(v._id), v]));

    const orgIds = [...new Set(vis.map((v: any) => String(v.organization)))];
    const orgs = await Organization.find({ _id: { $in: orgIds }, status: 'active' })
      .select('name asn type peeringPolicy')
      .lean();
    const orgById = new Map(orgs.map((o: any) => [String(o._id), o]));

    // Resolve addresses
    const addrIds = vlis.flatMap((v: any) => [v.ipv4Address, v.ipv6Address]).filter(Boolean);
    const addrs = await IpAddress.find({ _id: { $in: addrIds } }).select('address').lean();
    const addrById = new Map(addrs.map((a: any) => [String(a._id), a.address]));

    // Build the members list (unique by ASN across all VLANs)
    const membersByAsn = new Map<number, MatrixMember>();
    // Track which ASNs are RS clients on which VLANs
    const rsClientsByVlan = new Map<string, Set<number>>();

    for (const vlan of vlans) {
      rsClientsByVlan.set(String((vlan as any)._id), new Set());
    }

    for (const vli of vlis as any[]) {
      const vi = viById.get(String(vli.virtualInterface));
      if (!vi) continue;
      const org = orgById.get(String(vi.organization));
      if (!org || !org.asn) continue;

      const v4 = vli.ipv4Address ? addrById.get(String(vli.ipv4Address)) : undefined;
      const v6 = vli.ipv6Address ? addrById.get(String(vli.ipv6Address)) : undefined;

      if (!membersByAsn.has(org.asn)) {
        membersByAsn.set(org.asn, {
          id: String(org._id),
          name: org.name,
          asn: org.asn,
          type: org.type,
          peeringPolicy: org.peeringPolicy,
          ipv4: v4,
          ipv6: v6,
          rsClient: vli.rsClient,
        });
      }

      // Track RS clients per VLAN for the matrix
      if (vli.rsClient) {
        const vlanSet = rsClientsByVlan.get(String(vli.vlan));
        if (vlanSet) vlanSet.add(org.asn);
      }
    }

    // Build the matrix: for each VLAN, every RS client peers with every other
    // RS client (through the route server). The matrix[vlanId] is an array of
    // ASN pairs that can reach each other.
    const matrix: Record<string, { rsClients: number[]; peerCount: number }> = {};
    for (const vlan of vlans) {
      const vlanId = String((vlan as any)._id);
      const clients = Array.from(rsClientsByVlan.get(vlanId) || []).sort((a, b) => a - b);
      // N route-server clients can all see each other = N*(N-1)/2 peering relationships
      matrix[vlanId] = {
        rsClients: clients,
        peerCount: clients.length > 1 ? (clients.length * (clients.length - 1)) / 2 : 0,
      };
    }

    const vlanList: MatrixVlan[] = vlans.map((v: any) => ({
      id: String(v._id),
      name: v.name,
      number: v.number,
      infrastructure: String(v.infrastructure?._id || v.infrastructure),
      infrastructureName: v.infrastructure?.name || '',
    }));

    const members = Array.from(membersByAsn.values()).sort((a, b) => a.asn - b.asn);

    // Summary stats
    const totalMembers = members.length;
    const totalRsClients = members.filter((m) => m.rsClient).length;
    const totalPeeringSessions = Object.values(matrix).reduce((n, v) => n + v.peerCount, 0);

    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json({
      success: true,
      data: {
        vlans: vlanList,
        members,
        matrix,
        stats: {
          totalMembers,
          totalRsClients,
          totalPeeringSessions,
          bilateralOnly: totalMembers - totalRsClients,
        },
      },
    });
  } catch (err: any) {
    console.error('[PeeringMatrix] Error:', err);
    res.status(500).json({ success: false, error: 'Failed to generate the peering matrix.' });
  }
};

export default { getPeeringMatrix };
