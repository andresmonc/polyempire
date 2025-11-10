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
  // Track which players have ended their turn this round
  private playersEndedTurn = new Set<number>();
  // Track wars between players (for hybrid turn system)
  private wars: Array<{ player1Id: number; player2Id: number; declaredAt: string; isActive: boolean }> = [];

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
        isHuman: true, // Assume human by default
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
      isHuman: true, // Assume human by default
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
   * Check if two players are at war
   */
  arePlayersAtWar(player1Id: number, player2Id: number): boolean {
    return this.wars.some(
      war =>
        war.isActive &&
        ((war.player1Id === player1Id && war.player2Id === player2Id) ||
          (war.player1Id === player2Id && war.player2Id === player1Id)),
    );
  }

  /**
   * Check if any human players are at war (determines turn mode)
   */
  hasActiveHumanWars(): boolean {
    const humanPlayers = this.players.filter(p => p.isHuman !== false).map(p => p.id);
    
    // Check if any pair of human players are at war
    for (let i = 0; i < humanPlayers.length; i++) {
      for (let j = i + 1; j < humanPlayers.length; j++) {
        if (this.arePlayersAtWar(humanPlayers[i], humanPlayers[j])) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Declare war between two players
   */
  declareWar(player1Id: number, player2Id: number): void {
    // Check if war already exists
    if (this.arePlayersAtWar(player1Id, player2Id)) {
      return; // War already exists
    }

    this.wars.push({
      player1Id,
      player2Id,
      declaredAt: new Date().toISOString(),
      isActive: true,
    });
    this.updatedAt = new Date().toISOString();
  }

  /**
   * End war between two players
   */
  endWar(player1Id: number, player2Id: number): void {
    const warIndex = this.wars.findIndex(
      war =>
        ((war.player1Id === player1Id && war.player2Id === player2Id) ||
          (war.player1Id === player2Id && war.player2Id === player1Id)) &&
        war.isActive,
    );
    if (warIndex !== -1) {
      this.wars[warIndex].isActive = false;
      this.updatedAt = new Date().toISOString();
    }
  }

  /**
   * Mark a player as having ended their turn
   * Returns true if turn should advance (all players ended in simultaneous, or current player ended in sequential)
   */
  playerEndTurn(playerId: number): boolean {
    // Validate player exists
    if (!this.players.some(p => p.id === playerId)) {
      throw new Error('Player not in game');
    }

    const isSequentialMode = this.hasActiveHumanWars();

    if (isSequentialMode) {
      // Sequential mode: only current player can end turn
      if (this.currentPlayerId !== playerId) {
        throw new Error('Not your turn');
      }

      // Advance to next player's turn
      this.advanceToNextPlayer();
      
      // Check if we've completed a full round (all players have had their turn)
      const activePlayers = this.players.filter(p => p.isConnected).map(p => p.id);
      if (this.currentPlayerId === activePlayers[0]) {
        // We've cycled back to the first player - advance the turn
        this.advanceTurn();
        return true;
      }
      return false;
    } else {
      // Simultaneous mode: all players can act, turn advances when all end
      this.playersEndedTurn.add(playerId);
      this.updatedAt = new Date().toISOString();

      // Check if all active players have ended their turn
      const activePlayers = this.players.filter(p => p.isConnected).map(p => p.id);
      const allEnded = activePlayers.every(id => this.playersEndedTurn.has(id));

      if (allEnded) {
        // Advance to next turn
        this.advanceTurn();
        return true;
      }

      return false;
    }
  }

  /**
   * Advance to the next turn (called when all players have ended their turn)
   */
  private advanceTurn(): void {
    this.currentTurn++;
    // Clear ended turn tracking for new turn
    this.playersEndedTurn.clear();
    
    // In sequential mode (war), set to first player
    // In simultaneous mode, currentPlayerId can be any player (not strictly used)
    if (this.hasActiveHumanWars()) {
      const activePlayers = this.players.filter(p => p.isConnected).map(p => p.id).sort();
      if (activePlayers.length > 0) {
        this.currentPlayerId = activePlayers[0];
      }
    }
    
    this.updatedAt = new Date().toISOString();
    this.lastStateUpdate = new Date().toISOString();
  }

  /**
   * Advance to the next player's turn (sequential mode only)
   */
  private advanceToNextPlayer(): void {
    const activePlayers = this.players.filter(p => p.isConnected).map(p => p.id).sort();
    const currentIndex = activePlayers.indexOf(this.currentPlayerId);
    const nextIndex = (currentIndex + 1) % activePlayers.length;
    this.currentPlayerId = activePlayers[nextIndex];
    this.updatedAt = new Date().toISOString();
  }

  /**
   * Check if a player has ended their turn this round
   */
  hasPlayerEndedTurn(playerId: number): boolean {
    return this.playersEndedTurn.has(playerId);
  }

  /**
   * Get list of players who have ended their turn
   */
  getPlayersEndedTurn(): number[] {
    return Array.from(this.playersEndedTurn);
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

  /**
   * Get extended game info including turn status
   */
  getExtendedInfo() {
    const isSequentialMode = this.hasActiveHumanWars();
    return {
      ...this.toJSON(),
      playersEndedTurn: this.getPlayersEndedTurn(),
      allPlayersEnded: isSequentialMode 
        ? false // Not applicable in sequential mode
        : this.players.filter(p => p.isConnected).every(p => this.playersEndedTurn.has(p.id)),
      isSequentialMode,
      wars: this.wars.filter(w => w.isActive),
    };
  }
}

