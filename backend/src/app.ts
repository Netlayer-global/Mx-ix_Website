import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import config from './config/environment';
import corsOptions from './config/cors';
import { connectDatabase } from './config/database';
import routes from './routes';
import { errorMiddleware, notFoundMiddleware } from './middleware';
import { seedDatabase } from './services/seed.service';
import { evaluateAllAlerts } from './services/alert.service';
import { sendWeeklyDigests } from './services/digest.service';

const app = express();

// Security middleware
app.use(helmet());

// CORS
app.use(cors(corsOptions));

// Request logging
if (config.isDevelopment) {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// API routes
app.use('/api', routes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'MX-IX Admin Panel API',
    version: '1.0.0',
    description: 'Backend API for MX-IX content management',
    documentation: '/api/health',
  });
});

// Error handling
app.use(notFoundMiddleware);
app.use(errorMiddleware);

// Start server
const startServer = async () => {
  try {
    // Connect to database
    await connectDatabase();

    // Seed database with default data
    await seedDatabase();

    // Background jobs: threshold-alert sweep (every 5 min) + weekly digest (every 7 days).
    setInterval(() => {
      evaluateAllAlerts().catch((e) => console.error('[Alerts] interval error', e));
    }, 5 * 60 * 1000);
    setInterval(() => {
      sendWeeklyDigests().catch((e) => console.error('[Digest] interval error', e));
    }, 7 * 24 * 60 * 60 * 1000);

    // IRRDB as-set expansion refresh (every 24h, only stale entries).
    // Keeps the prefix filters fresh so route servers don't reject member routes
    // because their as-set expansion expired.
    setInterval(async () => {
      try {
        const irrdb = (await import('./services/irrdb.service')).default;
        const result = await irrdb.refreshAll({ onlyStale: true });
        if (result.attempted > 0) {
          console.log(`[IRRDB] Scheduled refresh: ${result.succeeded}/${result.attempted} ASNs refreshed, ${result.failed} failed, ${result.skipped} already fresh.`);
        }
      } catch (e) {
        console.error('[IRRDB] Scheduled refresh error:', e);
      }
    }, 24 * 60 * 60 * 1000);

    // PeeringDB re-sync (every 24h) — updates max-prefix limits, as-sets,
    // peering policy and contact data for all active members.
    setInterval(async () => {
      try {
        const { getEffectivePeeringDb } = await import('./models/settings.model');
        const cfg = await getEffectivePeeringDb();
        if (!cfg.enabled) return;

        const peeringdb = (await import('./services/peeringdb.service')).default;
        const { Organization } = await import('./models');
        const orgs = await Organization.find({ asn: { $ne: null }, status: { $ne: 'suspended' } }).select('name asn').lean();

        let synced = 0;
        let failed = 0;
        for (const org of orgs as any[]) {
          try {
            const net = await peeringdb.getNetByAsn(org.asn);
            if (!net.ok || !net.data) { failed++; continue; }
            // Rate limit hit — stop immediately rather than hammering through
            if (net.status === 429) { console.warn('[PeeringDB] Rate limited during scheduled sync, stopping.'); break; }

            const patch = peeringdb.mapNetToOrganization(net.data, {
              syncMaxPrefixes: cfg.syncMaxPrefixes,
              syncIrrAsSet: cfg.syncIrrAsSet,
            });
            delete patch.name; // Never overwrite operator-chosen names
            await Organization.updateOne({ _id: org._id }, { $set: patch });
            synced++;
          } catch {
            failed++;
          }
        }
        if (synced > 0 || failed > 0) {
          console.log(`[PeeringDB] Scheduled sync: ${synced} synced, ${failed} failed, ${orgs.length} total members.`);
        }
      } catch (e) {
        console.error('[PeeringDB] Scheduled sync error:', e);
      }
    }, 24 * 60 * 60 * 1000);

    // Start listening
    app.listen(config.port, () => {
      console.log('');
      console.log('========================================');
      console.log('🚀 MX-IX Admin Panel API');
      console.log('========================================');
      console.log(`📍 Server running on port ${config.port}`);
      console.log(`🌍 Environment: ${config.nodeEnv}`);
      console.log(`🔗 URL: http://localhost:${config.port}`);
      console.log(`🔗 API: http://localhost:${config.port}/api`);
      console.log(`💚 Health: http://localhost:${config.port}/api/health`);
      console.log('========================================');
      console.log('');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

startServer();

export default app;
