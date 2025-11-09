import { System } from '@engine/ecs';
import { GameState } from '@/state/GameState';
import { IntentQueue, isIntent } from '@/state/IntentQueue';
import { HUMAN_PLAYER_ID } from '@config/game';
import * as Components from '@engine/gameplay/components';
import { logger } from '@/utils/logger';
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
      logger.warn('FoundCity intent received for non-settler unit');
      return;
    }

    // Get the settler's position
    const transform = this.world.getComponent(entity, Components.TransformTile);
    if (!transform) {
      logger.warn('FoundCity intent received for unit without TransformTile');
      return;
    }

    // Get the settler's owner
    const owner = this.world.getComponent(entity, Components.Owner);
    if (!owner) {
      logger.warn('FoundCity intent received for unit without Owner');
      return;
    }

    // Only allow human player to found cities
    if (owner.playerId !== HUMAN_PLAYER_ID) {
      logger.warn('FoundCity intent received for unit not owned by human player');
      return;
    }

    // Get the settler's civilization (if any)
    const civilization = this.world.getComponent(entity, Components.CivilizationComponent);

    // Create a city entity at this location
    const city = this.world.createEntity();
    this.world.addComponent(city, new Components.TransformTile(transform.tx, transform.ty));
    this.world.addComponent(city, new Components.City(1, 0, 2)); // Start with population 1, 0 progress, 2 turns until growth
    this.world.addComponent(city, new Components.Owner(owner.playerId));
    this.world.addComponent(city, new Components.Resources(0, 0, 0)); // Start with no resources
    this.world.addComponent(city, new Components.ProductionQueue()); // Empty production queue
    if (civilization) {
      this.world.addComponent(city, new Components.CivilizationComponent(civilization.civId));
    }
    this.world.addComponent(city, new Components.Selectable());
    
    // Create ScreenPos for the city (for potential future rendering)
    const screenPos = this.world.getComponent(entity, Components.ScreenPos);
    if (screenPos) {
      this.world.addComponent(city, new Components.ScreenPos(screenPos.x, screenPos.y));
    }
    
    logger.info(`City founded at (${transform.tx}, ${transform.ty}) with population 1`);
    
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

