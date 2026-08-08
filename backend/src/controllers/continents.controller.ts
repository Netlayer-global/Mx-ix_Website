import { Request, Response } from 'express';
import { Continent } from '../models/continent.model';

// Get all continents
export const getAllContinents = async (req: Request, res: Response): Promise<void> => {
  try {
    const { isActive } = req.query;
    
    const filter: any = {};
    if (isActive !== undefined) filter.isActive = isActive === 'true';

    const continents = await Continent.find(filter).sort({ order: 1, name: 1 });

    res.json({
      success: true,
      data: continents.map(c => ({
        id: c.id,
        name: c.name,
        description: c.description,
        order: c.order,
        isActive: c.isActive,
      })),
    });
  } catch (error) {
    console.error('Get all continents error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get continents',
    });
  }
};

// Get single continent
export const getContinent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const continent = await Continent.findOne({ id });

    if (!continent) {
      res.status(404).json({
        success: false,
        error: 'Continent not found',
      });
      return;
    }

    res.json({
      success: true,
      data: {
        id: continent.id,
        name: continent.name,
        description: continent.description,
        order: continent.order,
        isActive: continent.isActive,
      },
    });
  } catch (error) {
    console.error('Get continent error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get continent',
    });
  }
};

// Create continent
export const createContinent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, name, description, order, isActive } = req.body;

    if (!id || !name) {
      res.status(400).json({
        success: false,
        error: 'id and name are required',
      });
      return;
    }

    // Check if continent with this id already exists
    const existing = await Continent.findOne({ id });
    if (existing) {
      res.status(409).json({
        success: false,
        error: 'Continent with this ID already exists',
      });
      return;
    }

    const continent = await Continent.create({
      id,
      name,
      description: description || '',
      order: order || 0,
      isActive: isActive !== false,
    });

    res.status(201).json({
      success: true,
      data: {
        id: continent.id,
        name: continent.name,
        description: continent.description,
        order: continent.order,
        isActive: continent.isActive,
      },
      message: 'Continent created successfully',
    });
  } catch (error) {
    console.error('Create continent error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create continent',
    });
  }
};

// Update continent
export const updateContinent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const continent = await Continent.findOne({ id });

    if (!continent) {
      res.status(404).json({
        success: false,
        error: 'Continent not found',
      });
      return;
    }

    // Update allowed fields
    const allowedUpdates = ['name', 'description', 'order', 'isActive'];
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        (continent as any)[field] = updates[field];
      }
    });

    await continent.save();

    res.json({
      success: true,
      data: {
        id: continent.id,
        name: continent.name,
        description: continent.description,
        order: continent.order,
        isActive: continent.isActive,
      },
      message: 'Continent updated successfully',
    });
  } catch (error) {
    console.error('Update continent error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update continent',
    });
  }
};

// Delete continent
export const deleteContinent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const continent = await Continent.findOneAndDelete({ id });

    if (!continent) {
      res.status(404).json({
        success: false,
        error: 'Continent not found',
      });
      return;
    }

    res.json({
      success: true,
      message: 'Continent deleted successfully',
    });
  } catch (error) {
    console.error('Delete continent error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete continent',
    });
  }
};

export default {
  getAllContinents,
  getContinent,
  createContinent,
  updateContinent,
  deleteContinent,
};
