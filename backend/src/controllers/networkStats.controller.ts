import { Request, Response } from 'express';
import { NetworkStats } from '../models';

// Get network stats
export const getNetworkStats = async (req: Request, res: Response): Promise<void> => {
  try {
    let stats = await NetworkStats.findOne();
    
    // Create default if doesn't exist
    if (!stats) {
      stats = await NetworkStats.create({
        globalLatency: { value: 0.4, unit: 'ms' },
        activeNodes: 4921,
        throughput: 124,
        locationsCount: 14,
      });
    }

    res.json({
      success: true,
      data: {
        globalLatency: stats.globalLatency,
        activeNodes: stats.activeNodes,
        throughput: stats.throughput,
        locationsCount: stats.locationsCount,
      },
    });
  } catch (error) {
    console.error('Get network stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get network stats',
    });
  }
};

// Update network stats
export const updateNetworkStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const { globalLatency, activeNodes, throughput, locationsCount } = req.body;

    let stats = await NetworkStats.findOne();

    if (!stats) {
      stats = new NetworkStats();
    }

    // Update fields if provided
    if (globalLatency !== undefined) {
      stats.globalLatency = globalLatency;
    }
    if (activeNodes !== undefined) {
      stats.activeNodes = activeNodes;
    }
    if (throughput !== undefined) {
      stats.throughput = throughput;
    }
    if (locationsCount !== undefined) {
      stats.locationsCount = locationsCount;
    }

    await stats.save();

    res.json({
      success: true,
      data: {
        globalLatency: stats.globalLatency,
        activeNodes: stats.activeNodes,
        throughput: stats.throughput,
        locationsCount: stats.locationsCount,
      },
      message: 'Network stats updated successfully',
    });
  } catch (error) {
    console.error('Update network stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update network stats',
    });
  }
};

export default { getNetworkStats, updateNetworkStats };
