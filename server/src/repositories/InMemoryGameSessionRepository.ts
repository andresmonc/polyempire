import type { IGameSessionRepository } from './IGameSessionRepository';
import { GameSessionModel } from '../models/GameSession';
import type { Intent } from '@shared/types';

/**
 * In-memory implementation of game session repository
 * Similar to H2 in-memory mode - fast, no setup, but data is lost on restart
 * Perfect for development and testing
 */
export class InMemoryGameSessionRepository implements IGameSessionRepository {
  private sessions = new Map<string, GameSessionModel>();
  private actionHistory = new Map<string, Array<{ playerId: number; intent: Intent; timestamp: string }>>();

  async create(game: GameSessionModel): Promise<void> {
    this.sessions.set(game.id, game);
    this.actionHistory.set(game.id, []);
  }

  async findById(sessionId: string): Promise<GameSessionModel | null> {
    return this.sessions.get(sessionId) || null;
  }

  async update(game: GameSessionModel): Promise<void> {
    this.sessions.set(game.id, game);
  }

  async delete(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
    this.actionHistory.delete(sessionId);
  }

  async findAll(): Promise<GameSessionModel[]> {
    return Array.from(this.sessions.values());
  }

  async recordAction(sessionId: string, playerId: number, intent: Intent, timestamp: string): Promise<void> {
    const actions = this.actionHistory.get(sessionId) || [];
    actions.push({ playerId, intent, timestamp });
    this.actionHistory.set(sessionId, actions);
  }

  async getActionsSince(sessionId: string, since: string): Promise<Array<{ playerId: number; intent: Intent; timestamp: string }>> {
    const actions = this.actionHistory.get(sessionId) || [];
    return actions.filter(action => action.timestamp > since);
  }
}

