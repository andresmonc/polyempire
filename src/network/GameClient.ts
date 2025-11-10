import { Intent } from '@/state/IntentQueue';
import { GameState } from '@/state/GameState';
import { World } from '@engine/ecs';
import { GameSession, PlayerConnection, ActionResponse, GameStateUpdate, NetworkConfig } from './types';

/**
 * Abstract interface for game clients (local or network)
 * This allows the game to work both offline and online
 */
export interface IGameClient {
  /**
   * Initialize the client and connect to a game session
   */
  initialize(sessionId: string, playerId: number): Promise<void>;

  /**
   * Submit an action/intent to the game
   * Returns whether the action was accepted
   */
  submitAction(intent: Intent): Promise<ActionResponse>;

  /**
   * Get the current game state update
   * For local games, this returns immediately
   * For network games, this polls the server
   */
  getStateUpdate(): Promise<GameStateUpdate | null>;

  /**
   * Apply a game state update to the local game state
   */
  applyStateUpdate(update: GameStateUpdate, world: World, gameState: GameState): void;

  /**
   * Get the current player connection info
   */
  getConnection(): PlayerConnection | null;

  /**
   * Get the current game session info
   */
  getSession(): GameSession | null;

  /**
   * Check if it's the current player's turn
   */
  isMyTurn(): boolean;

  /**
   * Start polling for updates (for network clients)
   */
  startPolling?(callback: (update: GameStateUpdate) => void): void;

  /**
   * Stop polling for updates
   */
  stopPolling?(): void;

  /**
   * Cleanup and disconnect
   */
  disconnect(): void;
}

