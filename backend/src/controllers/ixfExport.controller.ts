import { Request, Response } from 'express';
import {
  Infrastructure,
  Vlan,
  VlanInterface,
  VirtualInterface,
  PhysicalInterface,
  IpAddress,
  Organization,
  Switch,
  SwitchPort,
} from '../models';

/**
 * IX-F Member Export — JSON schema 1.0
 *
 * Publishes our member list in the standard IX-F format so PeeringDB and other
 * IXPs can consume it automatically. This replaces the IXP Manager dependency
 * for this purpose: we ARE the source of truth now.
 *
 * Spec: https://github.com/euro-ix/json-schemas
 *
 * Public endpoint (no auth) — the whole point is that anyone can fetch it.
 */

export const ixfExport = async (req: Request, res: Response): Promise<void> => {
  try {
    // Default to first enabled infrastructure, or allow specifying one
    const infraId = req.query?.infrastructure;
    const infraFilter: any = { enabled: true };
    if (infraId) infraFilter._id = infraId;

    const infra = await Infrastructure.findOne(infraFilter).sort({ isPrimary: -1, order: 1 }).lean();
    if (!infra) {
      res.status(404).json({ error: 'No infrastructure configured.' });
      return;
    }

    // Get all non-private VLANs on this infrastructure that are IX-F export enabled
    const vlans = await Vlan.find({
      infrastructure: infra._id,
      enabled: true,
      isPrivate: false,
      ixfExport: true,
    }).lean();

    if (!vlans.length) {
      res.status(404).json({ error: 'No VLANs configured for IX-F export.' });
      return;
    }

    const vlanIds = vlans.map((v: any) => v._id);

    // All enabled VLAN interfaces on these VLANs (= all peers)
    const vlis = await VlanInterface.find({ vlan: { $in: vlanIds }, enabled: true })
      .select('virtualInterface vlan ipv4Address ipv6Address ipv4Enabled ipv6Enabled rsClient')
      .lean();

    // Resolve virtual interfaces -> organizations
    const viIds = [...new Set(vlis.map((v: any) => String(v.virtualInterface)))];
    const vis = await VirtualInterface.find({ _id: { $in: viIds } }).select('organization').lean();
    const viById = new Map(vis.map((v: any) => [String(v._id), v]));

    // Resolve organizations
    const orgIds = [...new Set(vis.map((v: any) => String(v.organization)))];
    const orgs = await Organization.find({ _id: { $in: orgIds }, status: 'active' })
      .select('name asn website type peeringPolicy')
      .lean();
    const orgById = new Map(orgs.map((o: any) => [String(o._id), o]));

    // Resolve IP addresses
    const addrIds = vlis.flatMap((v: any) => [v.ipv4Address, v.ipv6Address]).filter(Boolean);
    const addrs = await IpAddress.find({ _id: { $in: addrIds } }).select('address family').lean();
    const addrById = new Map(addrs.map((a: any) => [String(a._id), a]));

    // Resolve physical interfaces for speed
    const pisByVi = new Map<string, any[]>();
    const pis = await PhysicalInterface.find({ virtualInterface: { $in: viIds } })
      .select('virtualInterface speed')
      .lean();
    for (const pi of pis as any[]) {
      const key = String(pi.virtualInterface);
      pisByVi.set(key, [...(pisByVi.get(key) || []), pi]);
    }

    // Build the IX-F member_list
    const memberMap = new Map<string, any>();

    for (const vli of vlis as any[]) {
      const vi = viById.get(String(vli.virtualInterface));
      if (!vi) continue;
      const org = orgById.get(String(vi.organization));
      if (!org || !org.asn) continue;

      const memberKey = String(org._id);
      if (!memberMap.has(memberKey)) {
        memberMap.set(memberKey, {
          asnum: org.asn,
          name: org.name,
          url: org.website || '',
          peering_policy: (org.peeringPolicy || 'open').toLowerCase(),
          member_since: '', // Could derive from org.createdAt
          connection_list: [],
        });
      }

      const member = memberMap.get(memberKey)!;
      const v4Addr = vli.ipv4Address ? addrById.get(String(vli.ipv4Address)) : null;
      const v6Addr = vli.ipv6Address ? addrById.get(String(vli.ipv6Address)) : null;

      // Speed from physical interfaces
      const viPis = pisByVi.get(String(vli.virtualInterface)) || [];
      const totalSpeed = viPis.reduce((sum: number, p: any) => sum + (p.speed || 0), 0);

      const vlan = vlans.find((v: any) => String(v._id) === String(vli.vlan));

      const ifList: any[] = [];
      if (v4Addr || v6Addr) {
        const iface: any = {
          switch_id: 0, // Could map to switch
          if_speed: totalSpeed || 10000,
        };
        if (v4Addr) iface.if_type = 'LAN';
        ifList.push(iface);
      }

      const connection: any = {
        ixp_id: (infra as any).ixfId || 1,
        state: 'active',
        connected_since: '',
        if_list: ifList,
        vlan_list: [],
      };

      // VLAN details with addresses
      const vlanEntry: any = { vlan_id: vlan ? vlan.number : 0 };
      if (v4Addr && vli.ipv4Enabled) {
        vlanEntry.ipv4 = {
          address: v4Addr.address,
          routeserver: vli.rsClient || false,
          max_prefix: 0,
          as_macro: '',
        };
      }
      if (v6Addr && vli.ipv6Enabled) {
        vlanEntry.ipv6 = {
          address: v6Addr.address,
          routeserver: vli.rsClient || false,
          max_prefix: 0,
          as_macro: '',
        };
      }
      connection.vlan_list.push(vlanEntry);
      member.connection_list.push(connection);
    }

    // Build IXP list
    const ixpList = [{
      ixp_id: (infra as any).ixfId || 1,
      shortname: (infra as any).shortname || 'mx-ix',
      name: (infra as any).name,
      country: '',
      url: '',
      vlan: vlans.map((v: any) => ({
        id: v.number,
        name: v.name,
        ipv4: v.ipv4Prefix ? { prefix: v.ipv4Prefix.split('/')[0], mask_length: Number(v.ipv4Prefix.split('/')[1]) } : undefined,
        ipv6: v.ipv6Prefix ? { prefix: v.ipv6Prefix.split('/')[0], mask_length: Number(v.ipv6Prefix.split('/')[1]) } : undefined,
      })),
      switch: [], // Could populate from Switch model
    }];

    const output = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      ixp_list: ixpList,
      member_list: Array.from(memberMap.values()),
    };

    // Cache for 5 minutes — this is a public endpoint and PeeringDB polls hourly
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.setHeader('Content-Type', 'application/json');
    res.json(output);
  } catch (err: any) {
    console.error('[IX-F Export] Error:', err);
    res.status(500).json({ error: 'Failed to generate IX-F export.' });
  }
};

export default { ixfExport };
