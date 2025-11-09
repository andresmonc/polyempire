import { System } from '@engine/ecs';
import { IntentQueue, isIntent } from '@/state/IntentQueue';
import * as Components from '../components';
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

    // Verify the entity is a city
    const city = this.world.getComponent(cityEntity, Components.City);
    if (!city) {
      console.warn('ProduceUnit intent received for non-city entity');
      return;
    }

    // Get production queue
    const queue = this.world.getComponent(cityEntity, Components.ProductionQueue);
    if (!queue) {
      console.warn('ProduceUnit intent received for city without ProductionQueue');
      return;
    }

    // Get base unit data to get production cost
    const unitsData = (this.gameScene.cache.json.get('units') as any);
    const baseUnitData = unitsData[unitType];
    if (!baseUnitData) {
      console.warn(`Unit type "${unitType}" not found in units.json`);
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
    console.log(`Added ${unitType} to production queue (cost: ${productionCost})`);

    this.events.emit('ui-update');
  }
}

