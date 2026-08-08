import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { Organization, PortalUser } from '../models';
import { getEffectivePeeringDb } from '../models/settings.model';
import config from '../config/environment';

/**
 * PeeringDB OAuth2 login for the member portal.
 *
 * Flow:
 *   1. Frontend calls GET /portal/auth/peeringdb → gets redirectUrl
 *   2. User authorises on PeeringDB
 *   3. PeeringDB redirects to our callback with ?code=
 *   4. Backend exchanges code for access token
 *   5. Fetches the user's PeeringDB profile (ASN)
 *   6. Matches to an existing Organization by ASN
 *   7. Finds or creates a PortalUser, issues a JWT
 *
 * PeeringDB OAuth2 docs: https://docs.peeringdb.com/howto/oauth/
 *
 * Config stored in Settings singleton under peeringDb:
 *   - OAuth client ID = peeringDb.username (reused field)
 *   - OAuth client secret = peeringDb.password (reused field)
 *   - Or dedicated fields can be added later
 *
 * For now, env vars are used:
 *   PEERINGDB_OAUTH_CLIENT_ID
 *   PEERINGDB_OAUTH_CLIENT_SECRET
 *   PEERINGDB_OAUTH_REDIRECT_URI (default: <FRONTEND_URL>/portal?peeringdb_callback=1)
 */

const PEERINGDB_AUTHORIZE_URL = 'https://auth.peeringdb.com/oauth2/authorize/';
const PEERINGDB_TOKEN_URL = 'https://auth.peeringdb.com/oauth2/token/';
const PEERINGDB_USERINFO_URL = 'https://auth.peeringdb.com/oauth2/userinfo/';
const PEERINGDB_PROFILE_URL = 'https://www.peeringdb.com/api/user';

const getOAuthConfig = () => ({
  clientId: process.env.PEERINGDB_OAUTH_CLIENT_ID || '',
  clientSecret: process.env.PEERINGDB_OAUTH_CLIENT_SECRET || '',
  redirectUri: process.env.PEERINGDB_OAUTH_REDIRECT_URI || `${config.frontendUrl}/portal?peeringdb_callback=1`,
});

/**
 * Step 1: Return the PeeringDB OAuth authorize URL for the frontend to redirect to.
 */
export const getAuthUrl = async (_req: Request, res: Response): Promise<void> => {
  try {
    const oauth = getOAuthConfig();
    if (!oauth.clientId || !oauth.clientSecret) {
      res.json({ success: false, error: 'PeeringDB OAuth is not configured. Set PEERINGDB_OAUTH_CLIENT_ID and PEERINGDB_OAUTH_CLIENT_SECRET.' });
      return;
    }

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: oauth.clientId,
      redirect_uri: oauth.redirectUri,
      scope: 'email profile networks',
      state: Buffer.from(JSON.stringify({ ts: Date.now() })).toString('base64url'),
    });

    res.json({
      success: true,
      data: {
        url: `${PEERINGDB_AUTHORIZE_URL}?${params.toString()}`,
        configured: true,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: 'Failed to generate OAuth URL.' });
  }
};

/**
 * Step 2: Exchange the authorization code for a token, fetch profile, login.
 */
export const callback = async (req: Request, res: Response): Promise<void> => {
  try {
    const code = req.body?.code || req.query?.code;
    if (!code) {
      res.status(400).json({ success: false, error: 'Authorization code is required.' });
      return;
    }

    const oauth = getOAuthConfig();
    if (!oauth.clientId || !oauth.clientSecret) {
      res.status(500).json({ success: false, error: 'PeeringDB OAuth is not configured.' });
      return;
    }

    // Exchange code for access token
    const tokenResponse = await fetch(PEERINGDB_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: String(code),
        redirect_uri: oauth.redirectUri,
        client_id: oauth.clientId,
        client_secret: oauth.clientSecret,
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errText = await tokenResponse.text();
      res.status(401).json({ success: false, error: `PeeringDB rejected the authorization code. ${errText.slice(0, 200)}` });
      return;
    }

    const tokenData = await tokenResponse.json();
    const accessToken = tokenData.access_token;
    if (!accessToken) {
      res.status(401).json({ success: false, error: 'No access token received from PeeringDB.' });
      return;
    }

    // Fetch user profile to get their email and affiliated networks
    const profileResponse = await fetch(PEERINGDB_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    let email = '';
    let name = '';
    let networks: Array<{ asn: number; name: string }> = [];

    if (profileResponse.ok) {
      const profile = await profileResponse.json();
      email = profile.email || '';
      name = profile.name || profile.given_name || '';

      // Try to get affiliated networks
      if (profile.networks && Array.isArray(profile.networks)) {
        networks = profile.networks.map((n: any) => ({ asn: n.asn, name: n.name }));
      }
    }

    // If userinfo didn't give us networks, try the API directly
    if (!networks.length) {
      try {
        const netResp = await fetch(`https://www.peeringdb.com/api/user`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (netResp.ok) {
          const netData = await netResp.json();
          if (netData.data?.[0]?.networks) {
            networks = netData.data[0].networks.map((n: any) => ({ asn: n.asn, name: n.name }));
          }
        }
      } catch { /* ignore */ }
    }

    if (!email) {
      res.status(400).json({ success: false, error: 'Could not retrieve your email from PeeringDB. Ensure the "email" scope is granted.' });
      return;
    }

    // Find the organization by ASN from the user's PeeringDB affiliated networks
    let org: any = null;
    for (const net of networks) {
      org = await Organization.findOne({
        $or: [{ asn: net.asn }, { additionalAsns: net.asn }],
        status: { $ne: 'suspended' },
      });
      if (org) break;
    }

    if (!org) {
      // Try matching by email domain as a fallback
      const domain = email.split('@')[1];
      if (domain) {
        org = await Organization.findOne({
          nocEmail: { $regex: new RegExp(`@${domain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
          status: { $ne: 'suspended' },
        });
      }
    }

    if (!org) {
      res.status(403).json({
        success: false,
        error: `No member organization found for your PeeringDB networks (${networks.map((n) => `AS${n.asn}`).join(', ') || 'none'}). Contact the IX to get your account linked.`,
      });
      return;
    }

    // Find or create a PortalUser for this email
    let portalUser = await PortalUser.findOne({ email: email.toLowerCase(), organization: org._id });

    if (!portalUser) {
      // Auto-create a portal user for PeeringDB-authenticated members
      portalUser = await PortalUser.create({
        organization: org._id,
        email: email.toLowerCase(),
        name: name || email.split('@')[0],
        password: `peeringdb_oauth_${Date.now()}_${Math.random()}`, // Random — they'll always use OAuth
        role: 'viewer',
        isActive: true,
      });
    }

    if (!portalUser.isActive) {
      res.status(403).json({ success: false, error: 'Your portal account is disabled. Contact the IX.' });
      return;
    }

    // Issue JWT
    const token = jwt.sign(
      {
        userId: portalUser._id,
        email: portalUser.email,
        organizationId: org._id,
        role: portalUser.role,
        kind: 'portal',
      },
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn as any }
    );

    // Update last login
    portalUser.lastLogin = new Date();
    await portalUser.save();

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: portalUser._id,
          email: portalUser.email,
          name: portalUser.name,
          role: portalUser.role,
        },
        organization: {
          id: org._id,
          name: org.name,
          asn: org.asn,
        },
      },
    });
  } catch (err: any) {
    console.error('[PeeringDB OAuth] Callback error:', err);
    res.status(500).json({ success: false, error: 'OAuth login failed.' });
  }
};

export default { getAuthUrl, callback };
