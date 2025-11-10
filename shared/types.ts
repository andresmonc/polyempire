/**
 * Shared types between frontend and backend
 * These types are used by both the client and server
 * 
 * Note: Intent types are defined here to avoid circular dependencies
 */

// Intent payload types
export interface SelectEntityPayload {
  entity: number | null;
}

export interface MoveToPayload {
  entity: number;
  target: { tx: number; ty: number };
}

// Intent types
export interface SelectEntityIntent {
  type: 'SelectEntity';
  payload: SelectEntityPayload;
}

export interface MoveToIntent {
  type: 'MoveTo';
  payload: MoveToPayload;
}

export interface EndTurnIntent {
  type: 'EndTurn';
}

export interface EnterMoveModeIntent {
  type: 'EnterMoveMode';
}

export interface CancelMoveModeIntent {
  type: 'CancelMoveMode';
}

export interface FoundCityIntent {
  type: 'FoundCity';
  payload: { entity: number };
}

export interface ProduceUnitIntent {
  type: 'ProduceUnit';
  payload: { cityEntity: number; unitType: string };
}

export interface ProduceBuildingIntent {
  type: 'ProduceBuilding';
  payload: { cityEntity: number; buildingType: string };
}

export interface BuildBuildingIntent {
  type: 'BuildBuilding';
  payload: { cityEntity: number; buildingType: string; tx: number; ty: number };
}

export interface AttackIntent {
  type: 'Attack';
  payload: { attacker: number; target: number };
}

export interface TurnBeganIntent {
  type: 'TurnBegan';
}

// Union type for all intents
export type Intent =
  | SelectEntityIntent
  | MoveToIntent
  | EndTurnIntent
  | EnterMoveModeIntent
  | CancelMoveModeIntent
  | FoundCityIntent
  | ProduceUnitIntent
  | ProduceBuildingIntent
  | BuildBuildingIntent
  | AttackIntent
  | TurnBeganIntent;

/**
 * Represents a game session/room
 */
export interface GameSession {
  id: string;
  name: string;
  players: PlayerInfo[];
  currentTurn: number;
  currentPlayerId: number; // In simultaneous turns, this may represent the "active" player or be unused
  status: 'waiting' | 'active' | 'finished';
  createdAt: string;
  updatedAt: string;
  // Extended info (optional, for detailed turn status)
  playersEndedTurn?: number[]; // Players who have ended their turn this round
  allPlayersEnded?: boolean; // Whether all players have ended their turn
  isSequentialMode?: boolean; // Whether turns are sequential (war) or simultaneous
  wars?: Array<{ player1Id: number; player2Id: number; declaredAt: string; isActive: boolean }>; // Active wars
}

/**
 * Information about a player in a game session
 */
export interface PlayerInfo {
  id: number;
  name: string;
  civilizationId: string;
  isConnected: boolean;
  isHuman?: boolean; // Whether this is a human player (vs AI/bot)
}

/**
 * Represents a war between two players
 */
export interface War {
  player1Id: number;
  player2Id: number;
  declaredAt: string;
  isActive: boolean;
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
 * Request to create a new game
 */
export interface CreateGameRequest {
  name: string;
  playerName: string;
  civilizationId: string;
}

/**
 * Response from creating a game
 */
export interface CreateGameResponse {
  sessionId: string;
  playerId: number;
  game: GameSession;
}

/**
 * Request to join a game
 */
export interface JoinGameRequest {
  playerName: string;
  civilizationId: string;
}

/**
 * Response from joining a game
 */
export interface JoinGameResponse {
  playerId: number;
  game: GameSession;
}

/**
 * Request to submit an action
 */
export interface SubmitActionRequest {
  playerId: number;
  intent: Intent;
}

