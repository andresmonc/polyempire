import type { GameSessionModel } from '../models/GameSession';
import type { Intent } from '@shared/types';

/**
 * Repository interface for game session storage
 * This abstraction allows us to easily switch between:
 * - In-memory storage (development)
 * - SQLite (similar to H2 - file-based, easy setup)
 * - PostgreSQL (production)
 * - MongoDB (document-based)
 * 
 * Just implement this interface and swap it in GameSessionService!
 */
export interface IGameSessionRepository {
  /**
   * Create a new game session
   */
  create(game: GameSessionModel): Promise<void>;

  /**
   * Get a game session by ID
   */
  findById(sessionId: string): Promise<GameSessionModel | null>;

  /**
   * Update an existing game session
   */
  update(game: GameSessionModel): Promise<void>;

  /**
   * Delete a game session
   */
  delete(sessionId: string): Promise<void>;

  /**
   * Get all active game sessions
   */
  findAll(): Promise<GameSessionModel[]>;

  /**
   * Record an action for a game session
   */
  recordAction(sessionId: string, playerId: number, intent: Intent, timestamp: string): Promise<void>;

  /**
   * Get actions since a timestamp
   */
  getActionsSince(sessionId: string, since: string): Promise<Array<{ playerId: number; intent: Intent; timestamp: string }>>;
}

