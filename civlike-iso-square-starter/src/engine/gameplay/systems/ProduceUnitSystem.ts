import { System } from '@engine/ecs';
import { IntentQueue, isIntent } from '@/state/IntentQueue';
import { HUMAN_PLAYER_ID } from '@config/game';
import * as Components from '../components';
import { UnitsData } from '@/utils/unitFactory';
import { logger } from '@/utils/logger';
import Phaser from 'phaser';

/**
 * Handles unit production requests from cities.
 * Adds units to the city's production queue instead of creating them immediately.
 * The ProductionSystem will handle actually creating units when they're complete.
 */
export class ProduceUnitSystem extends System {
  private intents: IntentQueue;
  private events: Phaser.Events.EventEmitter;
  private gameScene: Phaser.Scene;

  constructor(intents: IntentQueue, events: Phaser.Events.EventEmitter, gameScene: Phaser.Scene) {
    super();
    this.intents = intents;
    this.events = events;
    this.gameScene = gameScene;
  }

  update(_dt: number): void {
    const produceUnit = this.intents.pop(isIntent('ProduceUnit'));
    if (!produceUnit) return;

    const { cityEntity, unitType } = produceUnit.payload;

    // Verify the entity is a city and owned by the human player
    const city = this.world.getComponent(cityEntity, Components.City);
    const owner = this.world.getComponent(cityEntity, Components.Owner);
    if (!city) {
      logger.warn('ProduceUnit intent received for non-city entity');
      return;
    }
    if (!owner || owner.playerId !== HUMAN_PLAYER_ID) {
      logger.warn('ProduceUnit intent received for city not owned by human player');
      return;
    }

    // Get production queue
    const queue = this.world.getComponent(cityEntity, Components.ProductionQueue);
    if (!queue) {
      logger.warn('ProduceUnit intent received for city without ProductionQueue');
      return;
    }

    // Get base unit data to get production cost
    try {
      const unitsData = this.gameScene.cache.json.get('units') as UnitsData;
      const baseUnitData = unitsData[unitType];
      if (!baseUnitData) {
        logger.warn(`Unit type "${unitType}" not found in units.json`);
        return;
      }

      const productionCost = baseUnitData.productionCost || 50; // Default cost

      // Add unit to production queue
      const productionItem: Components.ProductionItem = {
        type: 'unit',
        name: unitType,
        cost: productionCost,
      };

      queue.enqueue(productionItem);
      logger.debug(`Added ${unitType} to production queue (cost: ${productionCost})`);
    } catch (error) {
      logger.error(`Failed to get unit data for "${unitType}":`, error);
    }

    this.events.emit('ui-update');
  }
}

