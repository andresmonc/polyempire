import { GameSessionModel } from '../models/GameSession';
import type { Intent } from '@shared/types';
import { v4 as uuidv4 } from 'uuid';
import type { IGameSessionRepository } from '../repositories/IGameSessionRepository';
import { InMemoryGameSessionRepository } from '../repositories/InMemoryGameSessionRepository';

/**
 * Service for managing game sessions
 * 
 * Uses the Repository pattern for easy database switching:
 * - InMemoryGameSessionRepository (current) - like H2 in-memory, fast, no setup
 * - SqliteGameSessionRepository (future) - like H2 file mode, file-based, persistent
 * - PostgresGameSessionRepository (future) - production database
 * 
 * To switch: Just change the repository in the constructor!
 */
export class GameSessionService {
  private repository: IGameSessionRepository;
  private nextPlayerId = 1;

  constructor(repository?: IGameSessionRepository) {
    // Default to in-memory for development (like H2 in-memory mode)
    // Swap this to SqliteGameSessionRepository or PostgresGameSessionRepository when ready
    this.repository = repository || new InMemoryGameSessionRepository();
  }

  /**
   * Create a new game session
   */
  async createGame(
    name: string,
    playerName: string,
    civilizationId: string,
  ): Promise<{ sessionId: string; playerId: number; game: GameSessionModel }> {
    const sessionId = uuidv4();
    const playerId = this.nextPlayerId++;

    const game = new GameSessionModel(sessionId, name, playerId, playerName, civilizationId);
    await this.repository.create(game);

    return { sessionId, playerId, game };
  }

  /**
   * Get a game session by ID
   */
  async getGame(sessionId: string): Promise<GameSessionModel | null> {
    return await this.repository.findById(sessionId);
  }

  /**
   * Join an existing game
   */
  async joinGame(
    sessionId: string,
    playerName: string,
    civilizationId: string,
  ): Promise<{ playerId: number; game: GameSessionModel }> {
    const game = await this.repository.findById(sessionId);
    if (!game) {
      throw new Error('Game not found');
    }

    if (game.status === 'finished') {
      throw new Error('Game has finished');
    }

    const playerId = this.nextPlayerId++;
    game.addPlayer(playerId, playerName, civilizationId);
    await this.repository.update(game);

    return { playerId, game };
  }

  /**
   * Submit an action to a game
   */
  async submitAction(sessionId: string, playerId: number, intent: Intent): Promise<void> {
    const game = await this.repository.findById(sessionId);
    if (!game) {
      throw new Error('Game not found');
    }

    // Validate player exists
    if (!game.players.some(p => p.id === playerId)) {
      throw new Error('Player not in game');
    }

    const isSequentialMode = game.hasActiveHumanWars();

    // For sequential mode (war), check if it's the player's turn
    if (isSequentialMode) {
      if (game.currentPlayerId !== playerId) {
        throw new Error('Not your turn');
      }
    } else {
      // For simultaneous mode, check if player has already ended their turn
      if (intent.type === 'EndTurn') {
        if (game.hasPlayerEndedTurn(playerId)) {
          throw new Error('You have already ended your turn this round');
        }
      } else {
        // For other actions, check if player has already ended their turn
        if (game.hasPlayerEndedTurn(playerId)) {
          throw new Error('Cannot perform actions after ending your turn');
        }
      }
    }

    // Record the action
    const timestamp = new Date().toISOString();
    await this.repository.recordAction(sessionId, playerId, intent, timestamp);
    // Also update in-memory model for quick access
    game.recordAction(playerId, intent);

    // Handle turn advancement for EndTurn
    if (intent.type === 'EndTurn') {
      const turnAdvanced = game.playerEndTurn(playerId);
      if (turnAdvanced) {
        // All players have ended their turn - turn has advanced
        // The turn advancement is handled in playerEndTurn
      }
    }

    // Update game state
    await this.repository.update(game);
  }

  /**
   * Get game state updates since a timestamp
   */
  async getStateUpdates(sessionId: string, since: string): Promise<{
    actions: Array<{ playerId: number; intent: Intent; timestamp: string }>;
    lastUpdate: string;
  }> {
    const game = await this.repository.findById(sessionId);
    if (!game) {
      throw new Error('Game not found');
    }

    const actions = await this.repository.getActionsSince(sessionId, since);
    return {
      actions,
      lastUpdate: game.getLastStateUpdate(),
    };
  }

  /**
   * Declare war between two players
   */
  async declareWar(sessionId: string, player1Id: number, player2Id: number): Promise<void> {
    const game = await this.repository.findById(sessionId);
    if (!game) {
      throw new Error('Game not found');
    }

    // Validate both players exist
    if (!game.players.some(p => p.id === player1Id) || !game.players.some(p => p.id === player2Id)) {
      throw new Error('One or both players not found');
    }

    game.declareWar(player1Id, player2Id);
    await this.repository.update(game);
  }

  /**
   * End war between two players
   */
  async endWar(sessionId: string, player1Id: number, player2Id: number): Promise<void> {
    const game = await this.repository.findById(sessionId);
    if (!game) {
      throw new Error('Game not found');
    }

    game.endWar(player1Id, player2Id);
    await this.repository.update(game);
  }

  /**
   * Clean up old/finished games (for memory management)
   */
  async cleanup(): Promise<void> {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    const allGames = await this.repository.findAll();
    for (const game of allGames) {
      const gameAge = now - new Date(game.createdAt).getTime();
      if (game.status === 'finished' && gameAge > maxAge) {
        await this.repository.delete(game.id);
      }
    }
  }
}

// Singleton instance
export const gameSessionService = new GameSessionService();

