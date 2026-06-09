import { Request, Response } from 'express';
import { Service } from '../models';

// Get all services
export const getAllServices = async (req: Request, res: Response): Promise<void> => {
  try {
    const { active } = req.query;
    
    const filter: any = {};
    if (active === 'true') filter.isActive = true;

    const services = await Service.find(filter).sort({ order: 1 });

    res.json({
      success: true,
      data: services.map(s => ({
        id: s.id,
        category: s.category,
        tagline: s.tagline,
        description: s.description,
        image: s.image,
        items: s.items,
        order: s.order,
        isActive: s.isActive,
      })),
    });
  } catch (error) {
    console.error('Get all services error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get services',
    });
  }
};

// Get single service
export const getService = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const service = await Service.findOne({ id });

    if (!service) {
      res.status(404).json({
        success: false,
        error: 'Service not found',
      });
      return;
    }

    res.json({
      success: true,
      data: {
        id: service.id,
        category: service.category,
        tagline: service.tagline,
        description: service.description,
        image: service.image,
        items: service.items,
        order: service.order,
        isActive: service.isActive,
      },
    });
  } catch (error) {
    console.error('Get service error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get service',
    });
  }
};

// Create service
export const createService = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, category, tagline, description, image, items, order, isActive } = req.body;

    if (!id || !category || !tagline || !description) {
      res.status(400).json({
        success: false,
        error: 'id, category, tagline, and description are required',
      });
      return;
    }

    // Check if service with this id already exists
    const existing = await Service.findOne({ id });
    if (existing) {
      res.status(409).json({
        success: false,
        error: 'Service with this ID already exists',
      });
      return;
    }

    const service = await Service.create({
      id,
      category,
      tagline,
      description,
      image: image || '',
      items: items || [],
      order: order || 0,
      isActive: isActive !== false,
    });

    res.status(201).json({
      success: true,
      data: {
        id: service.id,
        category: service.category,
        tagline: service.tagline,
        description: service.description,
        image: service.image,
        items: service.items,
        order: service.order,
        isActive: service.isActive,
      },
      message: 'Service created successfully',
    });
  } catch (error) {
    console.error('Create service error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create service',
    });
  }
};

// Update service
export const updateService = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const service = await Service.findOne({ id });

    if (!service) {
      res.status(404).json({
        success: false,
        error: 'Service not found',
      });
      return;
    }

    // Update allowed fields
    const allowedUpdates = ['category', 'tagline', 'description', 'image', 'items', 'order', 'isActive'];
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        (service as any)[field] = updates[field];
      }
    });

    await service.save();

    res.json({
      success: true,
      data: {
        id: service.id,
        category: service.category,
        tagline: service.tagline,
        description: service.description,
        image: service.image,
        items: service.items,
        order: service.order,
        isActive: service.isActive,
      },
      message: 'Service updated successfully',
    });
  } catch (error) {
    console.error('Update service error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update service',
    });
  }
};

// Delete service
export const deleteService = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const service = await Service.findOneAndDelete({ id });

    if (!service) {
      res.status(404).json({
        success: false,
        error: 'Service not found',
      });
      return;
    }

    res.json({
      success: true,
      message: 'Service deleted successfully',
    });
  } catch (error) {
    console.error('Delete service error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete service',
    });
  }
};

// Add service item
export const addServiceItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const itemData = req.body;

    const service = await Service.findOne({ id });

    if (!service) {
      res.status(404).json({
        success: false,
        error: 'Service not found',
      });
      return;
    }

    if (!itemData.name || !itemData.description) {
      res.status(400).json({
        success: false,
        error: 'Item name and description are required',
      });
      return;
    }

    service.items.push({
      name: itemData.name,
      icon: itemData.icon || '',
      description: itemData.description,
      benefits: itemData.benefits || [],
      features: itemData.features || [],
      stats: itemData.stats || [],
      order: itemData.order || service.items.length,
    });

    await service.save();

    res.status(201).json({
      success: true,
      data: service.items,
      message: 'Service item added successfully',
    });
  } catch (error) {
    console.error('Add service item error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add service item',
    });
  }
};

// Update service item
export const updateServiceItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, itemIndex } = req.params;
    const updates = req.body;

    const service = await Service.findOne({ id });

    if (!service) {
      res.status(404).json({
        success: false,
        error: 'Service not found',
      });
      return;
    }

    const index = parseInt(itemIndex as string, 10);
    if (isNaN(index) || index < 0 || index >= service.items.length) {
      res.status(404).json({
        success: false,
        error: 'Service item not found',
      });
      return;
    }

    // Update item fields
    const item = service.items[index];
    if (updates.name !== undefined) item.name = updates.name;
    if (updates.icon !== undefined) item.icon = updates.icon;
    if (updates.description !== undefined) item.description = updates.description;
    if (updates.benefits !== undefined) item.benefits = updates.benefits;
    if (updates.features !== undefined) item.features = updates.features;
    if (updates.stats !== undefined) item.stats = updates.stats;
    if (updates.order !== undefined) item.order = updates.order;

    await service.save();

    res.json({
      success: true,
      data: service.items,
      message: 'Service item updated successfully',
    });
  } catch (error) {
    console.error('Update service item error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update service item',
    });
  }
};

// Delete service item
export const deleteServiceItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id, itemIndex } = req.params;

    const service = await Service.findOne({ id });

    if (!service) {
      res.status(404).json({
        success: false,
        error: 'Service not found',
      });
      return;
    }

    const index = parseInt(itemIndex as string, 10);
    if (isNaN(index) || index < 0 || index >= service.items.length) {
      res.status(404).json({
        success: false,
        error: 'Service item not found',
      });
      return;
    }

    service.items.splice(index, 1);
    await service.save();

    res.json({
      success: true,
      data: service.items,
      message: 'Service item deleted successfully',
    });
  } catch (error) {
    console.error('Delete service item error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete service item',
    });
  }
};

export default {
  getAllServices,
  getService,
  createService,
  updateService,
  deleteService,
  addServiceItem,
  updateServiceItem,
  deleteServiceItem,
};
