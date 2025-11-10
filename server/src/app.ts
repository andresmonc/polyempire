import express from 'express';
import cors from 'cors';
import gamesRouter from './routes/games';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

/**
 * Create and configure Express app
 */
export function createApp() {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API routes
  app.use('/api/games', gamesRouter);

  // 404 handler
  app.use(notFoundHandler);

  // Error handler
  app.use(errorHandler);

  return app;
}

