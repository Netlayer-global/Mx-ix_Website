import { Request, Response } from 'express';
import {
  Infrastructure,
  Vlan,
  VlanInterface,
  VirtualInterface,
  IpAddress,
  Organization,
  IrrdbPrefix,
} from '../models';

/**
 * Export generators — reverse DNS, Nagios, TACACS, RIR objects, MANRS.
 *
 * Each endpoint returns plain text (or JSON where appropriate) that an operator
 * can download and feed into their DNS server, monitoring system, or submit to
 * their RIR. The admin UI offers these as download buttons.
 */

const textResponse = (res: Response, content: string, filename: string): void => {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(content);
};

// ══════════════════════════════════════════════════════════════════════════════
// Reverse DNS / ARPA zone
// ══════════════════════════════════════════════════════════════════════════════

export const reverseDns = async (req: Request, res: Response): Promise<void> => {
  try {
    const vlanId = req.query?.vlan;
    const family = req.query?.family === '6' ? 6 : 4;

    const filter: any = {};
    if (vlanId) filter._id = vlanId;
    else filter.enabled = true;

    const vlans = await Vlan.find(filter).lean();
    const vlanIds = vlans.map((v: any) => v._id);

    const addresses = await IpAddress.find({
      vlan: { $in: vlanIds },
      family,
      assignedTo: { $ne: null },
    })
      .populate({
        path: 'assignedTo',
        select: 'virtualInterface ipv4Hostname ipv6Hostname',
        populate: {
          path: 'virtualInterface',
          select: 'organization',
          populate: { path: 'organization', select: 'name asn' },
        },
      })
      .lean();

    const lines: string[] = [
      `; MX-IX Reverse DNS zone — IPv${family}`,
      `; Generated: ${new Date().toISOString()}`,
      `; ${addresses.length} PTR records`,
      '',
    ];

    for (const addr of addresses as any[]) {
      const vli = addr.assignedTo;
      if (!vli) continue;
      const org = vli.virtualInterface?.organization;
      if (!org) continue;

      const hostname =
        (family === 4 ? vli.ipv4Hostname : vli.ipv6Hostname) ||
        `as${org.asn}.${(vlans.find((v: any) => String(v._id) === String(addr.vlan)) as any)?.shortname || 'peering'}.mx-ix.net`;

      if (family === 4) {
        // 42.191.139.103.in-addr.arpa. PTR as64500.peering.mx-ix.net.
        const octets = addr.address.split('.').reverse().join('.');
        lines.push(`${octets}.in-addr.arpa.\tIN\tPTR\t${hostname}.`);
      } else {
        // Nibble-reversed IPv6
        const expanded = addr.address.replace(/:/g, '').padStart(32, '0');
        const nibbles = expanded.split('').reverse().join('.');
        lines.push(`${nibbles}.ip6.arpa.\tIN\tPTR\t${hostname}.`);
      }
    }

    textResponse(res, lines.join('\n'), `reverse-dns-ipv${family}.zone`);
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to generate reverse DNS.' });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// Nagios monitoring config
// ══════════════════════════════════════════════════════════════════════════════

export const nagiosConfig = async (req: Request, res: Response): Promise<void> => {
  try {
    const vlanId = req.query?.vlan;
    const protocol = req.query?.protocol === '6' ? 6 : 4;

    const filter: any = { enabled: true };
    if (vlanId) filter._id = vlanId;

    const vlans = await Vlan.find(filter).lean();
    const vlanIds = vlans.map((v: any) => v._id);

    const vlis = await VlanInterface.find({
      vlan: { $in: vlanIds },
      enabled: true,
      [`ipv${protocol}Enabled`]: true,
      [`ipv${protocol}CanPingMonitor`]: true,
    })
      .select(`virtualInterface ipv${protocol}Address`)
      .lean();

    const viIds = vlis.map((v: any) => v.virtualInterface);
    const vis = await VirtualInterface.find({ _id: { $in: viIds } }).select('organization').lean();
    const viById = new Map(vis.map((v: any) => [String(v._id), v]));

    const orgIds = vis.map((v: any) => v.organization);
    const orgs = await Organization.find({ _id: { $in: orgIds }, status: 'active' }).select('name asn').lean();
    const orgById = new Map(orgs.map((o: any) => [String(o._id), o]));

    const addrField = protocol === 4 ? 'ipv4Address' : 'ipv6Address';
    const addrIds = vlis.map((v: any) => v[addrField]).filter(Boolean);
    const addrs = await IpAddress.find({ _id: { $in: addrIds } }).select('address').lean();
    const addrById = new Map(addrs.map((a: any) => [String(a._id), a.address]));

    const lines: string[] = [
      `# MX-IX Nagios monitoring — IPv${protocol} ping checks`,
      `# Generated: ${new Date().toISOString()}`,
      `# ${vlis.length} hosts`,
      '',
    ];

    for (const vli of vlis as any[]) {
      const vi = viById.get(String(vli.virtualInterface));
      if (!vi) continue;
      const org = orgById.get(String(vi.organization));
      if (!org) continue;
      const address = addrById.get(String(vli[addrField]));
      if (!address) continue;

      const hostName = `as${org.asn}-${org.name.replace(/[^A-Za-z0-9]/g, '-').toLowerCase()}`;

      lines.push(`define host {`);
      lines.push(`    use                 generic-host`);
      lines.push(`    host_name           ${hostName}`);
      lines.push(`    alias               AS${org.asn} ${org.name}`);
      lines.push(`    address             ${address}`);
      lines.push(`    hostgroups          ixp-members`);
      lines.push(`}`);
      lines.push('');
    }

    textResponse(res, lines.join('\n'), `nagios-ipv${protocol}.cfg`);
  } catch {
    res.status(500).json({ success: false, error: 'Failed to generate Nagios config.' });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// TACACS user list
// ══════════════════════════════════════════════════════════════════════════════

export const tacacsList = async (req: Request, res: Response): Promise<void> => {
  try {
    // TACACS exports user details for switch access control. In IXP context
    // this means admin users who are allowed to log into the switches.
    const { User } = await import('../models/user.model');
    const users = await User.find({ isActive: true }).select('name email role').lean();

    const lines: string[] = [
      `# MX-IX TACACS+ user list`,
      `# Generated: ${new Date().toISOString()}`,
      `# ${users.length} users`,
      '',
    ];

    for (const user of users as any[]) {
      const username = user.email.split('@')[0].replace(/[^a-z0-9._-]/gi, '');
      lines.push(`user = ${username} {`);
      lines.push(`    member = ${user.role === 'super-admin' || user.role === 'admin' ? 'admin' : 'readonly'}`);
      lines.push(`    # ${user.name} <${user.email}>`);
      lines.push(`}`);
      lines.push('');
    }

    textResponse(res, lines.join('\n'), 'tacacs-users.conf');
  } catch {
    res.status(500).json({ success: false, error: 'Failed to generate TACACS list.' });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// RIR objects (as-set / route objects)
// ══════════════════════════════════════════════════════════════════════════════

export const rirObjects = async (req: Request, res: Response): Promise<void> => {
  try {
    const infra = await Infrastructure.findOne({ enabled: true }).sort({ isPrimary: -1 }).lean();
    if (!infra) {
      res.status(404).json({ success: false, error: 'No infrastructure configured.' });
      return;
    }

    const vlans = await Vlan.find({ infrastructure: (infra as any)._id, enabled: true, isPrivate: false }).lean();
    const vlanIds = vlans.map((v: any) => v._id);

    const vlis = await VlanInterface.find({ vlan: { $in: vlanIds }, enabled: true, rsClient: true }).select('virtualInterface').lean();
    const viIds = vlis.map((v: any) => v.virtualInterface);
    const vis = await VirtualInterface.find({ _id: { $in: viIds } }).select('organization').lean();
    const orgIds = [...new Set(vis.map((v: any) => String(v.organization)))];
    const orgs = await Organization.find({ _id: { $in: orgIds }, status: 'active' }).select('asn irrAsSet').lean();

    const ixAsn = (infra as any).asn;
    const ixName = (infra as any).shortname?.toUpperCase() || 'MX-IX';

    const lines: string[] = [
      `# MX-IX RIR Objects`,
      `# Generated: ${new Date().toISOString()}`,
      `# Infrastructure: ${(infra as any).name} (AS${ixAsn})`,
      '',
      `# ── as-set for our IX (contains all member ASNs) ──`,
      `as-set:     AS-${ixName}`,
      `descr:      ${(infra as any).name} member ASNs`,
      `tech-c:     AUTO-1`,
      `admin-c:    AUTO-1`,
      `mnt-by:     MAINT-${ixName}`,
    ];

    for (const org of orgs as any[]) {
      if (org.asn) lines.push(`members:    AS${org.asn}`);
    }
    lines.push(`source:     RADB`);
    lines.push('');

    // Route objects for our own peering LAN prefixes
    lines.push(`# ── route/route6 objects for peering LAN prefixes ──`);
    for (const vlan of vlans as any[]) {
      if (vlan.ipv4Prefix) {
        lines.push(`route:      ${vlan.ipv4Prefix}`);
        lines.push(`descr:      ${(infra as any).name} peering LAN (${vlan.name})`);
        lines.push(`origin:     AS${ixAsn}`);
        lines.push(`mnt-by:     MAINT-${ixName}`);
        lines.push(`source:     RADB`);
        lines.push('');
      }
      if (vlan.ipv6Prefix) {
        lines.push(`route6:     ${vlan.ipv6Prefix}`);
        lines.push(`descr:      ${(infra as any).name} peering LAN IPv6 (${vlan.name})`);
        lines.push(`origin:     AS${ixAsn}`);
        lines.push(`mnt-by:     MAINT-${ixName}`);
        lines.push(`source:     RADB`);
        lines.push('');
      }
    }

    textResponse(res, lines.join('\n'), 'rir-objects.txt');
  } catch {
    res.status(500).json({ success: false, error: 'Failed to generate RIR objects.' });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// MANRS compliance report
// ══════════════════════════════════════════════════════════════════════════════

export const manrsReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const vlans = await Vlan.find({ enabled: true, isPrivate: false }).lean();
    const vlanIds = vlans.map((v: any) => v._id);

    const vlis = await VlanInterface.find({ vlan: { $in: vlanIds }, enabled: true, rsClient: true })
      .select('virtualInterface irrdbFilter rpkiFilter')
      .lean();

    const viIds = vlis.map((v: any) => v.virtualInterface);
    const vis = await VirtualInterface.find({ _id: { $in: viIds } }).select('organization').lean();
    const viById = new Map(vis.map((v: any) => [String(v._id), v]));

    const orgIds = [...new Set(vis.map((v: any) => String(v.organization)))];
    const orgs = await Organization.find({ _id: { $in: orgIds }, status: 'active' }).select('name asn irrAsSet').lean();
    const orgById = new Map(orgs.map((o: any) => [String(o._id), o]));

    // Check IRRDB cache availability
    const cachedAsns = await IrrdbPrefix.find({ prefixes: { $exists: true, $ne: [] } }).distinct('asn');
    const cachedSet = new Set(cachedAsns.map(Number));

    const report: any[] = [];
    for (const vli of vlis as any[]) {
      const vi = viById.get(String(vli.virtualInterface));
      if (!vi) continue;
      const org = orgById.get(String(vi.organization));
      if (!org) continue;

      const hasPrefixFilter = vli.irrdbFilter && cachedSet.has(org.asn);
      const hasRpki = vli.rpkiFilter;
      const hasIrrRegistration = !!org.irrAsSet;

      report.push({
        asn: org.asn,
        name: org.name,
        // MANRS action 1: Filtering — are we filtering their announcements?
        prefixFiltering: hasPrefixFilter,
        // MANRS action 2: Anti-spoofing — not directly measurable from our side
        antiSpoofing: 'unknown',
        // MANRS action 3: Coordination — do they have IRR records?
        irrRegistered: hasIrrRegistration,
        irrAsSet: org.irrAsSet || '',
        // MANRS action 4: Global validation — RPKI
        rpkiValidation: hasRpki,
        // Compliance score (out of actions we can measure: 1, 3, 4)
        score: (hasPrefixFilter ? 1 : 0) + (hasIrrRegistration ? 1 : 0) + (hasRpki ? 1 : 0),
        maxScore: 3,
      });
    }

    // Deduplicate by ASN (same org on multiple VLANs)
    const byAsn = new Map<number, any>();
    for (const r of report) {
      const existing = byAsn.get(r.asn);
      if (!existing || r.score > existing.score) byAsn.set(r.asn, r);
    }
    const deduped = Array.from(byAsn.values()).sort((a, b) => a.score - b.score || a.asn - b.asn);

    const totalMembers = deduped.length;
    const fullyCompliant = deduped.filter((r) => r.score === r.maxScore).length;
    const withPrefixFilter = deduped.filter((r) => r.prefixFiltering).length;
    const withRpki = deduped.filter((r) => r.rpkiValidation).length;
    const withIrr = deduped.filter((r) => r.irrRegistered).length;

    res.json({
      success: true,
      data: {
        generatedAt: new Date().toISOString(),
        summary: {
          totalMembers,
          fullyCompliant,
          fullyCompliantPct: totalMembers ? Math.round((fullyCompliant / totalMembers) * 100) : 0,
          withPrefixFilter,
          withPrefixFilterPct: totalMembers ? Math.round((withPrefixFilter / totalMembers) * 100) : 0,
          withRpki,
          withRpkiPct: totalMembers ? Math.round((withRpki / totalMembers) * 100) : 0,
          withIrr,
          withIrrPct: totalMembers ? Math.round((withIrr / totalMembers) * 100) : 0,
        },
        members: deduped,
      },
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to generate MANRS report.' });
  }
};

export default {
  reverseDns,
  nagiosConfig,
  tacacsList,
  rirObjects,
  manrsReport,
};
