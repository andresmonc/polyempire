import { Intent } from '@/state/IntentQueue';
import { GameState } from '@/state/GameState';
import { World } from '@engine/ecs';
import { IGameClient } from './GameClient';
import { GameSession, PlayerConnection, ActionResponse, GameStateUpdate } from './types';

/**
 * Local game client that processes actions immediately
 * This is the current behavior - all actions are processed locally
 */
export class LocalGameClient implements IGameClient {
  private connection: PlayerConnection | null = null;
  private session: GameSession | null = null;

  async initialize(sessionId: string, playerId: number): Promise<void> {
    this.connection = {
      playerId,
      sessionId,
    };

    this.session = {
      id: sessionId,
      name: 'Local Game',
      players: [{ id: playerId, name: 'Player', civilizationId: 'default', isConnected: true }],
      currentTurn: 1,
      currentPlayerId: playerId,
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  async submitAction(intent: Intent): Promise<ActionResponse> {
    // Local games accept all actions immediately
    // The actual validation happens in the game systems
    return {
      success: true,
    };
  }

  async getStateUpdate(): Promise<GameStateUpdate | null> {
    // Local games don't need to poll - state is always current
    return null;
  }

  applyStateUpdate(update: GameStateUpdate, world: World, gameState: GameState): void {
    // For local games, we don't apply external updates
    // State is managed directly by the game systems
    if (update.currentPlayerId !== undefined) {
      gameState.currentPlayerId = update.currentPlayerId;
    }
    if (update.turn !== undefined) {
      gameState.turn = update.turn;
    }
  }

  getConnection(): PlayerConnection | null {
    return this.connection;
  }

  getSession(): GameSession | null {
    return this.session;
  }

  isMyTurn(): boolean {
    if (!this.connection || !this.session) return true; // Default to true for local games
    return this.session.currentPlayerId === this.connection.playerId;
  }

  disconnect(): void {
    this.connection = null;
    this.session = null;
  }
}

