import { System } from '@engine/ecs';
import { IntentQueue, isIntent } from '@/state/IntentQueue';
import * as Components from '../components';
import { BuildingsData } from '@/utils/buildingFactory';
import { logger } from '@/utils/logger';
import Phaser from 'phaser';

/**
 * Handles building production requests from cities.
 * Adds buildings to the city's production queue instead of creating them immediately.
 * The ProductionSystem will handle actually creating buildings when they're complete.
 */
export class ProduceBuildingSystem extends System {
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
    const produceBuilding = this.intents.pop(isIntent('ProduceBuilding'));
    if (!produceBuilding) return;

    const { cityEntity, buildingType } = produceBuilding.payload;

    // Verify the entity is a city
    const city = this.world.getComponent(cityEntity, Components.City);
    if (!city) {
      logger.warn('ProduceBuilding intent received for non-city entity');
      return;
    }

    // Get production queue
    const queue = this.world.getComponent(cityEntity, Components.ProductionQueue);
    if (!queue) {
      logger.warn('ProduceBuilding intent received for city without ProductionQueue');
      return;
    }

    // Get base building data to get production cost
    try {
      const buildingsData = this.gameScene.cache.json.get('buildings') as BuildingsData;
      const baseBuildingData = buildingsData[buildingType];
      if (!baseBuildingData) {
        logger.warn(`Building type "${buildingType}" not found in buildings.json`);
        return;
      }

      const productionCost = baseBuildingData.productionCost || 50; // Default cost

      // Add building to production queue
      const productionItem: Components.ProductionItem = {
        type: 'building',
        name: buildingType,
        cost: productionCost,
      };

      queue.enqueue(productionItem);
      logger.debug(`Added ${buildingType} to production queue (cost: ${productionCost})`);
    } catch (error) {
      logger.error(`Failed to get building data for "${buildingType}":`, error);
    }

    this.events.emit('ui-update');
  }
}

