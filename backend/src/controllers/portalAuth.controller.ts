import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { authenticator } from 'otplib';
import { PortalUser, Organization, Order } from '../models';
import { IOrganization } from '../models/organization.model';
import { IPortalUser } from '../models/portalUser.model';
import config from '../config/environment';
import { sendEmail, renderTemplate } from '../services/mailer.service';

const signToken = (user: IPortalUser): string =>
  jwt.sign(
    {
      userId: user._id,
      organizationId: String(user.organization),
      email: user.email,
      role: user.role,
      kind: 'portal',
    },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn } as jwt.SignOptions
  );

const publicUser = (user: IPortalUser) => ({
  id: user._id,
  email: user.email,
  name: user.name,
  role: user.role,
  twoFactorEnabled: !!user.twoFactorEnabled,
});

const publicOrg = (org: IOrganization) => ({
  id: org._id,
  name: org.name,
  asn: org.asn,
  additionalAsns: org.additionalAsns,
  type: org.type,
  status: org.status,
  peeringPolicy: org.peeringPolicy,
  locations: org.locations,
  website: org.website,
  nocEmail: org.nocEmail,
  nocPhone: org.nocPhone,
});

/**
 * POST /api/portal/auth/signup
 * Creates a pending Organization + its first admin PortalUser.
 * Account stays `pending` until an MX-IX admin approves it.
 */
export const signup = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      companyName, asn, website, type, contactName, email, password,
      phone, peeringPolicy, additionalAsns, locations, desiredSpeed, notes,
    } = req.body;

    if (!companyName || !email || !password || !contactName) {
      res.status(400).json({ success: false, error: 'Company name, your name, email and password are required.' });
      return;
    }
    if (String(password).length < 8) {
      res.status(400).json({ success: false, error: 'Password must be at least 8 characters.' });
      return;
    }

    const existing = await PortalUser.findOne({ email: String(email).toLowerCase().trim() });
    if (existing) {
      res.status(409).json({ success: false, error: 'An account with this email already exists.' });
      return;
    }

    const extraAsns = Array.isArray(additionalAsns)
      ? additionalAsns.map((a: any) => Number(a)).filter((n: number) => Number.isFinite(n) && n > 0)
      : [];
    const orgLocations = Array.isArray(locations) ? locations.filter(Boolean).map((l: any) => String(l)) : [];
    const allowedPolicy = ['Open', 'Selective', 'Restrictive'].includes(peeringPolicy) ? peeringPolicy : 'Open';

    const org = await Organization.create({
      name: String(companyName).trim(),
      asn: asn ? Number(asn) : undefined,
      additionalAsns: extraAsns,
      website: website ? String(website).trim() : '',
      type: type || 'ISP',
      peeringPolicy: allowedPolicy,
      locations: orgLocations,
      nocEmail: String(email).toLowerCase().trim(),
      nocPhone: phone ? String(phone).trim() : '',
      notes: notes ? String(notes).trim() : '',
      status: 'pending',
    });

    await PortalUser.create({
      organization: org._id,
      email: String(email).toLowerCase().trim(),
      password: String(password),
      name: String(contactName).trim(),
      role: 'admin',
    });

    // Capture the connectivity request as an initial port application so it
    // surfaces in Admin → Orders for the team to action.
    if (orgLocations.length && desiredSpeed) {
      try {
        await Order.create({
          organization: org._id,
          type: 'new_port',
          location: orgLocations[0],
          speed: String(desiredSpeed),
          notes: notes ? String(notes).trim() : 'Submitted via onboarding',
          status: 'submitted',
          createdBy: String(email).toLowerCase().trim(),
          updates: [{ status: 'submitted', message: 'Created via onboarding wizard', by: String(contactName).trim(), at: new Date() }],
        });
      } catch (orderErr) {
        console.error('Onboarding order creation failed (account still created):', orderErr);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Account created. An MX-IX administrator will review and approve your access shortly.',
    });
  } catch (error) {
    console.error('Portal signup error:', error);
    res.status(500).json({ success: false, error: 'Signup failed.' });
  }
};

/**
 * POST /api/portal/auth/login
 */
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, token: totp } = req.body;
    if (!email || !password) {
      res.status(400).json({ success: false, error: 'Email and password are required.' });
      return;
    }

    const user = await PortalUser.findOne({ email: String(email).toLowerCase().trim() }).select(
      '+password +twoFactorSecret'
    );
    if (!user || !(await user.comparePassword(String(password)))) {
      res.status(401).json({ success: false, error: 'Invalid credentials.' });
      return;
    }
    if (!user.isActive) {
      res.status(403).json({ success: false, error: 'This login has been deactivated.' });
      return;
    }

    const org = await Organization.findById(user.organization);
    if (!org) {
      res.status(401).json({ success: false, error: 'Organization not found.' });
      return;
    }
    if (org.status === 'pending') {
      res.status(403).json({ success: false, error: 'Your account is pending approval by MX-IX.' });
      return;
    }
    if (org.status === 'suspended') {
      res.status(403).json({ success: false, error: 'Your account has been suspended. Contact MX-IX support.' });
      return;
    }

    // Two-factor enforcement
    if (user.twoFactorEnabled && user.twoFactorSecret) {
      if (!totp) {
        res.status(401).json({ success: false, error: 'Two-factor code required.', twoFactorRequired: true });
        return;
      }
      authenticator.options = { window: 1 };
      const ok = authenticator.check(String(totp).replace(/\s/g, ''), user.twoFactorSecret);
      if (!ok) {
        res.status(401).json({ success: false, error: 'Invalid two-factor code.', twoFactorRequired: true });
        return;
      }
    }

    user.lastLogin = new Date();
    await user.save();

    res.json({
      success: true,
      data: { token: signToken(user), user: publicUser(user), organization: publicOrg(org) },
    });
  } catch (error) {
    console.error('Portal login error:', error);
    res.status(500).json({ success: false, error: 'Login failed.' });
  }
};

/**
 * GET /api/portal/auth/me
 */
export const me = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = req.portalUser!;
    const org = req.organization!;
    res.json({ success: true, data: { user: publicUser(user), organization: publicOrg(org) } });
  } catch (error) {
    console.error('Portal me error:', error);
    res.status(500).json({ success: false, error: 'Failed to load profile.' });
  }
};

/**
 * POST /api/portal/auth/change-password
 */
export const changePassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      res.status(400).json({ success: false, error: 'Current and new password are required.' });
      return;
    }
    if (String(newPassword).length < 8) {
      res.status(400).json({ success: false, error: 'New password must be at least 8 characters.' });
      return;
    }

    const user = await PortalUser.findById(req.portalAuth!.userId).select('+password');
    if (!user || !(await user.comparePassword(String(currentPassword)))) {
      res.status(401).json({ success: false, error: 'Current password is incorrect.' });
      return;
    }

    user.password = String(newPassword);
    await user.save();
    res.json({ success: true, message: 'Password changed successfully.' });
  } catch (error) {
    console.error('Portal change password error:', error);
    res.status(500).json({ success: false, error: 'Failed to change password.' });
  }
};

/**
 * POST /api/portal/auth/forgot-password
 * Generates a reset token and emails a link. Always responds success to avoid
 * leaking which emails exist.
 */
export const forgotPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;
    const generic = {
      success: true,
      message: 'If an account exists for that email, a password reset link has been sent.',
    };
    if (!email) {
      res.json(generic);
      return;
    }

    const user = await PortalUser.findOne({ email: String(email).toLowerCase().trim() });
    if (user && user.isActive) {
      const token = crypto.randomBytes(32).toString('hex');
      user.resetToken = crypto.createHash('sha256').update(token).digest('hex');
      user.resetTokenExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await user.save();

      const base = config.frontendUrl.replace(/\/$/, '');
      const link = `${base}/portal?reset=${token}`;
      const { subject, html } = await renderTemplate(
        'password_reset',
        { name: user.name || 'there', link, email: user.email },
        {
          subject: 'Reset your MX-IX portal password',
          html: `<p>Hi ${user.name},</p>
         <p>We received a request to reset your MX-IX member portal password. This link is valid for one hour:</p>
         <p><a href="${link}">${link}</a></p>
         <p>If you didn't request this, you can safely ignore this email.</p>
         <p>— MX-IX</p>`,
        }
      );
      await sendEmail(user.email, subject, html);
    }

    res.json(generic);
  } catch (error) {
    console.error('Portal forgot-password error:', error);
    res.status(500).json({ success: false, error: 'Failed to process request.' });
  }
};

/**
 * POST /api/portal/auth/reset-password   { token, newPassword }
 */
export const resetPassword = async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) {
      res.status(400).json({ success: false, error: 'Token and new password are required.' });
      return;
    }
    if (String(newPassword).length < 8) {
      res.status(400).json({ success: false, error: 'Password must be at least 8 characters.' });
      return;
    }

    const hashed = crypto.createHash('sha256').update(String(token)).digest('hex');
    const user = await PortalUser.findOne({
      resetToken: hashed,
      resetTokenExpires: { $gt: new Date() },
    }).select('+password +resetToken +resetTokenExpires');

    if (!user) {
      res.status(400).json({ success: false, error: 'This reset link is invalid or has expired.' });
      return;
    }

    user.password = String(newPassword);
    user.resetToken = null;
    user.resetTokenExpires = null;
    await user.save();

    res.json({ success: true, message: 'Password reset successfully. You can now sign in.' });
  } catch (error) {
    console.error('Portal reset-password error:', error);
    res.status(500).json({ success: false, error: 'Failed to reset password.' });
  }
};

export default { signup, login, me, changePassword, forgotPassword, resetPassword };