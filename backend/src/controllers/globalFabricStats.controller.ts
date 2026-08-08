import { Request, Response } from 'express';
import { GlobalFabricStats } from '../models';

// Get global fabric stats
export const getGlobalFabricStats = async (req: Request, res: Response): Promise<void> => {
  try {
    let stats = await GlobalFabricStats.findOne();
    
    // Create default if doesn't exist
    if (!stats) {
      stats = await GlobalFabricStats.create({
        totalCapacity: '5.2 Tbps',
        activeRoutes: '10,000+',
        avgLatency: '<5ms',
        globalCoverage: '100%',
      });
    }

    res.json({
      success: true,
      data: {
        totalCapacity: stats.totalCapacity,
        activeRoutes: stats.activeRoutes,
        avgLatency: stats.avgLatency,
        globalCoverage: stats.globalCoverage,
      },
    });
  } catch (error) {
    console.error('Get global fabric stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get global fabric stats',
    });
  }
};

// Update global fabric stats
export const updateGlobalFabricStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const { totalCapacity, activeRoutes, avgLatency, globalCoverage } = req.body;

    let stats = await GlobalFabricStats.findOne();

    if (!stats) {
      stats = new GlobalFabricStats();
    }

    // Update fields if provided
    if (totalCapacity !== undefined) stats.totalCapacity = totalCapacity;
    if (activeRoutes !== undefined) stats.activeRoutes = activeRoutes;
    if (avgLatency !== undefined) stats.avgLatency = avgLatency;
    if (globalCoverage !== undefined) stats.globalCoverage = globalCoverage;

    await stats.save();

    res.json({
      success: true,
      data: {
        totalCapacity: stats.totalCapacity,
        activeRoutes: stats.activeRoutes,
        avgLatency: stats.avgLatency,
        globalCoverage: stats.globalCoverage,
      },
      message: 'Global fabric stats updated successfully',
    });
  } catch (error) {
    console.error('Update global fabric stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update global fabric stats',
    });
  }
};

export default { getGlobalFabricStats, updateGlobalFabricStats };
