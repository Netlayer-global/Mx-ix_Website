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
