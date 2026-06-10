import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { Organization, PortalUser, Port } from '../models';
import config from '../config/environment';
import { logAudit } from '../services/audit.service';

/**
 * GET /api/admin/customers
 * All customer organizations with user + port counts.
 */
export const listCustomers = async (_req: Request, res: Response): Promise<void> => {
  try {
    const orgs = await Organization.find().sort({ createdAt: -1 }).lean();
    const ids = orgs.map((o) => o._id);

    const [userCounts, portCounts] = await Promise.all([
      PortalUser.aggregate([
        { $match: { organization: { $in: ids } } },
        { $group: { _id: '$organization', count: { $sum: 1 } } },
      ]),
      Port.aggregate([
        { $match: { organization: { $in: ids } } },
        { $group: { _id: '$organization', count: { $sum: 1 } } },
      ]),
    ]);

    const uMap = new Map(userCounts.map((u: any) => [String(u._id), u.count]));
    const pMap = new Map(portCounts.map((p: any) => [String(p._id), p.count]));

    res.json({
      success: true,
      data: orgs.map((o) => ({
        ...o,
        userCount: uMap.get(String(o._id)) || 0,
        portCount: pMap.get(String(o._id)) || 0,
      })),
    });
  } catch (error) {
    console.error('List customers error:', error);
    res.status(500).json({ success: false, error: 'Failed to list customers.' });
  }
};

/**
 * GET /api/admin/customers/:id
 * One organization with its users and ports.
 */
export const getCustomer = async (req: Request, res: Response): Promise<void> => {
  try {
    const org = await Organization.findById(req.params.id);
    if (!org) {
      res.status(404).json({ success: false, error: 'Customer not found.' });
      return;
    }
    const [users, ports] = await Promise.all([
      PortalUser.find({ organization: org._id }).sort({ createdAt: 1 }),
      Port.find({ organization: org._id }).sort({ order: 1, name: 1 }),
    ]);
    res.json({ success: true, data: { organization: org, users, ports } });
  } catch (error) {
    console.error('Get customer error:', error);
    res.status(500).json({ success: false, error: 'Failed to load customer.' });
  }
};

/**
 * POST /api/admin/customers
 * Create an organization, optionally with a first login user.
 */
export const createCustomer = async (req: Request, res: Response): Promise<void> => {
  try {
    const { user, ...orgData } = req.body;
    if (!orgData.name) {
      res.status(400).json({ success: false, error: 'Organization name is required.' });
      return;
    }

    const org = await Organization.create({
      ...orgData,
      status: orgData.status || 'active',
      approvedAt: (orgData.status || 'active') === 'active' ? new Date() : null,
    });

    if (user?.email && user?.password) {
      const existing = await PortalUser.findOne({ email: String(user.email).toLowerCase().trim() });
      if (existing) {
        await Organization.findByIdAndDelete(org._id);
        res.status(409).json({ success: false, error: 'A user with this email already exists.' });
        return;
      }
      await PortalUser.create({
        organization: org._id,
        email: String(user.email).toLowerCase().trim(),
        password: String(user.password),
        name: user.name || org.name,
        role: user.role || 'admin',
      });
    }

    res.status(201).json({ success: true, data: org });
  } catch (error) {
    console.error('Create customer error:', error);
    res.status(500).json({ success: false, error: 'Failed to create customer.' });
  }
};

/**
 * PUT /api/admin/customers/:id
 */
export const updateCustomer = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status, ...rest } = req.body;
    const update: any = { ...rest };
    if (status) {
      update.status = status;
      if (status === 'active') {
        update.approvedAt = new Date();
        update.approvedBy = req.user?.email || 'admin';
      }
    }
    const org = await Organization.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!org) {
      res.status(404).json({ success: false, error: 'Customer not found.' });
      return;
    }
    res.json({ success: true, data: org });
  } catch (error) {
    console.error('Update customer error:', error);
    res.status(500).json({ success: false, error: 'Failed to update customer.' });
  }
};

/**
 * POST /api/admin/customers/:id/status   { status: 'active'|'suspended'|'pending' }
 * Approve (active), suspend, or revert a customer account.
 */
export const setCustomerStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { status } = req.body as { status: 'active' | 'suspended' | 'pending' };
    if (!['active', 'suspended', 'pending'].includes(status)) {
      res.status(400).json({ success: false, error: 'Invalid status.' });
      return;
    }
    const org = await Organization.findById(req.params.id);
    if (!org) {
      res.status(404).json({ success: false, error: 'Customer not found.' });
      return;
    }
    const prevStatus = org.status;
    const update: any = { status };
    if (status === 'active') {
      update.approvedAt = new Date();
      update.approvedBy = req.user?.email || 'admin';
    }
    const updated = await Organization.findByIdAndUpdate(req.params.id, update, { new: true });
    await logAudit({
      actor: req.user?.email,
      action: `customer.${status}`,
      resource: 'Organization',
      resourceId: String(org._id),
      before: { status: prevStatus },
      after: { status },
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('Set customer status error:', error);
    res.status(500).json({ success: false, error: 'Failed to update status.' });
  }
};

/**
 * DELETE /api/admin/customers/:id
 * Removes the organization and all its users + ports.
 */
export const deleteCustomer = async (req: Request, res: Response): Promise<void> => {
  try {
    const org = await Organization.findByIdAndDelete(req.params.id);
    if (!org) {
      res.status(404).json({ success: false, error: 'Customer not found.' });
      return;
    }
    await Promise.all([
      PortalUser.deleteMany({ organization: org._id }),
      Port.deleteMany({ organization: org._id }),
    ]);
    res.json({ success: true });
  } catch (error) {
    console.error('Delete customer error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete customer.' });
  }
};

// ── Ports (admin oversight) ──────────────────────────────────────────────

export const createPort = async (req: Request, res: Response): Promise<void> => {
  try {
    const port = await Port.create({ ...req.body, organization: req.params.id });
    res.status(201).json({ success: true, data: port });
  } catch (error) {
    console.error('Create port error:', error);
    res.status(500).json({ success: false, error: 'Failed to create port.' });
  }
};

export const updatePort = async (req: Request, res: Response): Promise<void> => {
  try {
    const port = await Port.findOneAndUpdate(
      { _id: req.params.portId, organization: req.params.id },
      req.body,
      { new: true }
    );
    if (!port) {
      res.status(404).json({ success: false, error: 'Port not found.' });
      return;
    }
    res.json({ success: true, data: port });
  } catch (error) {
    console.error('Update port error:', error);
    res.status(500).json({ success: false, error: 'Failed to update port.' });
  }
};

export const deletePort = async (req: Request, res: Response): Promise<void> => {
  try {
    await Port.findOneAndDelete({ _id: req.params.portId, organization: req.params.id });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete port error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete port.' });
  }
};

// ── Users (admin management of a customer's logins) ───────────────────────

export const createCustomerUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, name, role } = req.body;
    if (!email || !password || !name) {
      res.status(400).json({ success: false, error: 'Name, email and password are required.' });
      return;
    }
    const existing = await PortalUser.findOne({ email: String(email).toLowerCase().trim() });
    if (existing) {
      res.status(409).json({ success: false, error: 'A user with this email already exists.' });
      return;
    }
    const user = await PortalUser.create({
      organization: req.params.id,
      email: String(email).toLowerCase().trim(),
      password: String(password),
      name,
      role: role || 'viewer',
    });
    res.status(201).json({ success: true, data: { id: user._id, email: user.email, name: user.name, role: user.role } });
  } catch (error) {
    console.error('Create customer user error:', error);
    res.status(500).json({ success: false, error: 'Failed to create user.' });
  }
};

export const deleteCustomerUser = async (req: Request, res: Response): Promise<void> => {
  try {
    await PortalUser.findOneAndDelete({ _id: req.params.userId, organization: req.params.id });
    res.json({ success: true });
  } catch (error) {
    console.error('Delete customer user error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete user.' });
  }
};

/**
 * POST /api/admin/customers/:id/impersonate
 * Mints a portal session token so support/admin can view the portal as the
 * member (read-write within the portal). Audit-logged.
 */
export const impersonateCustomer = async (req: Request, res: Response): Promise<void> => {
  try {
    const org = await Organization.findById(req.params.id);
    if (!org) {
      res.status(404).json({ success: false, error: 'Customer not found.' });
      return;
    }
    if (org.status !== 'active') {
      res.status(400).json({ success: false, error: 'Only active customers can be impersonated.' });
      return;
    }
    // Prefer an admin login for the org; fall back to any active user.
    const user =
      (await PortalUser.findOne({ organization: org._id, role: 'admin', isActive: true })) ||
      (await PortalUser.findOne({ organization: org._id, isActive: true }));
    if (!user) {
      res.status(400).json({ success: false, error: 'This customer has no active login to impersonate.' });
      return;
    }

    const token = jwt.sign(
      {
        userId: user._id,
        organizationId: String(org._id),
        email: user.email,
        role: user.role,
        kind: 'portal',
        impersonatedBy: req.user?.email || 'admin',
      },
      config.jwtSecret,
      { expiresIn: '1h' } as jwt.SignOptions
    );

    await logAudit({
      actor: req.user?.email,
      action: 'customer.impersonate',
      resource: 'Organization',
      resourceId: String(org._id),
      after: { as: user.email },
    });

    res.json({ success: true, data: { token, as: { email: user.email, name: user.name }, organization: org.name } });
  } catch (error) {
    console.error('Impersonate error:', error);
    res.status(500).json({ success: false, error: 'Failed to impersonate.' });
  }
};

export default {
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  setCustomerStatus,
  deleteCustomer,
  createPort,
  updatePort,
  deletePort,
  createCustomerUser,
  deleteCustomerUser,
  impersonateCustomer,
};
