import { Intent } from '@/state/IntentQueue';
import { GameState } from '@/state/GameState';
import { World } from '@engine/ecs';

/**
 * Represents a game session/room
 */
export interface GameSession {
  id: string;
  name: string;
  players: PlayerInfo[];
  currentTurn: number;
  currentPlayerId: number;
  status: 'waiting' | 'active' | 'finished';
  createdAt: string;
  updatedAt: string;
}

/**
 * Information about a player in a game session
 */
export interface PlayerInfo {
  id: number;
  name: string;
  civilizationId: string;
  isConnected: boolean;
}

/**
 * Represents the current player's connection to a game
 */
export interface PlayerConnection {
  playerId: number;
  sessionId: string;
  token?: string; // For authentication
}

/**
 * Response from submitting an action to the server
 */
export interface ActionResponse {
  success: boolean;
  error?: string;
  gameState?: SerializedGameState;
  turn?: number;
}

/**
 * Serialized game state for network transmission
 * This represents the minimal state needed to sync clients
 */
export interface SerializedGameState {
  turn: number;
  currentPlayerId: number;
  entities: SerializedEntity[];
  // Add other state as needed
}

/**
 * Serialized entity data
 */
export interface SerializedEntity {
  id: number;
  components: Record<string, unknown>;
}

/**
 * Game state update received from server
 */
export interface GameStateUpdate {
  sessionId: string;
  turn: number;
  currentPlayerId: number;
  actions: Intent[]; // Actions that occurred since last update
  fullState?: SerializedGameState; // Full state if needed
  timestamp: string;
}

/**
 * Configuration for network client
 */
export interface NetworkConfig {
  apiBaseUrl?: string;
  pollInterval?: number; // How often to poll for updates (ms)
  enablePolling?: boolean;
}

