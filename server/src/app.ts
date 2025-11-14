import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import gamesRouter from './routes/games';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

  // Serve static files from frontend build (if it exists)
  // From server/dist/app.js, go up to app root, then into dist
  const staticPath = path.join(__dirname, '../dist');
  app.use(express.static(staticPath));

  // Serve index.html for all non-API routes (SPA routing)
  app.get('*', (req, res, next) => {
    // Skip API routes
    if (req.path.startsWith('/api')) {
      return next();
    }
    // Serve index.html for all other routes
    res.sendFile(path.join(staticPath, 'index.html'), (err) => {
      if (err) {
        // If dist folder doesn't exist, continue to 404 handler
        next();
      }
    });
  });

  // 404 handler
  app.use(notFoundHandler);

  // Error handler
  app.use(errorHandler);

  return app;
}

