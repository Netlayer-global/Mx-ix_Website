import { Request, Response } from 'express';
import { Blackhole } from '../models';
import { deployAll } from '../services/birdDeploy.service';

/**
 * After any blackhole change, trigger a route-server config rebuild.
 *
 * The birdConfig.service already includes active blackholes as static routes in
 * the generated config (protocol static blackholes_v4/v6). So all we need to do
 * is push a fresh config to every affected route server.
 *
 * This runs in the BACKGROUND (fire-and-forget) so the portal response is not
 * delayed by the deploy cycle. A failure here means the blackhole takes effect
 * on the next scheduled or manual deploy instead of immediately.
 */
const triggerBlackholeRedeploy = (orgId: string): void => {
  // Find which infrastructures this org has peers on, then deploy those.
  // For simplicity (blackholes are rare), we just deploy all enabled RSes.
  setImmediate(async () => {
    try {
      await deployAll({ actor: 'blackhole-trigger' });
    } catch (err) {
      console.error('[Blackhole] Auto-redeploy failed:', err);
    }
  });
};

// Basic CIDR validation for IPv4 and IPv6.
const isValidCidr = (cidr: string): boolean => {
  const v4 = /^(\d{1,3}\.){3}\d{1,3}\/(\d|[12]\d|3[0-2])$/;
  const v6 = /^([0-9a-fA-F:]+)\/(\d|[1-9]\d|1[01]\d|12[0-8])$/;
  if (v4.test(cidr)) {
    const [ip] = cidr.split('/');
    return ip.split('.').every((o) => Number(o) >= 0 && Number(o) <= 255);
  }
  return v6.test(cidr) && cidr.includes(':');
};

export const listBlackholes = async (req: Request, res: Response): Promise<void> => {
  try {
    const items = await Blackhole.find({ organization: req.organization!._id }).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: items });
  } catch (error) {
    console.error('List blackholes error:', error);
    res.status(500).json({ success: false, error: 'Failed to load blackholes.' });
  }
};

export const createBlackhole = async (req: Request, res: Response): Promise<void> => {
  try {
    const { prefix, description, expiresAt } = req.body;
    if (!prefix || !isValidCidr(String(prefix).trim())) {
      res.status(400).json({ success: false, error: 'Enter a valid CIDR prefix (e.g. 203.0.113.5/32 or 2001:db8::/48).' });
      return;
    }
    const bh = await Blackhole.create({
      organization: req.organization!._id,
      prefix: String(prefix).trim(),
      description: String(description || '').trim(),
      active: true,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      createdBy: req.portalAuth!.email,
    });

    // Trigger BIRD redeploy so the blackhole takes effect on the route servers
    triggerBlackholeRedeploy(String(req.organization!._id));

    res.status(201).json({ success: true, data: bh });
  } catch (error) {
    console.error('Create blackhole error:', error);
    res.status(500).json({ success: false, error: 'Failed to create blackhole.' });
  }
};

export const updateBlackhole = async (req: Request, res: Response): Promise<void> => {
  try {
    const { active, description, expiresAt } = req.body;
    const update: any = {};
    if (active !== undefined) update.active = !!active;
    if (description !== undefined) update.description = String(description).trim();
    if (expiresAt !== undefined) update.expiresAt = expiresAt ? new Date(expiresAt) : null;
    const bh = await Blackhole.findOneAndUpdate(
      { _id: req.params.id, organization: req.organization!._id },
      update,
      { new: true }
    );
    if (!bh) {
      res.status(404).json({ success: false, error: 'Not found.' });
      return;
    }

    // Active state changed = blackhole added/removed from BIRD config
    if (active !== undefined) {
      triggerBlackholeRedeploy(String(req.organization!._id));
    }

    res.json({ success: true, data: bh });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update.' });
  }
};

export const deleteBlackhole = async (req: Request, res: Response): Promise<void> => {
  try {
    await Blackhole.findOneAndDelete({ _id: req.params.id, organization: req.organization!._id });

    // Blackhole removed — redeploy so the static route disappears from BIRD
    triggerBlackholeRedeploy(String(req.organization!._id));

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete.' });
  }
};

export default { listBlackholes, createBlackhole, updateBlackhole, deleteBlackhole };
