import { Request, Response } from 'express';
import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { PortalUser } from '../models';

/**
 * POST /api/portal/auth/2fa/setup
 * Generates a temporary TOTP secret + provisioning QR. The secret is only
 * persisted as `twoFactorTempSecret` until the user confirms with a code.
 */
export const setup2fa = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await PortalUser.findById(req.portalAuth!.userId);
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found.' });
      return;
    }
    if (user.twoFactorEnabled) {
      res.status(400).json({ success: false, error: 'Two-factor is already enabled.' });
      return;
    }

    const secret = authenticator.generateSecret();
    user.twoFactorTempSecret = secret;
    await user.save();

    const otpauth = authenticator.keyuri(user.email, 'MX-IX Portal', secret);
    const qrDataUrl = await QRCode.toDataURL(otpauth, { margin: 1, width: 220 });

    res.json({ success: true, data: { secret, otpauth, qr: qrDataUrl } });
  } catch (error) {
    console.error('2FA setup error:', error);
    res.status(500).json({ success: false, error: 'Failed to start 2FA setup.' });
  }
};

/**
 * POST /api/portal/auth/2fa/enable   { token }
 * Verifies a code against the temp secret, then activates 2FA.
 */
export const enable2fa = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token } = req.body;
    if (!token) {
      res.status(400).json({ success: false, error: 'Verification code is required.' });
      return;
    }
    const user = await PortalUser.findById(req.portalAuth!.userId).select('+twoFactorTempSecret');
    if (!user || !user.twoFactorTempSecret) {
      res.status(400).json({ success: false, error: 'Start 2FA setup first.' });
      return;
    }
    authenticator.options = { window: 1 };
    const ok = authenticator.check(String(token).replace(/\s/g, ''), user.twoFactorTempSecret);
    if (!ok) {
      res.status(400).json({ success: false, error: 'Invalid code. Please try again.' });
      return;
    }
    user.twoFactorSecret = user.twoFactorTempSecret;
    user.twoFactorTempSecret = null;
    user.twoFactorEnabled = true;
    await user.save();
    res.json({ success: true, message: 'Two-factor authentication enabled.' });
  } catch (error) {
    console.error('2FA enable error:', error);
    res.status(500).json({ success: false, error: 'Failed to enable 2FA.' });
  }
};

/**
 * POST /api/portal/auth/2fa/disable   { password }
 */
export const disable2fa = async (req: Request, res: Response): Promise<void> => {
  try {
    const { password } = req.body;
    const user = await PortalUser.findById(req.portalAuth!.userId).select('+password');
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found.' });
      return;
    }
    if (!password || !(await user.comparePassword(String(password)))) {
      res.status(401).json({ success: false, error: 'Password is incorrect.' });
      return;
    }
    user.twoFactorEnabled = false;
    user.twoFactorSecret = null;
    user.twoFactorTempSecret = null;
    await user.save();
    res.json({ success: true, message: 'Two-factor authentication disabled.' });
  } catch (error) {
    console.error('2FA disable error:', error);
    res.status(500).json({ success: false, error: 'Failed to disable 2FA.' });
  }
};

export default { setup2fa, enable2fa, disable2fa };
