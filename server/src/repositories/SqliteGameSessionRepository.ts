/**
 * SQLite implementation of game session repository
 * 
 * Similar to H2 in Java - file-based database, zero configuration
 * Perfect for development and small deployments
 * 
 * To use this:
 * 1. Install: npm install better-sqlite3
 * 2. Uncomment the code below
 * 3. Swap repository in GameSessionService constructor
 * 
 * Example:
 * ```typescript
 * import Database from 'better-sqlite3';
 * const db = new Database('games.db');
 * 
 * // Create tables
 * db.exec(`
 *   CREATE TABLE IF NOT EXISTS game_sessions (
 *     id TEXT PRIMARY KEY,
 *     name TEXT NOT NULL,
 *     current_turn INTEGER NOT NULL,
 *     current_player_id INTEGER NOT NULL,
 *     status TEXT NOT NULL,
 *     created_at TEXT NOT NULL,
 *     updated_at TEXT NOT NULL,
 *     data TEXT NOT NULL  -- JSON serialized game state
 *   );
 *   
 *   CREATE TABLE IF NOT EXISTS players (
 *     id INTEGER PRIMARY KEY,
 *     session_id TEXT NOT NULL,
 *     player_id INTEGER NOT NULL,
 *     name TEXT NOT NULL,
 *     civilization_id TEXT NOT NULL,
 *     is_connected INTEGER NOT NULL,
 *     FOREIGN KEY (session_id) REFERENCES game_sessions(id)
 *   );
 *   
 *   CREATE TABLE IF NOT EXISTS actions (
 *     id INTEGER PRIMARY KEY AUTOINCREMENT,
 *     session_id TEXT NOT NULL,
 *     player_id INTEGER NOT NULL,
 *     intent TEXT NOT NULL,  -- JSON serialized intent
 *     timestamp TEXT NOT NULL,
 *     FOREIGN KEY (session_id) REFERENCES game_sessions(id)
 *   );
 * `);
 * ```
 */

import type { IGameSessionRepository } from './IGameSessionRepository';
import { GameSessionModel } from '../models/GameSession';
import type { Intent } from '@shared/types';

/**
 * SQLite repository implementation
 * Uncomment and implement when ready to use SQLite
 */
export class SqliteGameSessionRepository implements IGameSessionRepository {
  // private db: Database;

  // constructor(dbPath: string = 'games.db') {
  //   this.db = new Database(dbPath);
  //   this.initializeTables();
  // }

  // private initializeTables(): void {
  //   // Implementation here
  // }

  async create(game: GameSessionModel): Promise<void> {
    throw new Error('SQLite repository not yet implemented. Use InMemoryGameSessionRepository for now.');
  }

  async findById(sessionId: string): Promise<GameSessionModel | null> {
    throw new Error('SQLite repository not yet implemented. Use InMemoryGameSessionRepository for now.');
  }

  async update(game: GameSessionModel): Promise<void> {
    throw new Error('SQLite repository not yet implemented. Use InMemoryGameSessionRepository for now.');
  }

  async delete(sessionId: string): Promise<void> {
    throw new Error('SQLite repository not yet implemented. Use InMemoryGameSessionRepository for now.');
  }

  async findAll(): Promise<GameSessionModel[]> {
    throw new Error('SQLite repository not yet implemented. Use InMemoryGameSessionRepository for now.');
  }

  async recordAction(sessionId: string, playerId: number, intent: Intent, timestamp: string): Promise<void> {
    throw new Error('SQLite repository not yet implemented. Use InMemoryGameSessionRepository for now.');
  }

  async getActionsSince(sessionId: string, since: string): Promise<Array<{ playerId: number; intent: Intent; timestamp: string }>> {
    throw new Error('SQLite repository not yet implemented. Use InMemoryGameSessionRepository for now.');
  }
}

