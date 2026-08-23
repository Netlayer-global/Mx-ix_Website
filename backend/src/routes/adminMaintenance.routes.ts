import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware';
import { evaluateAllAlerts } from '../services/alert.service';
import { sendWeeklyDigests } from '../services/digest.service';
import mw from '../controllers/adminMaintenanceWindows.controller';

const router = Router();

router.use(authMiddleware);

// Manually run the alert sweep
router.post('/alerts/run', async (_req: Request, res: Response) => {
  await evaluateAllAlerts();
  res.json({ success: true, message: 'Alert sweep executed.' });
});

// Manually send the weekly digest
router.post('/digest/run', async (_req: Request, res: Response) => {
  const count = await sendWeeklyDigests();
  res.json({ success: true, message: `Digest sent to ${count} organization(s).` });
});

// Maintenance windows CRUD
router.get('/windows', mw.listWindows);
router.get('/windows/upcoming', mw.upcomingWindows);
router.post('/windows', mw.createWindow);
router.put('/windows/:id', mw.updateWindow);
router.delete('/windows/:id', mw.deleteWindow);

export default router;
