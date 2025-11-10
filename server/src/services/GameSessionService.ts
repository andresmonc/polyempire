import { GameSessionModel } from '../models/GameSession';
import type { Intent } from '@shared/types';
import { v4 as uuidv4 } from 'uuid';
import type { IGameSessionRepository } from '../repositories/IGameSessionRepository';
import { InMemoryGameSessionRepository } from '../repositories/InMemoryGameSessionRepository';
import { gameStateService } from './GameStateService';

/**
 * Service for managing game sessions
 * 
 * Uses the Repository pattern for easy database switching:
 * - InMemoryGameSessionRepository (current) - like H2 in-memory, fast, no setup
 * - SqliteGameSessionRepository (future) - like H2 file mode, file-based, persistent
 * - PostgresGameSessionRepository (future) - production database
 * 
 * To switch: Just change the repository in the constructor!
 */
export class GameSessionService {
  private repository: IGameSessionRepository;
  private nextPlayerId = 1;

  constructor(repository?: IGameSessionRepository) {
    // Default to in-memory for development (like H2 in-memory mode)
    // Swap this to SqliteGameSessionRepository or PostgresGameSessionRepository when ready
    this.repository = repository || new InMemoryGameSessionRepository();
  }

  /**
   * Create a new game session
   */
  async createGame(
    name: string,
    playerName: string,
    civilizationId: string,
    mapWidth: number = 50,
    mapHeight: number = 50,
  ): Promise<{ sessionId: string; playerId: number; game: GameSessionModel }> {
    const sessionId = uuidv4();
    const playerId = this.nextPlayerId++;

    const game = new GameSessionModel(sessionId, name, playerId, playerName, civilizationId);
    await this.repository.create(game);

    // Initialize game state with starting positions
    // For now, use a simple approach - in production, you'd load actual map data
    const startingPositions = this.generateStartingPositionsForSession(game, mapWidth, mapHeight);
    console.log(`[GameSessionService.createGame] Initializing game state with ${startingPositions.length} starting positions`);
    gameStateService.initializeGameState(game, startingPositions);
    
    // Verify entities were created
    const entities = gameStateService.getEntities(sessionId);
    console.log(`[GameSessionService.createGame] Created ${entities.length} entities for session ${sessionId}`);

    return { sessionId, playerId, game };
  }

  /**
   * Generate starting positions for all players in a session
   */
  private generateStartingPositionsForSession(
    game: GameSessionModel,
    mapWidth: number,
    mapHeight: number,
  ): Array<{ playerId: number; position: { tx: number; ty: number } }> {
    // Simple circular placement for now
    // In production, you'd use the actual map data and terrain
    const positions: Array<{ playerId: number; position: { tx: number; ty: number } }> = [];
    const centerX = Math.floor(mapWidth / 2);
    const centerY = Math.floor(mapHeight / 2);
    const radius = Math.min(mapWidth, mapHeight) * 0.3;

    game.players.forEach((player, index) => {
      const angle = (index * 2 * Math.PI) / game.players.length;
      const tx = Math.floor(centerX + radius * Math.cos(angle));
      const ty = Math.floor(centerY + radius * Math.sin(angle));
      
      // Clamp to valid bounds
      const clampedTx = Math.max(2, Math.min(mapWidth - 3, tx));
      const clampedTy = Math.max(2, Math.min(mapHeight - 3, ty));

      positions.push({
        playerId: player.id,
        position: { tx: clampedTx, ty: clampedTy },
      });
    });

    return positions;
  }

  /**
   * Get a game session by ID
   */
  async getGame(sessionId: string): Promise<GameSessionModel | null> {
    return await this.repository.findById(sessionId);
  }

  /**
   * Join an existing game
   */
  async joinGame(
    sessionId: string,
    playerName: string,
    civilizationId: string,
    mapWidth: number = 50,
    mapHeight: number = 50,
  ): Promise<{ playerId: number; game: GameSessionModel }> {
    const game = await this.repository.findById(sessionId);
    if (!game) {
      throw new Error('Game not found');
    }

    if (game.status === 'finished') {
      throw new Error('Game has finished');
    }

    const playerId = this.nextPlayerId++;
    game.addPlayer(playerId, playerName, civilizationId);
    
    // If game state hasn't been initialized yet, initialize it now
    const existingEntities = gameStateService.getEntities(sessionId);
    if (existingEntities.length === 0) {
      // Generate starting positions for all players including the new one
      const startingPositions = this.generateStartingPositionsForSession(game, mapWidth, mapHeight);
      gameStateService.initializeGameState(game, startingPositions);
    } else {
      // Add starting unit for the new player
      const startingPositions = this.generateStartingPositionsForSession(game, mapWidth, mapHeight);
      const newPlayerPosition = startingPositions.find(p => p.playerId === playerId);
      if (newPlayerPosition) {
        gameStateService.createEntity(
          sessionId,
          playerId,
          civilizationId,
          'unit',
          newPlayerPosition.position,
          {
            unitType: 'settler',
            mp: 2,
            maxMp: 2,
            health: 100,
            maxHealth: 100,
            sight: 2,
          },
        );
      }
    }
    
    await this.repository.update(game);

    return { playerId, game };
  }

  /**
   * Submit an action to a game
   */
  async submitAction(sessionId: string, playerId: number, intent: Intent): Promise<void> {
    const game = await this.repository.findById(sessionId);
    if (!game) {
      throw new Error('Game not found');
    }

    // Validate player exists
    if (!game.players.some(p => p.id === playerId)) {
      throw new Error('Player not in game');
    }

    const isSequentialMode = game.hasActiveHumanWars();

    // For sequential mode (war), check if it's the player's turn
    if (isSequentialMode) {
      if (game.currentPlayerId !== playerId) {
        throw new Error('Not your turn');
      }
    } else {
      // For simultaneous mode, check if player has already ended their turn
      if (intent.type === 'EndTurn') {
        if (game.hasPlayerEndedTurn(playerId)) {
          throw new Error('You have already ended your turn this round');
        }
      } else {
        // For other actions, check if player has already ended their turn
        if (game.hasPlayerEndedTurn(playerId)) {
          throw new Error('Cannot perform actions after ending your turn');
        }
      }
    }

    // Apply action to authoritative game state
    gameStateService.applyAction(sessionId, playerId, intent);

    // Record the action
    const timestamp = new Date().toISOString();
    await this.repository.recordAction(sessionId, playerId, intent, timestamp);
    // Also update in-memory model for quick access
    game.recordAction(playerId, intent);

    // Handle turn advancement for EndTurn
    if (intent.type === 'EndTurn') {
      const turnAdvanced = game.playerEndTurn(playerId);
      if (turnAdvanced) {
        // All players have ended their turn - turn has advanced
        // The turn advancement is handled in playerEndTurn
      }
    }

    // Update game state
    await this.repository.update(game);
  }

  /**
   * Get game state updates since a timestamp
   */
  async getStateUpdates(sessionId: string, since: string): Promise<{
    actions: Array<{ playerId: number; intent: Intent; timestamp: string }>;
    lastUpdate: string;
    fullState?: ReturnType<typeof gameStateService.serializeGameState>;
  }> {
    const game = await this.repository.findById(sessionId);
    if (!game) {
      throw new Error('Game not found');
    }

    const actions = await this.repository.getActionsSince(sessionId, since || '');
    
    // Include full state if this is the first request (no since timestamp) or if explicitly requested
    const includeFullState = !since || since === '';
    console.log(`[GameSessionService.getStateUpdates] sessionId: ${sessionId}, since: ${since}, includeFullState: ${includeFullState}`);
    
    const fullState = includeFullState ? gameStateService.serializeGameState(sessionId) : undefined;
    console.log(`[GameSessionService.getStateUpdates] Returning fullState with ${fullState?.entities?.length || 0} entities`);
    
    return {
      actions,
      lastUpdate: game.getLastStateUpdate(),
      fullState,
    };
  }

  /**
   * Declare war between two players
   */
  async declareWar(sessionId: string, player1Id: number, player2Id: number): Promise<void> {
    const game = await this.repository.findById(sessionId);
    if (!game) {
      throw new Error('Game not found');
    }

    // Validate both players exist
    if (!game.players.some(p => p.id === player1Id) || !game.players.some(p => p.id === player2Id)) {
      throw new Error('One or both players not found');
    }

    game.declareWar(player1Id, player2Id);
    await this.repository.update(game);
  }

  /**
   * End war between two players
   */
  async endWar(sessionId: string, player1Id: number, player2Id: number): Promise<void> {
    const game = await this.repository.findById(sessionId);
    if (!game) {
      throw new Error('Game not found');
    }

    game.endWar(player1Id, player2Id);
    await this.repository.update(game);
  }

  /**
   * Clean up old/finished games (for memory management)
   */
  async cleanup(): Promise<void> {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    const allGames = await this.repository.findAll();
    for (const game of allGames) {
      const gameAge = now - new Date(game.createdAt).getTime();
      if (game.status === 'finished' && gameAge > maxAge) {
        await this.repository.delete(game.id);
      }
    }
  }
}

// Singleton instance
export const gameSessionService = new GameSessionService();

