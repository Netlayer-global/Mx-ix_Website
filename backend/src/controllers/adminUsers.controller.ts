import { Request, Response } from 'express';
import { User } from '../models';
import { AdminRole } from '../models/user.model';
import { logAudit } from '../services/audit.service';

const ROLES: AdminRole[] = ['super-admin', 'admin', 'noc', 'billing', 'support', 'editor'];

const publicUser = (u: any) => ({
  id: u._id,
  email: u.email,
  name: u.name,
  role: u.role,
  isActive: u.isActive,
  createdAt: u.createdAt,
});

export const listUsers = async (_req: Request, res: Response): Promise<void> => {
  try {
    const users = await User.find().sort({ createdAt: 1 });
    res.json({ success: true, data: users.map(publicUser) });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to load admins.' });
  }
};

export const createUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, name, role } = req.body;
    if (!email || !password || !name) {
      res.status(400).json({ success: false, error: 'Name, email and password are required.' });
      return;
    }
    if (String(password).length < 6) {
      res.status(400).json({ success: false, error: 'Password must be at least 6 characters.' });
      return;
    }
    const existing = await User.findOne({ email: String(email).toLowerCase().trim() });
    if (existing) {
      res.status(409).json({ success: false, error: 'An admin with this email already exists.' });
      return;
    }
    const user = await User.create({
      email: String(email).toLowerCase().trim(),
      password: String(password),
      name: String(name).trim(),
      role: ROLES.includes(role) ? role : 'support',
    });
    await logAudit({ actor: req.user?.email, action: 'admin.create', resource: 'User', resourceId: String(user._id), after: { email: user.email, role: user.role } });
    res.status(201).json({ success: true, data: publicUser(user) });
  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({ success: false, error: 'Failed to create admin.' });
  }
};

export const updateUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { role, isActive, password } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) {
      res.status(404).json({ success: false, error: 'Admin not found.' });
      return;
    }
    // Prevent self-lockout
    if (String(user._id) === req.user?.userId && (isActive === false || (role && role !== user.role && !['admin', 'super-admin'].includes(role)))) {
      res.status(400).json({ success: false, error: 'You cannot demote or deactivate your own account.' });
      return;
    }
    const before = { role: user.role, isActive: user.isActive };
    if (role && ROLES.includes(role)) user.role = role;
    if (isActive !== undefined) user.isActive = !!isActive;
    if (password) user.password = String(password);
    await user.save();
    await logAudit({ actor: req.user?.email, action: 'admin.update', resource: 'User', resourceId: String(user._id), before, after: { role: user.role, isActive: user.isActive } });
    res.json({ success: true, data: publicUser(user) });
  } catch (error) {
    console.error('Update admin error:', error);
    res.status(500).json({ success: false, error: 'Failed to update admin.' });
  }
};

export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    if (req.params.id === req.user?.userId) {
      res.status(400).json({ success: false, error: 'You cannot delete your own account.' });
      return;
    }
    const user = await User.findByIdAndDelete(req.params.id);
    if (user) await logAudit({ actor: req.user?.email, action: 'admin.delete', resource: 'User', resourceId: String(user._id), before: { email: user.email, role: user.role } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete admin.' });
  }
};

export default { listUsers, createUser, updateUser, deleteUser };
