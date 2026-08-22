import { Request, Response } from 'express';
import { Organization, Port } from '../models';
import { Infrastructure } from '../models/infrastructure.model';
import { Vlan } from '../models/vlan.model';
import { VlanInterface } from '../models/vlanInterface.model';
import { VirtualInterface } from '../models/virtualInterface.model';
import { PhysicalInterface } from '../models/physicalInterface.model';
import { Switch } from '../models/switch.model';
import { SwitchPort } from '../models/switchPort.model';
import { Facility } from '../models/facility.model';

/**
 * GET /api/ix-f/member-export/1.0
 *
 * Generates a Euro-IX JSON Member List (IX-F schema 1.0) from the in-house
 * database. This is the format PeeringDB, IXP Manager, and peering automation
 * tools expect.
 *
 * Reference: https://github.com/euro-ix/json-schemas
 *
 * The export is built dynamically from active organisations, their virtual
 * interfaces (connections), physical interfaces (ports), VLAN interfaces
 * (IP assignments), and infrastructure metadata.
 */
export const ixfMemberExport = async (_req: Request, res: Response): Promise<void> => {
  try {
    // Gather infrastructure, facilities, switches and VLANs for the ixp_list.
    const infras = await Infrastructure.find().lean();
    const allFacilities = await Facility.find().lean();
    const allSwitches = await Switch.find().lean();
    const allVlans = await Vlan.find().lean();

    // Active member organisations with at least one connection.
    const orgs = await Organization.find({ status: 'active' }).lean();
    const orgIds = orgs.map((o) => String(o._id));

    // Virtual interfaces (connections) for active orgs.
    const vis = await VirtualInterface.find({ organization: { $in: orgIds } }).lean();
    const viIds = vis.map((v) => String(v._id));

    // Physical interfaces bound to those VIs.
    const pis = await PhysicalInterface.find({ virtualInterface: { $in: viIds } }).lean();

    // VLAN interfaces (IP assignments) on those VIs.
    const vlis = await VlanInterface.find({ virtualInterface: { $in: viIds } }).lean();

    // Build switch port → switch lookup for if_list.switch_id
    const spIds = pis.map((p) => p.switchPort).filter(Boolean);
    const sps = spIds.length ? await SwitchPort.find({ _id: { $in: spIds } }).lean() : [];
    const spMap = new Map(sps.map((sp) => [String(sp._id), sp]));

    // VLAN map for ixlan prefix info
    const vlanMap = new Map(allVlans.map((v) => [String(v._id), v]));

    // Build ixp_list with switches and VLANs per infrastructure.
    const ixpList = infras.map((infra) => {
      const infraId = String(infra._id);
      const switches = allSwitches
        .filter((s) => String(s.infrastructure) === infraId)
        .map((s) => ({
          id: String(s._id),
          name: s.name,
          colo: '',
          software: s.os || '',
        }));

      const vlans = allVlans
        .filter((v) => String(v.infrastructure) === infraId)
        .map((v) => ({
          id: String(v._id),
          name: v.name,
          ipv4: v.ipv4Prefix ? { prefix: v.ipv4Prefix.split('/')[0], mask_length: Number(v.ipv4Prefix.split('/')[1]) || 0 } : undefined,
          ipv6: v.ipv6Prefix ? { prefix: v.ipv6Prefix.split('/')[0], mask_length: Number(v.ipv6Prefix.split('/')[1]) || 0 } : undefined,
        }));

      return {
        ixp_id: infraId,
        shortname: infra.shortname || infra.name,
        name: infra.name,
        country: 'IN',
        url: infra.nocWebsite || '',
        peeringdb_id: infra.peeringdbIxId || undefined,
        ixf_id: infra.ixfId || undefined,
        support_email: infra.nocEmail || '',
        support_phone: infra.nocPhone || '',
        switch: switches,
        vlan: vlans,
      };
    });

    // Build member_list.
    const memberList = orgs.map((org) => {
      const orgId = String(org._id);
      const orgVis = vis.filter((v) => String(v.organization) === orgId);

      const connectionList = orgVis.map((vi) => {
        const viId = String(vi._id);
        const viPis = pis.filter((p) => String(p.virtualInterface) === viId);
        const viVlis = vlis.filter((vl) => String(vl.virtualInterface) === viId);

        const ifList = viPis.map((pi) => {
          const sp = pi.switchPort ? spMap.get(String(pi.switchPort)) : null;
          return {
            switch_id: sp?.switch ? String(sp.switch) : undefined,
            if_speed: pi.speed || (sp?.speed ? parseSpeed(String(sp.speed)) : 0),
            if_type: '',
          };
        });

        const vlanList = viVlis.map((vli) => {
          const vlan = vli.vlan ? vlanMap.get(String(vli.vlan)) : null;
          return {
            vlan_id: vlan ? String(vlan._id) : undefined,
            ipv4: { address: vli.ipv4Hostname || '', max_prefix: vli.maxPrefixesV4 || 100, as_macro: '' },
            ipv6: { address: (vli as any).ipv6Hostname || '', max_prefix: vli.maxPrefixesV6 || 50, as_macro: '' },
          };
        });

        return {
          ixp_id: vi.infrastructure ? String(vi.infrastructure) : ixpList[0]?.ixp_id || '',
          state: 'active',
          connected_since: vi.createdAt ? new Date(vi.createdAt).toISOString().slice(0, 10) : '',
          if_list: ifList,
          vlan_list: vlanList,
        };
      });

      return {
        asnum: org.asn || 0,
        member_since: org.approvedAt ? new Date(org.approvedAt).toISOString().slice(0, 10) : '',
        name: org.name,
        url: org.website || '',
        peering_policy: org.peeringPolicy || 'open',
        member_type: mapMemberType(org.type),
        connection_list: connectionList,
      };
    }).filter((m) => m.asnum > 0); // IX-F requires a valid ASN

    const output = {
      version: '1.0',
      timestamp: new Date().toISOString(),
      ixp_list: ixpList,
      member_list: memberList,
    };

    res.set('Content-Type', 'application/json');
    res.set('Cache-Control', 'public, max-age=300');
    res.json(output);
  } catch (error) {
    console.error('IX-F export error:', error);
    res.status(500).json({ error: 'Failed to generate IX-F member export.' });
  }
};

/** Parse "10G" / "100G" / "400G" to Mbit/s as IX-F expects. */
function parseSpeed(s: string): number {
  const n = parseFloat(s.replace(/[^0-9.]/g, '')) || 0;
  if (/t/i.test(s)) return n * 1_000_000;
  if (/g/i.test(s)) return n * 1000;
  return n;
}

/** Map our org.type to the IX-F member_type enum. */
function mapMemberType(type?: string): string {
  switch (type?.toLowerCase()) {
    case 'isp': return 'peering';
    case 'content': return 'peering';
    case 'enterprise': return 'peering';
    case 'cdn': return 'peering';
    case 'nsp': return 'peering';
    case 'ixp': return 'ixp';
    case 'routeserver': return 'routeserver';
    default: return 'peering';
  }
}

export default { ixfMemberExport };

// Alias for the inline route in index.ts that imports { ixfExport }
export { ixfMemberExport as ixfExport };
