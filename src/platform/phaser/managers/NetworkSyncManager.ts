import Phaser from 'phaser';
import { World, Entity } from '@engine/ecs';
import { GameState } from '@/state/GameState';
import { NetworkIntentQueue } from '@/network/NetworkIntentQueue';
import { GameStateUpdate } from '@/network/types';
import * as Components from '@engine/gameplay/components';
import { tileToWorld } from '@engine/math/iso';
import { UnitSprite } from '../sprites/UnitSprite';

/**
 * Handles network synchronization between client and server
 */
export class NetworkSyncManager {
  private ecsWorld: World;
  private gameState: GameState;
  private intentQueue: NetworkIntentQueue;
  private entityIdMap = new Map<number, number>(); // localEntityId -> serverEntityId
  private serverEntityIdMap = new Map<number, number>(); // serverEntityId -> localEntityId
  private unitSprites: Map<Entity, UnitSprite>;

  constructor(
    ecsWorld: World,
    gameState: GameState,
    intentQueue: NetworkIntentQueue,
    unitSprites: Map<Entity, UnitSprite>,
  ) {
    this.ecsWorld = ecsWorld;
    this.gameState = gameState;
    this.intentQueue = intentQueue;
    this.unitSprites = unitSprites;
  }

  /**
   * Handle state updates from the server
   */
  handleStateUpdate(update: GameStateUpdate, gameClient: any, events: Phaser.Events.EventEmitter): void {
    // If we have full state, sync entities first (this happens on initial load)
    if (update.fullState) {
      this.syncEntitiesFromServer(update.fullState);
    }

    // Apply the state update using the game client
    // This will update turn, currentPlayerId, and trigger TurnBegan if turn advanced
    const previousTurn = this.gameState.turn;
    gameClient.applyStateUpdate(update, this.ecsWorld, this.gameState);

    // If turn advanced in multiplayer, trigger TurnBegan intent for systems
    if (this.gameState.isMultiplayer && update.turn > previousTurn) {
      this.intentQueue.push({ type: 'TurnBegan' });
      events.emit('ui-update');
    }

    // Apply any actions from the update
    update.actions.forEach((intent) => {
      // Skip EndTurn actions from server - they're already processed server-side
      if (intent.type === 'EndTurn') {
        return;
      }

      // For MoveTo actions from other players, apply them directly to update positions
      if (intent.type === 'MoveTo' && this.gameState.isMultiplayer) {
        const serverEntityId = intent.payload.entity;
        const localEntityId = this.serverEntityIdMap.get(serverEntityId);
        
        if (localEntityId !== undefined) {
          const transform = this.ecsWorld.getComponent(localEntityId, Components.TransformTile);
          const unit = this.ecsWorld.getComponent(localEntityId, Components.Unit);
          
          if (transform && unit) {
            // Update position directly (server is authoritative)
            transform.tx = intent.payload.target.tx;
            transform.ty = intent.payload.target.ty;
            
            // Update sprite position
            const worldPos = tileToWorld(intent.payload.target);
            const sprite = this.unitSprites.get(localEntityId);
            if (sprite) {
              sprite.setPosition(worldPos.x, worldPos.y);
            }
            
            // Update screen position
            const screenPos = this.ecsWorld.getComponent(localEntityId, Components.ScreenPos);
            if (screenPos) {
              screenPos.x = worldPos.x;
              screenPos.y = worldPos.y;
            }
            
            // Deduct MP (server already did this, but sync it)
            if (unit.mp > 0) {
              unit.mp = Math.max(0, unit.mp - 1);
            }
            
            // Clear any existing path (server has moved the unit)
            unit.path = [];
          }
        }
      } else {
        // For other actions, add to intent queue
        this.intentQueue.push(intent);
      }
    });

    events.emit('ui-update');
  }

  /**
   * Sync entities from server full state
   * Note: The full sync logic is complex and remains in GameScene for now
   * This method provides access to entity ID maps
   */
  syncEntitiesFromServer(fullState: {
    entities: Array<{
      id: number;
      ownerId: number;
      civId: string;
      type: string;
      position: { tx: number; ty: number };
      data: Record<string, unknown>;
    }>;
  }): void {
    // This is a placeholder - the full sync logic remains in GameScene
    // because it needs access to UnitFactory, civilizationRegistry, cameras, etc.
    // The actual syncEntitiesFromServer method in GameScene will use the maps from this manager
  }

  /**
   * Map a local entity ID to a server entity ID
   */
  mapEntity(localEntityId: Entity, serverEntityId: number): void {
    this.entityIdMap.set(localEntityId, serverEntityId);
    this.serverEntityIdMap.set(serverEntityId, localEntityId);
  }

  /**
   * Get server entity ID for a local entity
   */
  getServerEntityId(localEntityId: Entity): number | undefined {
    return this.entityIdMap.get(localEntityId);
  }

  /**
   * Get local entity ID for a server entity
   */
  getLocalEntityId(serverEntityId: number): Entity | undefined {
    return this.serverEntityIdMap.get(serverEntityId);
  }

  /**
   * Get entity ID maps (for exposing to game client)
   */
  getEntityIdMaps(): {
    entityIdMap: Map<number, number>;
    serverEntityIdMap: Map<number, number>;
  } {
    return {
      entityIdMap: this.entityIdMap,
      serverEntityIdMap: this.serverEntityIdMap,
    };
  }
}

