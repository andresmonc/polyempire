import { System } from '@engine/ecs';
import { GameState } from '@/state/GameState';
import { IntentQueue, isIntent } from '@/state/IntentQueue';
import * as Components from '@engine/gameplay/components';
import Phaser from 'phaser';

/**
 * Handles city founding by settlers.
 * When a settler founds a city, it is consumed (destroyed) and a city is created at that location.
 */
export class FoundCitySystem extends System {
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
    const foundCity = this.intents.pop(isIntent('FoundCity'));
    if (!foundCity) return;

    const { entity } = foundCity.payload;

    // Verify the entity is a settler
    const unitType = this.world.getComponent(entity, Components.UnitType);
    if (!unitType || unitType.type !== 'settler') {
      console.warn('FoundCity intent received for non-settler unit');
      return;
    }

    // Get the settler's position
    const transform = this.world.getComponent(entity, Components.TransformTile);
    if (!transform) {
      console.warn('FoundCity intent received for unit without TransformTile');
      return;
    }

    // TODO: Create a city entity at this location
    // For now, just log and deselect the unit
    console.log(`Founding city at (${transform.tx}, ${transform.ty})`);
    
    // Destroy the settler (it's consumed when founding a city)
    this.world.destroyEntity(entity);

    // Deselect if this was the selected entity
    if (this.gameState.selectedEntity === entity) {
      this.gameState.selectedEntity = null;
      this.gameState.moveMode = false;
      this.events.emit('ui-update');
    }
  }
}

