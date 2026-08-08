import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware';
import { evaluateAllAlerts } from '../services/alert.service';
import { sendWeeklyDigests } from '../services/digest.service';

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

export default router;
