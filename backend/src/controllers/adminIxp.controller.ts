import { Request, Response } from 'express';
import { Organization, Port } from '../models';
import ixpManager from '../services/ixpManager.service';
import { getEffectiveIxpManager } from '../models/settings.model';
import { logAudit } from '../services/audit.service';

/** Defensive field readers for varying IXP Manager API shapes. */
const ixpAsn = (m: any) => Number(m.autsys ?? m.asn ?? m.asnumber ?? 0) || undefined;
const ixpName = (m: any) => String(m.name ?? m.shortname ?? m.company ?? `Member ${m.id ?? ''}`).trim();
const ixpId = (m: any) => String(m.id ?? m.custid ?? '');

/**
 * GET /api/admin/ixp/status — is IXP Manager configured & reachable?
 */
export const ixpStatus = async (_req: Request, res: Response): Promise<void> => {
  const cfg = await getEffectiveIxpManager();
  if (!cfg.enabled) {
    res.json({ success: true, data: { configured: false, connected: false } });
    return;
  }
  const test = await ixpManager.testConnection();
  res.json({ success: true, data: { configured: true, connected: test.ok, error: test.error } });
};

/**
 * GET /api/admin/ixp/members — raw member list pulled from IXP Manager,
 * annotated with whether each is already linked in our DB.
 */
export const ixpMembersPreview = async (_req: Request, res: Response): Promise<void> => {
  const cfg = await getEffectiveIxpManager();
  if (!cfg.enabled) {
    res.json({ success: false, error: 'IXP Manager is not configured.' });
    return;
  }
  const result = await ixpManager.fetchMembers();
  if (!result.ok) {
    res.json({ success: false, error: result.error });
    return;
  }
  const members = Array.isArray(result.data) ? result.data : [];
  const orgs = await Organization.find().select('name asn ixpManagerId').lean();
  const byIxpId = new Map(orgs.filter((o) => o.ixpManagerId).map((o) => [String(o.ixpManagerId), o]));
  const byAsn = new Map(orgs.filter((o) => o.asn).map((o) => [Number(o.asn), o]));

  const rows = members.map((m: any) => {
    const id = ixpId(m);
    const asn = ixpAsn(m);
    const matched = byIxpId.get(id) || (asn ? byAsn.get(asn) : undefined);
    return {
      ixpManagerId: id,
      name: ixpName(m),
      asn,
      matchedOrg: matched ? { id: matched._id, name: matched.name, linked: !!matched.ixpManagerId } : null,
    };
  });
  res.json({ success: true, data: rows });
};

/**
 * POST /api/admin/ixp/sync — auto-link IXP Manager members to our orgs by
 * ASN (or existing link). Sets ixpManagerId where matched.
 */
export const ixpSync = async (req: Request, res: Response): Promise<void> => {
  const cfg = await getEffectiveIxpManager();
  if (!cfg.enabled) {
    res.json({ success: false, error: 'IXP Manager is not configured.' });
    return;
  }
  const result = await ixpManager.fetchMembers();
  if (!result.ok) {
    res.json({ success: false, error: result.error });
    return;
  }
  const members = Array.isArray(result.data) ? result.data : [];
  let linked = 0;
  const unmatched: any[] = [];

  for (const m of members) {
    const id = ixpId(m);
    const asn = ixpAsn(m);
    if (!id) continue;
    let org = await Organization.findOne({ ixpManagerId: id });
    if (!org && asn) org = await Organization.findOne({ asn });
    if (org) {
      if (!org.ixpManagerId) {
        org.ixpManagerId = id;
        await org.save();
        linked++;
      }
    } else {
      unmatched.push({ ixpManagerId: id, name: ixpName(m), asn });
    }
  }

  await logAudit({
    actor: req.user?.email,
    action: 'ixp.sync',
    resource: 'IXPManager',
    after: { fetched: members.length, linked, unmatched: unmatched.length },
  });

  res.json({ success: true, data: { fetched: members.length, linked, unmatched } });
};

/**
 * POST /api/admin/ixp/import-ports/:orgId — pull the member's virtual
 * interfaces from IXP Manager and upsert them as Ports.
 */
export const ixpImportPorts = async (req: Request, res: Response): Promise<void> => {
  const cfg = await getEffectiveIxpManager();
  if (!cfg.enabled) {
    res.json({ success: false, error: 'IXP Manager is not configured.' });
    return;
  }
  const org = await Organization.findById(req.params.orgId);
  if (!org || !org.ixpManagerId) {
    res.json({ success: false, error: 'Customer is not linked to an IXP Manager member.' });
    return;
  }
  const result = await ixpManager.fetchPorts();
  if (!result.ok) {
    res.json({ success: false, error: result.error });
    return;
  }
  const all = Array.isArray(result.data) ? result.data : [];
  const mine = all.filter((vi: any) => String(vi.custid ?? vi.customerid ?? '') === String(org.ixpManagerId));

  let imported = 0;
  for (const vi of mine) {
    const ref = String(vi.id ?? '');
    if (!ref) continue;
    const existing = await Port.findOne({ organization: org._id, ixpManagerPortId: ref });
    const data: any = {
      organization: org._id,
      name: vi.name || `Port ${ref}`,
      location: vi.location?.name || vi.locationname || '',
      speed: vi.speed ? `${Math.round(Number(vi.speed) / 1000)}G` : '10G',
      ixpManagerPortId: ref,
      status: 'active',
    };
    if (existing) {
      await Port.updateOne({ _id: existing._id }, data);
    } else {
      await Port.create(data);
      imported++;
    }
  }
  await logAudit({ actor: req.user?.email, action: 'ixp.import_ports', resource: 'Organization', resourceId: String(org._id), after: { imported } });
  res.json({ success: true, data: { imported, total: mine.length } });
};

export default { ixpStatus, ixpMembersPreview, ixpSync, ixpImportPorts };
