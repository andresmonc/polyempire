import type { Intent } from '@shared/types';
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
import { HttpClient } from './HttpClient';

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
  private httpClient: HttpClient;

  constructor(config: NetworkConfig = {}) {
    this.config = {
      apiBaseUrl: config.apiBaseUrl || 'http://localhost:3000/api',
      pollInterval: config.pollInterval || 2000, // Poll every 2 seconds
      enablePolling: config.enablePolling !== false,
    };
    this.httpClient = new HttpClient(this.config.apiBaseUrl!);
  }

  async initialize(sessionId: string, playerId: number): Promise<void> {
    this.connection = {
      playerId,
      sessionId,
    };

    // Fetch initial session state
    await this.fetchSession();
  }

  async fetchSession(): Promise<void> {
    if (!this.connection) throw new Error('Not connected');

    try {
      if (this.connection.token) {
        this.httpClient.setDefaultHeader('Authorization', `Bearer ${this.connection.token}`);
      }
      const sessionData = await this.httpClient.get<GameSession>(`/games/${this.connection.sessionId}`);
      this.session = sessionData;
      
      // Update last update timestamp when we get session info
      this.lastUpdateTimestamp = sessionData.updatedAt;
    } catch (error) {
      console.error('Failed to fetch session:', error);
      throw error;
    }
  }

  async submitAction(intent: Intent): Promise<ActionResponse> {
    if (!this.connection) {
      return { success: false, error: 'Not connected to game' };
    }

    // Check if player has already ended their turn (for EndTurn specifically)
    if (intent.type === 'EndTurn') {
      const session = this.getSession();
      if (session && session.playersEndedTurn && session.playersEndedTurn.includes(this.connection.playerId)) {
        return { success: false, error: 'You have already ended your turn this round' };
      }
    }

    if (!this.isMyTurn()) {
      return { success: false, error: 'Not your turn' };
    }

    try {
      const response = await this.httpClient.post<ActionResponse>(
        `/games/${this.connection.sessionId}/actions`,
        {
          playerId: this.connection.playerId,
          intent,
        },
      );
      
      // After successfully ending turn, refresh session info immediately
      if (intent.type === 'EndTurn' && response.success) {
        try {
          await this.fetchSession();
        } catch (error) {
          // Non-critical - polling will update it soon
          console.warn('Failed to refresh session after ending turn:', error);
        }
      }
      
      return response;
    } catch (error) {
      console.error('Failed to submit action:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  async getStateUpdate(): Promise<GameStateUpdate | null> {
    if (!this.connection) return null;

    try {
      const update = await this.httpClient.get<GameStateUpdate>(
        `/games/${this.connection.sessionId}/state?since=${this.lastUpdateTimestamp}`,
      );
      this.lastUpdateTimestamp = update.timestamp;
      return update;
    } catch (error) {
      // 304 Not Modified is expected when there are no updates
      if (error instanceof Error && error.message.includes('304')) {
        return null;
      }
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
    
    // Sequential mode (war): only current player can act
    if (this.session.isSequentialMode) {
      return this.session.currentPlayerId === this.connection.playerId;
    }
    
    // Simultaneous mode: all players can act unless they've ended their turn
    if (this.session.playersEndedTurn && this.session.playersEndedTurn.includes(this.connection.playerId)) {
      return false; // Player has already ended their turn
    }
    return true; // In simultaneous turns, all players can act
  }

  startPolling(callback: (update: GameStateUpdate) => void): void {
    if (!this.config.enablePolling) return;

    this.stopPolling(); // Clear any existing polling

    this.pollingInterval = window.setInterval(async () => {
      // Poll for state updates
      const update = await this.getStateUpdate();
      if (update) {
        callback(update);
      }
      
      // Also periodically refresh session info to get turn status
      try {
        await this.fetchSession();
      } catch (error) {
        // Silently fail - session fetch errors are not critical
        console.warn('Failed to refresh session info:', error);
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

