import { Request, Response } from 'express';
import ixpImport from '../services/ixpManagerImport.service';

/**
 * IXP Manager one-time import tool.
 *
 * Super-admin only — this is a migration action that creates data in bulk.
 */

export const runImport = async (req: Request, res: Response): Promise<void> => {
  try {
    const result = await ixpImport.runImport({
      actor: req.user?.email,
      infrastructureId: req.body?.infrastructureId,
      vlanId: req.body?.vlanId,
      autoCreateOrgs: req.body?.autoCreateOrgs !== false,
      dryRun: req.body?.dryRun === true,
    });

    if (!result.ok) {
      res.status(400).json({ success: false, error: result.error, data: result.stats });
      return;
    }
    res.json({ success: true, data: result.stats, message: req.body?.dryRun ? 'Dry run complete — nothing was written.' : 'Import complete.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Import failed.' });
  }
};

export const retire = async (req: Request, res: Response): Promise<void> => {
  try {
    await ixpImport.retireIntegration(req.user?.email);
    res.json({ success: true, message: 'IXP Manager integration has been disabled. You are now the source of truth.' });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to retire the integration.' });
  }
};

export default { runImport, retire };
