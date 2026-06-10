import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config/environment';
import { PortalUser, Organization } from '../models';
import { IPortalUser } from '../models/portalUser.model';
import { IOrganization } from '../models/organization.model';

export interface IPortalAuthPayload {
  userId: string;
  organizationId: string;
  email: string;
  role: 'admin' | 'viewer' | 'billing';
  kind: 'portal';
}

declare global {
  namespace Express {
    interface Request {
      portalUser?: IPortalUser;
      organization?: IOrganization;
      portalAuth?: IPortalAuthPayload;
    }
  }
}

/**
 * Verifies a customer (portal) JWT, loads the PortalUser + Organization, and
 * blocks suspended / pending accounts. Distinct from the admin authMiddleware.
 */
export const portalAuthMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, error: 'Access denied. No token provided.' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwtSecret) as IPortalAuthPayload;

    if (decoded.kind !== 'portal') {
      res.status(401).json({ success: false, error: 'Invalid portal token.' });
      return;
    }

    const user = await PortalUser.findById(decoded.userId);
    if (!user || !user.isActive) {
      res.status(401).json({ success: false, error: 'Account no longer exists or is inactive.' });
      return;
    }

    const org = await Organization.findById(user.organization);
    if (!org) {
      res.status(401).json({ success: false, error: 'Organization not found.' });
      return;
    }
    if (org.status === 'suspended') {
      res.status(403).json({ success: false, error: 'Account suspended. Contact MX-IX support.' });
      return;
    }
    if (org.status === 'pending') {
      res.status(403).json({ success: false, error: 'Account pending approval.' });
      return;
    }

    req.portalUser = user;
    req.organization = org;
    req.portalAuth = decoded;
    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ success: false, error: 'Session expired. Please login again.' });
      return;
    }
    res.status(401).json({ success: false, error: 'Invalid token.' });
  }
};

/** Restrict a portal route to certain roles (e.g. billing-only or admin-only). */
export const portalRoleMiddleware =
  (...roles: Array<'admin' | 'viewer' | 'billing'>) =>
  (req: Request, res: Response, next: NextFunction): void => {
    if (!req.portalAuth || !roles.includes(req.portalAuth.role)) {
      res.status(403).json({ success: false, error: 'Insufficient permissions.' });
      return;
    }
    next();
  };

export default portalAuthMiddleware;
