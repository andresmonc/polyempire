import type {
  GameSession as IGameSession,
  PlayerInfo,
  Intent,
} from '@shared/types';

/**
 * Internal game session model with additional server-side state
 */
export class GameSessionModel implements IGameSession {
  public id: string;
  public name: string;
  public players: PlayerInfo[];
  public currentTurn: number;
  public currentPlayerId: number;
  public status: 'waiting' | 'active' | 'finished';
  public createdAt: string;
  public updatedAt: string;

  // Server-side only fields
  private actionHistory: Array<{ playerId: number; intent: Intent; timestamp: string }> = [];
  private lastStateUpdate: string = new Date().toISOString();

  constructor(
    id: string,
    name: string,
    creatorPlayerId: number,
    creatorName: string,
    creatorCivId: string,
  ) {
    this.id = id;
    this.name = name;
    this.players = [
      {
        id: creatorPlayerId,
        name: creatorName,
        civilizationId: creatorCivId,
        isConnected: true,
      },
    ];
    this.currentTurn = 1;
    this.currentPlayerId = creatorPlayerId;
    this.status = 'waiting';
    this.createdAt = new Date().toISOString();
    this.updatedAt = new Date().toISOString();
  }

  /**
   * Add a player to the game
   */
  addPlayer(playerId: number, playerName: string, civId: string): void {
    // Check if player already exists
    if (this.players.some(p => p.id === playerId)) {
      throw new Error('Player already in game');
    }

    // Check if civilization is already taken
    if (this.players.some(p => p.civilizationId === civId)) {
      throw new Error('Civilization already taken');
    }

    this.players.push({
      id: playerId,
      name: playerName,
      civilizationId: civId,
      isConnected: true,
    });

    this.updatedAt = new Date().toISOString();

    // Auto-start game if we have 2+ players
    if (this.players.length >= 2 && this.status === 'waiting') {
      this.status = 'active';
    }
  }

  /**
   * Record an action (for in-memory tracking)
   * Note: The repository also stores actions, this is for quick access
   */
  recordAction(playerId: number, intent: Intent): void {
    this.actionHistory.push({
      playerId,
      intent,
      timestamp: new Date().toISOString(),
    });
    this.lastStateUpdate = new Date().toISOString();
    this.updatedAt = new Date().toISOString();
  }

  /**
   * Get actions since a timestamp (for in-memory access)
   * Note: The repository is the source of truth, this is for quick access
   */
  getActionsSince(timestamp: string): Array<{ playerId: number; intent: Intent; timestamp: string }> {
    return this.actionHistory.filter(action => action.timestamp > timestamp);
  }

  /**
   * Advance to next turn
   */
  nextTurn(): void {
    this.currentTurn++;
    // Simple round-robin turn order
    const playerIds = this.players.map(p => p.id).sort();
    const currentIndex = playerIds.indexOf(this.currentPlayerId);
    this.currentPlayerId = playerIds[(currentIndex + 1) % playerIds.length];
    this.updatedAt = new Date().toISOString();
  }

  /**
   * Get the last state update timestamp
   */
  getLastStateUpdate(): string {
    return this.lastStateUpdate;
  }

  /**
   * Convert to API response format
   */
  toJSON(): IGameSession {
    return {
      id: this.id,
      name: this.name,
      players: this.players,
      currentTurn: this.currentTurn,
      currentPlayerId: this.currentPlayerId,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}

