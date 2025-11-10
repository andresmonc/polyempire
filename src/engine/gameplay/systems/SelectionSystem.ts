import { System } from '@engine/ecs';
import { Selected, Selectable, Owner } from '../components';
import { GameState } from '@/state/GameState';
import { IntentQueue, isIntent } from '@/state/IntentQueue';
import Phaser from 'phaser';

/**
 * Handles entity selection based on `SelectEntity` intents.
 * It ensures only one entity is selected at a time.
 * Only allows selection of entities owned by the current active player.
 */
export class SelectionSystem extends System {
  private intents: IntentQueue;
  private gameState: GameState;
  private events: Phaser.Events.EventEmitter;

  constructor(intents: IntentQueue, gameState: GameState, events: Phaser.Events.EventEmitter) {
    super();
    this.intents = intents;
    this.gameState = gameState;
    this.events = events;
  }

  update(_dt: number): void {
    const intent = this.intents.pop(isIntent('SelectEntity'));
    if (!intent) return;

    const { entity } = intent.payload;

    // Clear previous selection
    if (
      this.gameState.selectedEntity !== null &&
      this.gameState.selectedEntity !== entity
    ) {
      if (this.world.hasComponent(this.gameState.selectedEntity, Selectable)) {
        this.world.removeComponent(this.gameState.selectedEntity, Selected);
      }
    }

    // If the entity is selectable, check ownership before selecting
    if (entity !== null && this.world.hasComponent(entity, Selectable)) {
      const owner = this.world.getComponent(entity, Owner);
      
      // Only allow selection of entities owned by the current active player
      if (owner && !this.gameState.isCurrentPlayer(owner.playerId)) {
        // Don't select entities not owned by current player
        return;
      }

      this.world.addComponent(entity, new Selected());
      this.gameState.selectedEntity = entity;
      // Exit move mode when selecting a new entity
      this.gameState.moveMode = false;
      this.events.emit('ui-update');
    } else {
      // If null or not selectable, deselect
      this.gameState.selectedEntity = null;
      // Exit move mode when deselecting
      this.gameState.moveMode = false;
      this.events.emit('ui-update');
    }
  }
}
