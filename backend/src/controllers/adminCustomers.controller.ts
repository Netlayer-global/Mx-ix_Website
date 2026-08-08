import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { Organization, PortalUser, Port, MemberContact, CustomerNote, CustomerTag, CustomerDocument } from '../models';
import config from '../config/environment';
import { logAudit } from '../services/audit.service';
import zohoBooks from '../services/zohoBooks.service';

/**
 * GET /api/admin/customers/zoho/contacts?q=...
 * Search Zoho Books contacts so an admin can link a customer to its Zoho
 * contact by name instead of pasting a raw contact ID.
 */
export const searchZohoContacts = async (req: Request, res: Response): Promise<void> => {
  try {
    const q = String(req.query.q || '').trim();
    const profileKey = req.query.profile ? String(req.query.profile) : undefined;
    const result = await zohoBooks.searchContacts(q, profileKey);
    if (!result.ok) {
      res.json({ success: false, error: result.error });
      return;
    }
    res.json({ success: true, data: result.contacts || [] });
  } catch (error) {
    console.error('Zoho contacts search error:', error);
    res.status(500).json({ success: false, error: 'Failed to search Zoho contacts.' });
  }
};

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

// ══════════════════════════════════════════════════════════════════════════════
// Member contacts
// ══════════════════════════════════════════════════════════════════════════════

export const listContacts = async (req: Request, res: Response): Promise<void> => {
  try {
    const filter: any = { organization: req.params.id };
    if (req.query?.role) filter.role = req.query.role;
    const contacts = await MemberContact.find(filter).sort({ isPrimary: -1, role: 1, name: 1 }).lean();
    res.json({ success: true, data: contacts });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to load contacts.' });
  }
};

export const createContact = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.body?.name || !req.body?.email) {
      res.status(400).json({ success: false, error: 'Name and email are required.' });
      return;
    }
    if (!(await Organization.exists({ _id: req.params.id }))) {
      res.status(404).json({ success: false, error: 'Customer not found.' });
      return;
    }
    const contact = await MemberContact.create({
      organization: req.params.id,
      name: String(req.body.name).trim(),
      email: String(req.body.email).trim().toLowerCase(),
      phone: req.body.phone || '',
      role: req.body.role || 'noc',
      position: req.body.position || '',
      source: 'manual',
      receiveNotifications: req.body.receiveNotifications !== false,
      receiveBilling: req.body.receiveBilling === true,
      isPrimary: req.body.isPrimary === true,
      notes: req.body.notes || '',
    });
    await logAudit({
      actor: req.user?.email,
      action: 'customer.contact.create',
      resource: 'Organization',
      resourceId: String(req.params.id),
      after: { name: contact.name, email: contact.email, role: contact.role },
    });
    res.status(201).json({ success: true, data: contact });
  } catch (err: any) {
    if (err?.code === 11000) {
      res.status(409).json({ success: false, error: 'A contact with that email and role already exists for this member.' });
      return;
    }
    res.status(500).json({ success: false, error: 'Failed to create contact.' });
  }
};

export const updateContact = async (req: Request, res: Response): Promise<void> => {
  try {
    const allowed = ['name', 'email', 'phone', 'role', 'position', 'receiveNotifications', 'receiveBilling', 'isPrimary', 'lastVerifiedAt', 'notes'];
    const update: any = {};
    for (const field of allowed) {
      if (req.body?.[field] !== undefined) update[field] = req.body[field];
    }
    if (update.email) update.email = String(update.email).trim().toLowerCase();

    const contact = await MemberContact.findOneAndUpdate(
      { _id: req.params.contactId, organization: req.params.id },
      { $set: update },
      { new: true }
    );
    if (!contact) {
      res.status(404).json({ success: false, error: 'Contact not found.' });
      return;
    }
    await logAudit({
      actor: req.user?.email,
      action: 'customer.contact.update',
      resource: 'MemberContact',
      resourceId: String(req.params.contactId),
      after: update,
    });
    res.json({ success: true, data: contact });
  } catch (err: any) {
    if (err?.code === 11000) {
      res.status(409).json({ success: false, error: 'A contact with that email and role already exists.' });
      return;
    }
    res.status(500).json({ success: false, error: 'Failed to update contact.' });
  }
};

export const deleteContact = async (req: Request, res: Response): Promise<void> => {
  try {
    const deleted = await MemberContact.findOneAndDelete({ _id: req.params.contactId, organization: req.params.id });
    if (!deleted) {
      res.status(404).json({ success: false, error: 'Contact not found.' });
      return;
    }
    await logAudit({
      actor: req.user?.email,
      action: 'customer.contact.delete',
      resource: 'MemberContact',
      resourceId: String(req.params.contactId),
    });
    res.json({ success: true, data: { deleted: true } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete contact.' });
  }
};

/** All contacts by role across all members — for group mailing / announcements. */
export const listContactsByRole = async (req: Request, res: Response): Promise<void> => {
  try {
    const role = req.query?.role;
    const filter: any = {};
    if (role) filter.role = role;
    if (req.query?.notifications === 'true') filter.receiveNotifications = true;
    if (req.query?.billing === 'true') filter.receiveBilling = true;

    const contacts = await MemberContact.find(filter)
      .populate('organization', 'name asn status')
      .sort({ role: 1, 'organization.name': 1 })
      .lean();
    res.json({ success: true, data: contacts });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to load contacts.' });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// Customer Notes
// ══════════════════════════════════════════════════════════════════════════════

export const listNotes = async (req: Request, res: Response): Promise<void> => {
  try {
    const notes = await CustomerNote.find({ organization: req.params.id })
      .sort({ pinned: -1, createdAt: -1 })
      .lean();
    res.json({ success: true, data: notes });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to load notes.' });
  }
};

export const createNote = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.body?.body?.trim()) {
      res.status(400).json({ success: false, error: 'Note body is required.' });
      return;
    }
    const note = await CustomerNote.create({
      organization: req.params.id,
      author: req.user?.email || 'unknown',
      body: String(req.body.body).trim(),
      visibility: req.body.visibility === 'shared' ? 'shared' : 'staff',
      pinned: req.body.pinned === true,
    });
    res.status(201).json({ success: true, data: note });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to create note.' });
  }
};

export const updateNote = async (req: Request, res: Response): Promise<void> => {
  try {
    const update: any = {};
    if (req.body?.body !== undefined) update.body = String(req.body.body).trim();
    if (req.body?.visibility !== undefined) update.visibility = req.body.visibility === 'shared' ? 'shared' : 'staff';
    if (req.body?.pinned !== undefined) update.pinned = req.body.pinned === true;

    const note = await CustomerNote.findOneAndUpdate(
      { _id: req.params.noteId, organization: req.params.id },
      { $set: update },
      { new: true }
    );
    if (!note) { res.status(404).json({ success: false, error: 'Note not found.' }); return; }
    res.json({ success: true, data: note });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update note.' });
  }
};

export const deleteNote = async (req: Request, res: Response): Promise<void> => {
  try {
    await CustomerNote.findOneAndDelete({ _id: req.params.noteId, organization: req.params.id });
    res.json({ success: true, data: { deleted: true } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete note.' });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// Customer Tags
// ══════════════════════════════════════════════════════════════════════════════

export const listTags = async (_req: Request, res: Response): Promise<void> => {
  try {
    const tags = await CustomerTag.find().sort({ name: 1 }).lean();
    res.json({ success: true, data: tags });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to load tags.' });
  }
};

export const createTag = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.body?.name?.trim()) {
      res.status(400).json({ success: false, error: 'Tag name is required.' });
      return;
    }
    const tag = await CustomerTag.create({
      name: String(req.body.name).trim(),
      colour: req.body.colour || '#6b7280',
      description: req.body.description || '',
    });
    res.status(201).json({ success: true, data: tag });
  } catch (err: any) {
    if (err?.code === 11000) { res.status(409).json({ success: false, error: 'A tag with that name already exists.' }); return; }
    res.status(500).json({ success: false, error: 'Failed to create tag.' });
  }
};

export const updateTag = async (req: Request, res: Response): Promise<void> => {
  try {
    const update: any = {};
    if (req.body?.name !== undefined) update.name = String(req.body.name).trim();
    if (req.body?.colour !== undefined) update.colour = req.body.colour;
    if (req.body?.description !== undefined) update.description = req.body.description;

    const tag = await CustomerTag.findByIdAndUpdate(req.params.tagId, { $set: update }, { new: true });
    if (!tag) { res.status(404).json({ success: false, error: 'Tag not found.' }); return; }
    res.json({ success: true, data: tag });
  } catch (err: any) {
    if (err?.code === 11000) { res.status(409).json({ success: false, error: 'A tag with that name already exists.' }); return; }
    res.status(500).json({ success: false, error: 'Failed to update tag.' });
  }
};

export const deleteTag = async (req: Request, res: Response): Promise<void> => {
  try {
    await CustomerTag.findByIdAndDelete(req.params.tagId);
    // Remove this tag from all organizations that have it
    await Organization.updateMany({ tags: req.params.tagId }, { $pull: { tags: req.params.tagId } });
    res.json({ success: true, data: { deleted: true } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete tag.' });
  }
};

/** Set a customer's tags (replace entire array). */
export const setCustomerTags = async (req: Request, res: Response): Promise<void> => {
  try {
    const tagIds = Array.isArray(req.body?.tags) ? req.body.tags : [];
    await Organization.updateOne({ _id: req.params.id }, { $set: { tags: tagIds } });
    res.json({ success: true, data: { tags: tagIds } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update tags.' });
  }
};

// ══════════════════════════════════════════════════════════════════════════════
// Customer Documents
// ══════════════════════════════════════════════════════════════════════════════

export const listDocuments = async (req: Request, res: Response): Promise<void> => {
  try {
    const filter: any = { organization: req.params.id };
    if (req.query?.category) filter.category = req.query.category;
    const docs = await CustomerDocument.find(filter).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: docs });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to load documents.' });
  }
};

export const createDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    // In a real deployment this would handle multipart/form-data file upload.
    // For now it accepts JSON with the storage path already set (the upload
    // middleware would have written the file and filled storagePath).
    if (!req.body?.filename || !req.body?.storagePath) {
      res.status(400).json({ success: false, error: 'filename and storagePath are required.' });
      return;
    }
    const doc = await CustomerDocument.create({
      organization: req.params.id,
      filename: req.body.filename,
      storagePath: req.body.storagePath,
      mimeType: req.body.mimeType || 'application/octet-stream',
      size: req.body.size || 0,
      category: req.body.category || 'other',
      description: req.body.description || '',
      visibility: req.body.visibility === 'shared' ? 'shared' : 'staff',
      uploadedBy: req.user?.email || '',
    });
    await logAudit({
      actor: req.user?.email,
      action: 'customer.document.upload',
      resource: 'Organization',
      resourceId: String(req.params.id),
      after: { filename: doc.filename, category: doc.category },
    });
    res.status(201).json({ success: true, data: doc });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to store document record.' });
  }
};

export const updateDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    const update: any = {};
    if (req.body?.description !== undefined) update.description = req.body.description;
    if (req.body?.category !== undefined) update.category = req.body.category;
    if (req.body?.visibility !== undefined) update.visibility = req.body.visibility === 'shared' ? 'shared' : 'staff';

    const doc = await CustomerDocument.findOneAndUpdate(
      { _id: req.params.docId, organization: req.params.id },
      { $set: update },
      { new: true }
    );
    if (!doc) { res.status(404).json({ success: false, error: 'Document not found.' }); return; }
    res.json({ success: true, data: doc });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update document.' });
  }
};

export const deleteDocument = async (req: Request, res: Response): Promise<void> => {
  try {
    const doc = await CustomerDocument.findOneAndDelete({ _id: req.params.docId, organization: req.params.id });
    if (!doc) { res.status(404).json({ success: false, error: 'Document not found.' }); return; }
    // NOTE: the actual file on disk/S3 should be deleted here too in production.
    await logAudit({
      actor: req.user?.email,
      action: 'customer.document.delete',
      resource: 'Organization',
      resourceId: String(req.params.id),
      after: { filename: doc.filename },
    });
    res.json({ success: true, data: { deleted: true } });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to delete document.' });
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
  listContacts,
  createContact,
  updateContact,
  deleteContact,
  listContactsByRole,
  listNotes,
  createNote,
  updateNote,
  deleteNote,
  listTags,
  createTag,
  updateTag,
  deleteTag,
  setCustomerTags,
  listDocuments,
  createDocument,
  updateDocument,
  deleteDocument,
};
