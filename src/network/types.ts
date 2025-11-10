// Re-export shared types for convenience
export type {
  Intent,
  GameSession,
  PlayerInfo,
  PlayerConnection,
  ActionResponse,
  SerializedGameState,
  SerializedEntity,
  GameStateUpdate,
  CreateGameRequest,
  CreateGameResponse,
  JoinGameRequest,
  JoinGameResponse,
  SubmitActionRequest,
} from '@shared/types';

/**
 * Configuration for network client
 */
export interface NetworkConfig {
  apiBaseUrl?: string;
  pollInterval?: number; // How often to poll for updates (ms)
  enablePolling?: boolean;
}

