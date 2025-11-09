import { System } from '@engine/ecs';
import { Selected, Selectable } from '../components';
import { GameState } from '@/state/GameState';
import { IntentQueue, isIntent } from '@/state/IntentQueue';
import Phaser from 'phaser';

/**
 * Handles entity selection based on `SelectEntity` intents.
 * It ensures only one entity is selected at a time.
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

    // If the entity is selectable, select it
    if (entity !== null && this.world.hasComponent(entity, Selectable)) {
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
