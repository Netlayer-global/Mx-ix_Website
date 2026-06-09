import { Request, Response } from 'express';
import { ContactInfo } from '../models';

// Get all contacts
export const getAllContacts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { department, locationId } = req.query;
    
    const filter: any = {};
    if (department) filter.department = department;
    if (locationId) filter.locationId = locationId;

    const contacts = await ContactInfo.find(filter);

    res.json({
      success: true,
      data: contacts.map(c => ({
        department: c.department,
        locationId: c.locationId,
        phone: c.phone,
        email: c.email,
      })),
    });
  } catch (error) {
    console.error('Get all contacts error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get contacts',
    });
  }
};

// Get specific contact
export const getContact = async (req: Request, res: Response): Promise<void> => {
  try {
    const { department, locationId } = req.params;

    const contact = await ContactInfo.findOne({ department, locationId });

    if (!contact) {
      res.status(404).json({
        success: false,
        error: 'Contact not found',
      });
      return;
    }

    res.json({
      success: true,
      data: {
        department: contact.department,
        locationId: contact.locationId,
        phone: contact.phone,
        email: contact.email,
      },
    });
  } catch (error) {
    console.error('Get contact error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get contact',
    });
  }
};

// Create or update contact (upsert)
export const upsertContact = async (req: Request, res: Response): Promise<void> => {
  try {
    const { department, locationId } = req.params;
    const { phone, email } = req.body;

    if (!phone || !email) {
      res.status(400).json({
        success: false,
        error: 'phone and email are required',
      });
      return;
    }

    const contact = await ContactInfo.findOneAndUpdate(
      { department, locationId },
      { phone, email },
      { upsert: true, new: true, runValidators: true }
    );

    res.json({
      success: true,
      data: {
        department: contact.department,
        locationId: contact.locationId,
        phone: contact.phone,
        email: contact.email,
      },
      message: 'Contact updated successfully',
    });
  } catch (error) {
    console.error('Upsert contact error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update contact',
    });
  }
};

// Delete contact
export const deleteContact = async (req: Request, res: Response): Promise<void> => {
  try {
    const { department, locationId } = req.params;

    const contact = await ContactInfo.findOneAndDelete({ department, locationId });

    if (!contact) {
      res.status(404).json({
        success: false,
        error: 'Contact not found',
      });
      return;
    }

    res.json({
      success: true,
      message: 'Contact deleted successfully',
    });
  } catch (error) {
    console.error('Delete contact error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete contact',
    });
  }
};

export default {
  getAllContacts,
  getContact,
  upsertContact,
  deleteContact,
};
