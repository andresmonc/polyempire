import { createApp } from './app';
import { gameSessionService } from './services/GameSessionService';

const PORT = process.env.PORT || 3000;

const app = createApp();

// Start server
app.listen(PORT, () => {
  console.log(`🚀 PolyEmpire API Server running on http://localhost:${PORT}`);
  console.log(`📡 API endpoints available at http://localhost:${PORT}/api`);
});

// Periodic cleanup of old games
setInterval(async () => {
  await gameSessionService.cleanup();
}, 60 * 60 * 1000); // Every hour

