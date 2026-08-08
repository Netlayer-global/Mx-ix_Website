import { Request, Response } from 'express';
import { Member } from '../models/member.model';

// GET /api/members (public) — active members
export const getMembers = async (_req: Request, res: Response): Promise<void> => {
  try {
    const members = await Member.find({ isActive: true }).sort({ order: 1, name: 1 });
    res.json({ success: true, data: members });
  } catch (error) {
    console.error('Get members error:', error);
    res.status(500).json({ success: false, error: 'Failed to get members' });
  }
};

// GET /api/members/all (admin) — including inactive
export const getAllMembers = async (_req: Request, res: Response): Promise<void> => {
  try {
    const members = await Member.find().sort({ order: 1, name: 1 });
    res.json({ success: true, data: members });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to get members' });
  }
};

export const createMember = async (req: Request, res: Response): Promise<void> => {
  try {
    const m = await Member.create(req.body);
    res.json({ success: true, data: m });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create member' });
  }
};

export const updateMember = async (req: Request, res: Response): Promise<void> => {
  try {
    const m = await Member.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!m) { res.status(404).json({ success: false, error: 'Member not found' }); return; }
    res.json({ success: true, data: m });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update member' });
  }
};

export const deleteMember = async (req: Request, res: Response): Promise<void> => {
  try {
    await Member.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete member' });
  }
};

export default { getMembers, getAllMembers, createMember, updateMember, deleteMember };
