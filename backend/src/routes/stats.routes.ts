import express from 'express';
import GlobalStats from '../models/globalStats.model';

const router = express.Router();

// GET /api/stats - Get global statistics
router.get('/', async (req, res) => {
  try {
    // Find the latest stats (there should only be one document)
    let stats = await GlobalStats.findOne().sort({ updatedAt: -1 });

    // If no stats exist, create default stats
    if (!stats) {
      stats = await GlobalStats.create({
        totalCapacity: { value: 450, unit: 'Tbps' },
        peakTraffic: { value: 156.2, unit: 'Tbps', trend: 'up', trendValue: '+8.1%' },
        connectedNetworks: { value: 4921, unit: 'Peers', trend: 'up', trendValue: '+47' },
        ipv4Prefixes: { value: 892345, unit: 'Routes', trend: 'stable' },
      });
    }

    res.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error('Error fetching global stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch global statistics',
      error: error.message,
    });
  }
});

// PUT /api/stats - Update global statistics (admin only)
router.put('/', async (req, res) => {
  try {
    const { totalCapacity, peakTraffic, connectedNetworks, ipv4Prefixes } = req.body;

    // Validation
    if (!totalCapacity || !peakTraffic || !connectedNetworks || !ipv4Prefixes) {
      return res.status(400).json({
        success: false,
        message: 'All stat fields are required',
      });
    }

    // Find existing stats or create new
    let stats = await GlobalStats.findOne().sort({ updatedAt: -1 });

    if (stats) {
      // Update existing
      stats.totalCapacity = totalCapacity;
      stats.peakTraffic = peakTraffic;
      stats.connectedNetworks = connectedNetworks;
      stats.ipv4Prefixes = ipv4Prefixes;
      await stats.save();
    } else {
      // Create new
      stats = await GlobalStats.create({
        totalCapacity,
        peakTraffic,
        connectedNetworks,
        ipv4Prefixes,
      });
    }

    res.json({
      success: true,
      data: stats,
      message: 'Global statistics updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating global stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update global statistics',
      error: error.message,
    });
  }
});

export default router;
