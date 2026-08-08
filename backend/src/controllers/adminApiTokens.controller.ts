import { Request, Response } from 'express';
import { ApiToken, generateToken } from '../models/apiToken.model';
import { logAudit } from '../services/audit.service';

/**
 * API token management — create, list, revoke.
 *
 * Tokens are shown in plain text ONLY at creation time. After that only the
 * prefix (first 12 chars) is visible, like GitHub personal access tokens.
 */

export const listTokens = async (req: Request, res: Response): Promise<void> => {
  try {
    const tokens = await ApiToken.find({ user: req.user?.userId, realm: 'admin', revoked: false })
      .select('-tokenHash')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, data: tokens });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to load tokens.' });
  }
};

export const createToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const name = String(req.body?.name || '').trim();
    if (!name) {
      res.status(400).json({ success: false, error: 'Token name is required.' });
      return;
    }

    const scope = req.body?.scope === 'readonly' ? 'readonly' : 'full';
    const expiresAt = req.body?.expiresAt ? new Date(req.body.expiresAt) : null;

    const { plain, hash, prefix } = generateToken();

    const token = await ApiToken.create({
      user: req.user?.userId,
      realm: 'admin',
      name,
      tokenHash: hash,
      prefix,
      scope,
      expiresAt,
    });

    await logAudit({
      actor: req.user?.email,
      action: 'apitoken.create',
      resource: 'ApiToken',
      resourceId: String(token._id),
      after: { name, scope, prefix },
    });

    // Return the plain token ONCE — it cannot be retrieved again.
    res.status(201).json({
      success: true,
      data: {
        id: token._id,
        name: token.name,
        prefix: token.prefix,
        scope: token.scope,
        expiresAt: token.expiresAt,
        createdAt: token.createdAt,
        // THIS IS THE ONLY TIME THE FULL TOKEN IS SHOWN
        token: plain,
      },
      message: 'Copy this token now — it will not be shown again.',
    });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to create token.' });
  }
};

export const revokeToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const token = await ApiToken.findOneAndUpdate(
      { _id: req.params.id, user: req.user?.userId, revoked: false },
      { $set: { revoked: true, revokedAt: new Date() } },
      { new: true }
    );
    if (!token) {
      res.status(404).json({ success: false, error: 'Token not found or already revoked.' });
      return;
    }
    await logAudit({
      actor: req.user?.email,
      action: 'apitoken.revoke',
      resource: 'ApiToken',
      resourceId: String(token._id),
      after: { name: token.name, prefix: token.prefix },
    });
    res.json({ success: true, data: { revoked: true } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to revoke token.' });
  }
};

/** List ALL tokens across all users — super-admin only for auditing. */
export const listAllTokens = async (req: Request, res: Response): Promise<void> => {
  try {
    const tokens = await ApiToken.find({ realm: 'admin' })
      .select('-tokenHash')
      .populate('user', 'name email role')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, data: tokens });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to load tokens.' });
  }
};

/** Force-revoke any token — super-admin only. */
export const forceRevoke = async (req: Request, res: Response): Promise<void> => {
  try {
    const token = await ApiToken.findOneAndUpdate(
      { _id: req.params.id, revoked: false },
      { $set: { revoked: true, revokedAt: new Date() } },
      { new: true }
    );
    if (!token) {
      res.status(404).json({ success: false, error: 'Token not found or already revoked.' });
      return;
    }
    await logAudit({
      actor: req.user?.email,
      action: 'apitoken.force_revoke',
      resource: 'ApiToken',
      resourceId: String(token._id),
      after: { name: token.name, prefix: token.prefix, userId: String(token.user) },
    });
    res.json({ success: true, data: { revoked: true } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to revoke token.' });
  }
};

export default { listTokens, createToken, revokeToken, listAllTokens, forceRevoke };
