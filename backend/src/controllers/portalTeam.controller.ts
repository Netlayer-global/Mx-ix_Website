import { Request, Response } from 'express';
import { PortalUser } from '../models';
import { PortalRole } from '../models/portalUser.model';

const ROLES: PortalRole[] = ['admin', 'viewer', 'billing'];

const publicUser = (u: any) => ({
  id: u._id,
  name: u.name,
  email: u.email,
  role: u.role,
  isActive: u.isActive,
  lastLogin: u.lastLogin,
  createdAt: u.createdAt,
});

/**
 * GET /api/portal/team
 * All logins belonging to the authenticated user's organization.
 */
export const listTeam = async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await PortalUser.find({ organization: req.organization!._id }).sort({ createdAt: 1 });
    res.json({ success: true, data: users.map(publicUser) });
  } catch (error) {
    console.error('List team error:', error);
    res.status(500).json({ success: false, error: 'Failed to load team.' });
  }
};

/**
 * POST /api/portal/team   { name, email, password, role }
 * Admin-only (enforced by route middleware).
 */
export const addMember = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      res.status(400).json({ success: false, error: 'Name, email and password are required.' });
      return;
    }
    if (String(password).length < 8) {
      res.status(400).json({ success: false, error: 'Password must be at least 8 characters.' });
      return;
    }
    const existing = await PortalUser.findOne({ email: String(email).toLowerCase().trim() });
    if (existing) {
      res.status(409).json({ success: false, error: 'A user with this email already exists.' });
      return;
    }
    const user = await PortalUser.create({
      organization: req.organization!._id,
      name: String(name).trim(),
      email: String(email).toLowerCase().trim(),
      password: String(password),
      role: ROLES.includes(role) ? role : 'viewer',
    });
    res.status(201).json({ success: true, data: publicUser(user) });
  } catch (error) {
    console.error('Add team member error:', error);
    res.status(500).json({ success: false, error: 'Failed to add team member.' });
  }
};

/**
 * PUT /api/portal/team/:userId   { role?, isActive? }
 */
export const updateMember = async (req: Request, res: Response): Promise<void> => {
  try {
    const { role, isActive } = req.body;
    // Prevent admins from locking themselves out
    if (req.params.userId === req.portalAuth!.userId && (role && role !== 'admin')) {
      res.status(400).json({ success: false, error: 'You cannot change your own admin role.' });
      return;
    }
    const update: any = {};
    if (role !== undefined) {
      if (!ROLES.includes(role)) {
        res.status(400).json({ success: false, error: 'Invalid role.' });
        return;
      }
      update.role = role;
    }
    if (isActive !== undefined) update.isActive = !!isActive;

    const user = await PortalUser.findOneAndUpdate(
      { _id: req.params.userId, organization: req.organization!._id },
      update,
      { new: true }
    );
    if (!user) {
      res.status(404).json({ success: false, error: 'Team member not found.' });
      return;
    }
    res.json({ success: true, data: publicUser(user) });
  } catch (error) {
    console.error('Update team member error:', error);
    res.status(500).json({ success: false, error: 'Failed to update team member.' });
  }
};

/**
 * DELETE /api/portal/team/:userId
 */
export const removeMember = async (req: Request, res: Response): Promise<void> => {
  try {
    if (req.params.userId === req.portalAuth!.userId) {
      res.status(400).json({ success: false, error: 'You cannot remove your own account.' });
      return;
    }
    const user = await PortalUser.findOneAndDelete({
      _id: req.params.userId,
      organization: req.organization!._id,
    });
    if (!user) {
      res.status(404).json({ success: false, error: 'Team member not found.' });
      return;
    }
    res.json({ success: true });
  } catch (error) {
    console.error('Remove team member error:', error);
    res.status(500).json({ success: false, error: 'Failed to remove team member.' });
  }
};

export default { listTeam, addMember, updateMember, removeMember };
