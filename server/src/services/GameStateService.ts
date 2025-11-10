import type { Intent } from '@shared/types';
import { GameSessionModel } from '../models/GameSession';

/**
 * Represents a game entity on the server
 */
export interface ServerEntity {
  id: number;
  ownerId: number;
  civId: string;
  type: 'unit' | 'city' | 'building';
  position: { tx: number; ty: number };
  data: Record<string, unknown>; // Additional entity data (health, mp, etc.)
}

/**
 * Service for managing the authoritative game state on the server
 * This is the source of truth for all entities, positions, and game state
 */
export class GameStateService {
  private entities = new Map<string, Map<number, ServerEntity>>(); // sessionId -> entityId -> entity
  private nextEntityId = new Map<string, number>(); // sessionId -> nextId

  /**
   * Initialize game state for a session (create starting units)
   */
  initializeGameState(session: GameSessionModel, startingPositions: Array<{ playerId: number; position: { tx: number; ty: number } }>): void {
    const sessionId = session.id;
    console.log(`[GameStateService.initializeGameState] Initializing for session ${sessionId} with ${startingPositions.length} positions`);
    this.entities.set(sessionId, new Map());
    this.nextEntityId.set(sessionId, 1);

    // Create starting settler for each player
    startingPositions.forEach(({ playerId, position }) => {
      const player = session.players.find(p => p.id === playerId);
      if (!player) {
        console.warn(`[GameStateService.initializeGameState] Player ${playerId} not found in session`);
        return;
      }

      const entityId = this.getNextEntityId(sessionId);
      const entity: ServerEntity = {
        id: entityId,
        ownerId: playerId,
        civId: player.civilizationId,
        type: 'unit',
        position: { tx: position.tx, ty: position.ty },
        data: {
          unitType: 'settler',
          mp: 2,
          maxMp: 2,
          health: 100,
          maxHealth: 100,
          sight: 2,
        },
      };

      this.entities.get(sessionId)!.set(entityId, entity);
      console.log(`[GameStateService.initializeGameState] Created entity ${entityId} for player ${playerId} at (${position.tx}, ${position.ty})`);
    });
    
    const finalEntities = this.getEntities(sessionId);
    console.log(`[GameStateService.initializeGameState] Total entities created: ${finalEntities.length}`);
  }

  /**
   * Get all entities for a session
   */
  getEntities(sessionId: string): ServerEntity[] {
    const sessionEntities = this.entities.get(sessionId);
    if (!sessionEntities) {
      console.log(`[GameStateService.getEntities] No entities found for session ${sessionId}`);
      return [];
    }
    const entities = Array.from(sessionEntities.values());
    console.log(`[GameStateService.getEntities] Found ${entities.length} entities for session ${sessionId}`);
    return entities;
  }

  /**
   * Get entities owned by a specific player
   */
  getPlayerEntities(sessionId: string, playerId: number): ServerEntity[] {
    return this.getEntities(sessionId).filter(e => e.ownerId === playerId);
  }

  /**
   * Get an entity by ID
   */
  getEntity(sessionId: string, entityId: number): ServerEntity | undefined {
    return this.entities.get(sessionId)?.get(entityId);
  }

  /**
   * Apply an action/intent to the game state
   */
  applyAction(sessionId: string, playerId: number, intent: Intent): void {
    const sessionEntities = this.entities.get(sessionId);
    if (!sessionEntities) return;

    switch (intent.type) {
      case 'MoveTo': {
        const entity = sessionEntities.get(intent.payload.entity);
        if (entity && entity.ownerId === playerId) {
          // Validate movement points
          const mp = (entity.data.mp as number) || 0;
          if (mp > 0) {
            entity.position = intent.payload.target;
            // Deduct movement points
            entity.data.mp = Math.max(0, mp - 1);
          }
        }
        break;
      }
      case 'FoundCity': {
        const entity = sessionEntities.get(intent.payload.entity);
        if (entity && entity.ownerId === playerId && entity.type === 'unit' && entity.data.unitType === 'settler') {
          // Convert settler to city
          entity.type = 'city';
          entity.data = {
            population: 1,
            food: 0,
            production: 0,
            gold: 0,
          };
        }
        break;
      }
      case 'Attack': {
        const attacker = sessionEntities.get(intent.payload.attacker);
        const target = sessionEntities.get(intent.payload.target);
        if (attacker && target && attacker.ownerId === playerId) {
          // Apply damage
          const targetHealth = (target.data.health as number) || 100;
          const attackerAttack = (attacker.data.attack as number) || 10;
          const newHealth = Math.max(0, targetHealth - attackerAttack);
          target.data.health = newHealth;
          
          // Remove entity if dead
          if (newHealth <= 0) {
            sessionEntities.delete(intent.payload.target);
          }
        }
        break;
      }
      // Other actions can be handled here
    }
  }

  /**
   * Create a new entity (e.g., when a unit is produced)
   */
  createEntity(
    sessionId: string,
    ownerId: number,
    civId: string,
    type: 'unit' | 'city' | 'building',
    position: { tx: number; ty: number },
    data: Record<string, unknown>,
  ): number {
    const entityId = this.getNextEntityId(sessionId);
    const entity: ServerEntity = {
      id: entityId,
      ownerId,
      civId,
      type,
      position,
      data,
    };

    const sessionEntities = this.entities.get(sessionId);
    if (!sessionEntities) {
      this.entities.set(sessionId, new Map());
    }
    this.entities.get(sessionId)!.set(entityId, entity);

    return entityId;
  }

  /**
   * Serialize game state for transmission
   */
  serializeGameState(sessionId: string): {
    entities: Array<{
      id: number;
      ownerId: number;
      civId: string;
      type: string;
      position: { tx: number; ty: number };
      data: Record<string, unknown>;
    }>;
  } {
    const entities = this.getEntities(sessionId);
    return {
      entities: entities.map(e => ({
        id: e.id,
        ownerId: e.ownerId,
        civId: e.civId,
        type: e.type,
        position: e.position,
        data: e.data,
      })),
    };
  }

  /**
   * Clean up game state for a session
   */
  cleanup(sessionId: string): void {
    this.entities.delete(sessionId);
    this.nextEntityId.delete(sessionId);
  }

  private getNextEntityId(sessionId: string): number {
    const current = this.nextEntityId.get(sessionId) || 1;
    this.nextEntityId.set(sessionId, current + 1);
    return current;
  }
}

// Singleton instance
export const gameStateService = new GameStateService();

