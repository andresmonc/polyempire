import { Intent } from '@/state/IntentQueue';
import { GameState } from '@/state/GameState';
import { World } from '@engine/ecs';
import { IGameClient } from './GameClient';
import {
  GameSession,
  PlayerConnection,
  ActionResponse,
  GameStateUpdate,
  NetworkConfig,
  SerializedGameState,
} from './types';

/**
 * REST API game client for multiplayer
 * Sends actions via HTTP POST and polls for state updates
 */
export class RestGameClient implements IGameClient {
  private connection: PlayerConnection | null = null;
  private session: GameSession | null = null;
  private config: NetworkConfig;
  private pollingInterval: number | null = null;
  private lastUpdateTimestamp: string = '';

  constructor(config: NetworkConfig = {}) {
    this.config = {
      apiBaseUrl: config.apiBaseUrl || 'http://localhost:3000/api',
      pollInterval: config.pollInterval || 2000, // Poll every 2 seconds
      enablePolling: config.enablePolling !== false,
    };
  }

  async initialize(sessionId: string, playerId: number): Promise<void> {
    this.connection = {
      playerId,
      sessionId,
    };

    // Fetch initial session state
    await this.fetchSession();
  }

  private async fetchSession(): Promise<void> {
    if (!this.connection) throw new Error('Not connected');

    try {
      const response = await fetch(`${this.config.apiBaseUrl}/games/${this.connection.sessionId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(this.connection.token && { Authorization: `Bearer ${this.connection.token}` }),
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch session: ${response.statusText}`);
      }

      this.session = await response.json();
    } catch (error) {
      console.error('Failed to fetch session:', error);
      throw error;
    }
  }

  async submitAction(intent: Intent): Promise<ActionResponse> {
    if (!this.connection) {
      return { success: false, error: 'Not connected to game' };
    }

    if (!this.isMyTurn()) {
      return { success: false, error: 'Not your turn' };
    }

    try {
      const response = await fetch(
        `${this.config.apiBaseUrl}/games/${this.connection.sessionId}/actions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(this.connection.token && { Authorization: `Bearer ${this.connection.token}` }),
          },
          body: JSON.stringify({
            playerId: this.connection.playerId,
            intent,
          }),
        },
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: response.statusText }));
        return { success: false, error: error.error || 'Failed to submit action' };
      }

      const result: ActionResponse = await response.json();
      return result;
    } catch (error) {
      console.error('Failed to submit action:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Network error' };
    }
  }

  async getStateUpdate(): Promise<GameStateUpdate | null> {
    if (!this.connection) return null;

    try {
      const response = await fetch(
        `${this.config.apiBaseUrl}/games/${this.connection.sessionId}/state?since=${this.lastUpdateTimestamp}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(this.connection.token && { Authorization: `Bearer ${this.connection.token}` }),
          },
        },
      );

      if (!response.ok) {
        if (response.status === 304) {
          // No changes
          return null;
        }
        throw new Error(`Failed to fetch state: ${response.statusText}`);
      }

      const update: GameStateUpdate = await response.json();
      this.lastUpdateTimestamp = update.timestamp;
      return update;
    } catch (error) {
      console.error('Failed to fetch state update:', error);
      return null;
    }
  }

  applyStateUpdate(update: GameStateUpdate, world: World, gameState: GameState): void {
    // Update game state
    gameState.turn = update.turn;
    gameState.currentPlayerId = update.currentPlayerId;

    // Apply actions from the update
    // Note: In a full implementation, you'd need to deserialize and apply the full state
    // For now, we'll rely on the actions array to replay what happened

    // Update session info
    if (this.session) {
      this.session.currentTurn = update.turn;
      this.session.currentPlayerId = update.currentPlayerId;
      this.session.updatedAt = update.timestamp;
    }
  }

  getConnection(): PlayerConnection | null {
    return this.connection;
  }

  getSession(): GameSession | null {
    return this.session;
  }

  isMyTurn(): boolean {
    if (!this.connection || !this.session) return false;
    return this.session.currentPlayerId === this.connection.playerId;
  }

  startPolling(callback: (update: GameStateUpdate) => void): void {
    if (!this.config.enablePolling) return;

    this.stopPolling(); // Clear any existing polling

    this.pollingInterval = window.setInterval(async () => {
      const update = await this.getStateUpdate();
      if (update) {
        callback(update);
      }
    }, this.config.pollInterval);
  }

  stopPolling(): void {
    if (this.pollingInterval !== null) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  disconnect(): void {
    this.stopPolling();
    this.connection = null;
    this.session = null;
  }
}

