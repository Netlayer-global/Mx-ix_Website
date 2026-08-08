import { Request, Response } from 'express';
import { AlertRule, Port } from '../models';
import { evaluateRule } from '../services/alert.service';

const sanitizeChannels = (c: any) => ({
  email: Array.isArray(c?.email) ? c.email.map((e: string) => String(e).trim()).filter(Boolean) : [],
  slackWebhook: c?.slackWebhook ? String(c.slackWebhook).trim() : '',
  webhook: c?.webhook ? String(c.webhook).trim() : '',
});

export const listAlerts = async (req: Request, res: Response): Promise<void> => {
  try {
    const rules = await AlertRule.find({ organization: req.organization!._id }).sort({ createdAt: -1 }).lean();
    res.json({ success: true, data: rules });
  } catch (error) {
    console.error('List alerts error:', error);
    res.status(500).json({ success: false, error: 'Failed to load alerts.' });
  }
};

export const createAlert = async (req: Request, res: Response): Promise<void> => {
  try {
    const b = req.body;
    if (!b.name) {
      res.status(400).json({ success: false, error: 'Name is required.' });
      return;
    }
    if (b.scope === 'port' && b.portId) {
      const port = await Port.findOne({ _id: b.portId, organization: req.organization!._id });
      if (!port) {
        res.status(400).json({ success: false, error: 'Port not found.' });
        return;
      }
    }
    const rule = await AlertRule.create({
      organization: req.organization!._id,
      name: String(b.name).trim(),
      scope: b.scope === 'port' ? 'port' : 'aggregate',
      portId: b.scope === 'port' ? b.portId || null : null,
      metric: ['traffic_in', 'traffic_out', 'utilization'].includes(b.metric) ? b.metric : 'traffic_in',
      thresholdMbps: Number(b.thresholdMbps) || 0,
      thresholdPercent: Number(b.thresholdPercent) || 0,
      channels: sanitizeChannels(b.channels),
      enabled: b.enabled !== false,
      cooldownMinutes: Number(b.cooldownMinutes) || 60,
    });
    res.status(201).json({ success: true, data: rule });
  } catch (error) {
    console.error('Create alert error:', error);
    res.status(500).json({ success: false, error: 'Failed to create alert.' });
  }
};

export const updateAlert = async (req: Request, res: Response): Promise<void> => {
  try {
    const b = req.body;
    const update: any = {};
    ['name', 'scope', 'metric', 'enabled', 'cooldownMinutes', 'thresholdMbps', 'thresholdPercent', 'portId'].forEach(
      (k) => {
        if (b[k] !== undefined) update[k] = b[k];
      }
    );
    if (b.channels !== undefined) update.channels = sanitizeChannels(b.channels);
    const rule = await AlertRule.findOneAndUpdate(
      { _id: req.params.id, organization: req.organization!._id },
      update,
      { new: true }
    );
    if (!rule) {
      res.status(404).json({ success: false, error: 'Alert not found.' });
      return;
    }
    res.json({ success: true, data: rule });
  } catch (error) {
    console.error('Update alert error:', error);
    res.status(500).json({ success: false, error: 'Failed to update alert.' });
  }
};

export const deleteAlert = async (req: Request, res: Response): Promise<void> => {
  try {
    await AlertRule.findOneAndDelete({ _id: req.params.id, organization: req.organization!._id });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete alert.' });
  }
};

/**
 * POST /api/portal/alerts/:id/test — force-trigger to verify channels.
 */
export const testAlert = async (req: Request, res: Response): Promise<void> => {
  try {
    const rule = await AlertRule.findOne({ _id: req.params.id, organization: req.organization!._id });
    if (!rule) {
      res.status(404).json({ success: false, error: 'Alert not found.' });
      return;
    }
    const message = await evaluateRule(rule, true);
    res.json({ success: true, data: { triggered: !!message, message } });
  } catch (error) {
    console.error('Test alert error:', error);
    res.status(500).json({ success: false, error: 'Failed to test alert.' });
  }
};

export default { listAlerts, createAlert, updateAlert, deleteAlert, testAlert };
