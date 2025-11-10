import { GameSessionModel } from '../models/GameSession';
import type { Intent } from '@shared/types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Service for managing game sessions
 * 
 * NOTE: Currently stores all data in-memory using a Map.
 * This means:
 * - Data is lost when the server restarts
 * - Not suitable for production without persistence
 * - For production, consider adding database persistence (PostgreSQL, MongoDB, etc.)
 */
export class GameSessionService {
  // In-memory storage - data is lost on server restart
  private sessions = new Map<string, GameSessionModel>();
  private nextPlayerId = 1;

  /**
   * Create a new game session
   */
  createGame(
    name: string,
    playerName: string,
    civilizationId: string,
  ): { sessionId: string; playerId: number; game: GameSessionModel } {
    const sessionId = uuidv4();
    const playerId = this.nextPlayerId++;

    const game = new GameSessionModel(sessionId, name, playerId, playerName, civilizationId);
    this.sessions.set(sessionId, game);

    return { sessionId, playerId, game };
  }

  /**
   * Get a game session by ID
   */
  getGame(sessionId: string): GameSessionModel | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Join an existing game
   */
  joinGame(
    sessionId: string,
    playerName: string,
    civilizationId: string,
  ): { playerId: number; game: GameSessionModel } {
    const game = this.sessions.get(sessionId);
    if (!game) {
      throw new Error('Game not found');
    }

    if (game.status === 'finished') {
      throw new Error('Game has finished');
    }

    const playerId = this.nextPlayerId++;
    game.addPlayer(playerId, playerName, civilizationId);

    return { playerId, game };
  }

  /**
   * Submit an action to a game
   */
  submitAction(sessionId: string, playerId: number, intent: Intent): void {
    const game = this.sessions.get(sessionId);
    if (!game) {
      throw new Error('Game not found');
    }

    // Validate it's the player's turn
    if (game.currentPlayerId !== playerId) {
      throw new Error('Not your turn');
    }

    // Validate player exists
    if (!game.players.some(p => p.id === playerId)) {
      throw new Error('Player not in game');
    }

    // Record the action
    game.recordAction(playerId, intent);

    // Handle turn advancement
    if (intent.type === 'EndTurn') {
      game.nextTurn();
    }
  }

  /**
   * Get game state updates since a timestamp
   */
  getStateUpdates(sessionId: string, since: string): {
    actions: Array<{ playerId: number; intent: Intent; timestamp: string }>;
    lastUpdate: string;
  } {
    const game = this.sessions.get(sessionId);
    if (!game) {
      throw new Error('Game not found');
    }

    const actions = game.getActionsSince(since);
    return {
      actions,
      lastUpdate: game.getLastStateUpdate(),
    };
  }

  /**
   * Clean up old/finished games (for memory management)
   */
  cleanup(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    for (const [id, game] of this.sessions.entries()) {
      const gameAge = now - new Date(game.createdAt).getTime();
      if (game.status === 'finished' && gameAge > maxAge) {
        this.sessions.delete(id);
      }
    }
  }
}

// Singleton instance
export const gameSessionService = new GameSessionService();

